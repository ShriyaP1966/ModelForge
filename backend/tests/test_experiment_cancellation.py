import threading
import unittest.mock
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db.base import Base
from app.db.session import SessionLocal
from app.models.entities import Project, Dataset, Experiment, ExperimentMetric, ExperimentArtifact
from app.services.experiment_manager import ExperimentManager
from app.services import experiment_manager as em_module
from app.services.dataset_analyzer import calculate_file_sha256

client = TestClient(app)


@pytest.fixture
def queued_experiment(tmp_path):
    """A queued Experiment backed by an isolated tmp_path DB, for tests that
    call ExperimentManager.run_experiment() directly with an explicit session
    (the same pattern test_reproducibility.py uses) rather than through the
    API -- no real concurrency needed for these."""
    db_file = tmp_path / "cancel_test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    csv_file = tmp_path / "data.csv"
    df = pd.DataFrame({"x1": list(range(20)), "target": [0, 1] * 10})
    df.to_csv(csv_file, index=False)
    sha256 = calculate_file_sha256(str(csv_file))

    proj = Project(name="Cancel Test", task_type="classification")
    session.add(proj)
    session.commit()

    dataset = Dataset(
        project_id=proj.id, filename="data.csv", file_path=str(csv_file),
        row_count=20, col_count=2, sha256_hash=sha256, target_column="target"
    )
    session.add(dataset)
    session.commit()

    exp = Experiment(
        project_id=proj.id, dataset_id=dataset.id, name="Cancel me",
        model_type="logistic_regression", hyperparameters={},
        preprocessing_config={"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"},
        feature_selection=["x1"], target_column="target",
        random_seed=42, test_size=0.2, status="queued"
    )
    session.add(exp)
    session.commit()

    yield session, exp.id
    session.close()


def test_run_experiment_cancelled_before_start_persists_nothing(queued_experiment):
    """If cancel_event is already set before run_experiment ever begins (e.g.
    the user cancelled while it was still queued behind other work), it must
    bail out immediately: no "running" transition, no training, no metrics."""
    session, exp_id = queued_experiment
    cancel_event = threading.Event()
    cancel_event.set()

    result = ExperimentManager.run_experiment(session, exp_id, cancel_event=cancel_event)

    assert result.status == "queued"  # untouched -- never even started
    assert session.query(ExperimentMetric).filter_by(experiment_id=exp_id).count() == 0
    assert session.query(ExperimentArtifact).filter_by(experiment_id=exp_id).count() == 0


def test_run_experiment_cancelled_after_training_discards_results(queued_experiment, monkeypatch):
    """If cancel_event is set right as training finishes (the realistic
    window: sklearn's fit() can't be interrupted mid-call), the experiment
    must end up "cancelled" with zero persisted metrics/artifacts -- never
    "completed", and never a partial write of only some of them."""
    session, exp_id = queued_experiment
    cancel_event = threading.Event()

    from app.services import pipeline_engine
    original_train = pipeline_engine.MLPipelineEngine.train_and_evaluate

    def train_then_cancel(*args, **kwargs):
        result = original_train(*args, **kwargs)
        cancel_event.set()
        return result

    monkeypatch.setattr(
        pipeline_engine.MLPipelineEngine, "train_and_evaluate",
        classmethod(lambda cls, *a, **kw: train_then_cancel(*a, **kw))
    )

    result = ExperimentManager.run_experiment(session, exp_id, cancel_event=cancel_event)

    assert result.status == "cancelled"
    assert result.error_message == "Cancelled by user."
    assert session.query(ExperimentMetric).filter_by(experiment_id=exp_id).count() == 0
    assert session.query(ExperimentArtifact).filter_by(experiment_id=exp_id).count() == 0


def test_full_async_cancel_via_registry_while_genuinely_in_flight(tmp_path):
    """End-to-end proof of the real wiring: run_experiment_background on an
    actual background thread, genuinely cancelled via
    ExperimentManager.cancel_experiment() (the same call the /cancel endpoint
    makes) while it's provably still running -- not pre-armed before the run
    starts. Uses an Event as the synchronization point instead of sleep-based
    polling to stay deterministic."""
    session = SessionLocal()
    try:
        csv_file = tmp_path / "async_cancel_data.csv"
        df = pd.DataFrame({"x1": list(range(20)), "target": [0, 1] * 10})
        df.to_csv(csv_file, index=False)
        sha256 = calculate_file_sha256(str(csv_file))

        proj = Project(name="Async Cancel Wiring Test", task_type="classification")
        session.add(proj)
        session.commit()

        dataset = Dataset(
            project_id=proj.id, filename="async_cancel_data.csv", file_path=str(csv_file),
            row_count=20, col_count=2, sha256_hash=sha256, target_column="target"
        )
        session.add(dataset)
        session.commit()

        exp = Experiment(
            project_id=proj.id, dataset_id=dataset.id, name="Cancel me async",
            model_type="logistic_regression", hyperparameters={},
            preprocessing_config={"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"},
            feature_selection=["x1"], target_column="target",
            random_seed=42, test_size=0.2, status="queued"
        )
        session.add(exp)
        session.commit()
        proj_id, exp_id = proj.id, exp.id
    finally:
        session.close()

    reached_mid_run = threading.Event()
    release = threading.Event()
    original_hash = em_module.calculate_file_sha256

    def blocking_hash(*args, **kwargs):
        reached_mid_run.set()
        release.wait(timeout=5)
        return original_hash(*args, **kwargs)

    try:
        with unittest.mock.patch.object(em_module, "calculate_file_sha256", side_effect=blocking_hash):
            thread = threading.Thread(target=ExperimentManager.run_experiment_background, args=(exp_id, 30))
            thread.start()
            assert reached_mid_run.wait(timeout=5), "run_experiment never reached its training phase"

            # At this point the row is genuinely "running" and a live cancel
            # handle is registered -- exactly what the real /cancel endpoint
            # depends on finding.
            check_session = SessionLocal()
            try:
                running_row = check_session.query(Experiment).filter_by(id=exp_id).first()
                assert running_row.status == "running"
            finally:
                check_session.close()

            was_signaled = ExperimentManager.cancel_experiment(exp_id)
            assert was_signaled is True

            release.set()
            thread.join(timeout=10)
            assert not thread.is_alive()

        verify_session = SessionLocal()
        try:
            final_row = verify_session.query(Experiment).filter_by(id=exp_id).first()
            assert final_row.status == "cancelled"
            assert verify_session.query(ExperimentMetric).filter_by(experiment_id=exp_id).count() == 0
            assert verify_session.query(ExperimentArtifact).filter_by(experiment_id=exp_id).count() == 0
        finally:
            verify_session.close()
    finally:
        cleanup_session = SessionLocal()
        proj_row = cleanup_session.query(Project).filter_by(id=proj_id).first()
        if proj_row:
            cleanup_session.delete(proj_row)
            cleanup_session.commit()
        cleanup_session.close()


# --- API-level guard rails ---

def _create_project(name):
    res = client.post("/api/projects/", json={"name": name, "task_type": "classification"})
    assert res.status_code == 200
    return res.json()["id"]

def _upload_dataset(project_id):
    csv_content = "f1,f2,target\n1,2,0\n3,4,1\n5,6,0\n7,8,1\n9,10,0\n11,12,1\n13,14,0\n15,16,1\n"
    files = {"file": ("data.csv", csv_content, "text/csv")}
    res = client.post(f"/api/datasets/upload?project_id={project_id}", files=files)
    assert res.status_code == 200
    return res.json()["id"]

def test_cancel_endpoint_rejects_already_completed_experiment():
    proj = _create_project("Cancel Endpoint Completed Test")
    ds = _upload_dataset(proj)
    create_res = client.post("/api/experiments/", json={
        "project_id": proj, "dataset_id": ds, "name": "Fast baseline",
        "model_type": "logistic_regression", "target_column": "target", "primary_metric": "f1"
    })
    exp_id = create_res.json()["id"]
    # TestClient runs the background task synchronously, so by the time
    # create_res is available this has already completed.
    settled = client.get(f"/api/experiments/{exp_id}")
    assert settled.json()["status"] == "completed"

    cancel_res = client.post(f"/api/experiments/{exp_id}/cancel")
    assert cancel_res.status_code == 400
    assert "already" in cancel_res.json()["detail"].lower()

    client.delete(f"/api/projects/{proj}")

def test_cancel_endpoint_rejects_unknown_experiment():
    res = client.post("/api/experiments/999999/cancel")
    assert res.status_code == 404

def test_cancel_endpoint_marks_queued_experiment_cancelled_without_a_live_handle():
    """A "queued" experiment with no in-memory registry entry (e.g. the
    process restarted, or it was inserted directly rather than through the
    normal create-and-dispatch flow) must still be cancellable via the
    race-safe DB fallback, not left stuck forever."""
    proj = _create_project("Cancel Endpoint Fallback Test")
    ds = _upload_dataset(proj)

    session = SessionLocal()
    try:
        exp = Experiment(
            project_id=proj, dataset_id=ds, name="Never dispatched",
            model_type="logistic_regression", hyperparameters={},
            preprocessing_config={"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"},
            feature_selection=[], target_column="target",
            random_seed=42, test_size=0.2, status="queued"
        )
        session.add(exp)
        session.commit()
        exp_id = exp.id
    finally:
        session.close()

    res = client.post(f"/api/experiments/{exp_id}/cancel")
    assert res.status_code == 200
    assert res.json()["status"] == "cancelled"

    client.delete(f"/api/projects/{proj}")
