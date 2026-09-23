import pytest
import os
import pandas as pd
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.entities import Project, Dataset, Experiment
from app.services.experiment_manager import ExperimentManager
from app.services.reproducibility_service import ReproducibilityService
from app.services.dataset_analyzer import calculate_file_sha256, load_dataset
from app.services.pipeline_engine import MLPipelineEngine

@pytest.fixture
def in_memory_db(tmp_path):
    db_file = tmp_path / "test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create dummy csv
    csv_file = tmp_path / "data.csv"
    df = pd.DataFrame({
        "x1": [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
        "target": [0, 0, 0, 0, 0, 1, 1, 1, 1, 1]
    })
    df.to_csv(csv_file, index=False)
    sha256 = calculate_file_sha256(str(csv_file))

    proj = Project(name="Test Reproducibility", task_type="classification")
    session.add(proj)
    session.commit()

    dataset = Dataset(
        project_id=proj.id,
        filename="data.csv",
        file_path=str(csv_file),
        row_count=10,
        col_count=2,
        sha256_hash=sha256,
        target_column="target"
    )
    session.add(dataset)
    session.commit()

    exp = Experiment(
        project_id=proj.id,
        dataset_id=dataset.id,
        name="Repro Run",
        model_type="logistic_regression",
        hyperparameters={},
        preprocessing_config={"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"},
        feature_selection=["x1"],
        target_column="target",
        random_seed=123,
        test_size=0.2,
        status="queued"
    )
    session.add(exp)
    session.commit()

    ExperimentManager.run_experiment(session, exp.id)

    yield session, exp.id, str(csv_file)
    session.close()

def test_reproduce_exact_match(in_memory_db):
    session, exp_id, _ = in_memory_db
    res = ReproducibilityService.reproduce(session, exp_id, tolerance=1e-4)
    
    assert res["reproduced_successfully"] is True
    assert res["dataset_match"] is True
    assert res["within_tolerance"] is True
    assert len(res["original_metrics"]) > 0
    # Every metric difference should be 0.0 or <= 1e-4
    for metric, diff in res["metric_differences"].items():
        assert diff <= 1e-4

def test_reproduce_tampered_dataset_fails(in_memory_db):
    session, exp_id, csv_path = in_memory_db
    # Tamper with the dataset file
    with open(csv_path, "a") as f:
        f.write("99.0,1\n")

    res = ReproducibilityService.reproduce(session, exp_id)
    assert res["dataset_match"] is False
    assert res["within_tolerance"] is False
    assert "fingerprint mismatch" in res["message"].lower()

def test_experiment_persists_all_fields_reproduction_depends_on(in_memory_db):
    """Phase 4 verification: seed, target, feature list, preprocessing
    configuration, model, hyperparameters, and validation configuration
    (test_size) must all be genuinely persisted on the Experiment row --
    not just accepted and discarded -- since reproduce() reads every one of
    these directly off that row."""
    session, exp_id, _ = in_memory_db
    exp = session.get(Experiment, exp_id)

    assert exp.random_seed == 123
    assert exp.target_column == "target"
    assert exp.feature_selection == ["x1"]
    assert exp.preprocessing_config == {"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"}
    assert exp.model_type == "logistic_regression"
    assert exp.hyperparameters == {}
    assert exp.test_size == 0.2
    assert exp.dataset_fingerprint is not None and len(exp.dataset_fingerprint) == 64

def test_persisted_fields_reconstruct_the_exact_pipeline_reproduction_relies_on(in_memory_db):
    """Reproduction itself only returns metrics, not the trained pipeline, so
    this verifies the same code path directly: reading model_type,
    hyperparameters, preprocessing_config, feature_selection, test_size and
    random_seed back off a persisted Experiment row and feeding them into
    MLPipelineEngine.train_and_evaluate (exactly what reproduce() does)
    reconstructs a pipeline whose structure matches the original
    configuration -- proving these fields are actually used, not just stored."""
    session, exp_id, csv_path = in_memory_db
    exp = session.get(Experiment, exp_id)
    dataset = session.query(Dataset).filter(Dataset.id == exp.dataset_id).first()

    df = load_dataset(dataset.file_path)
    result = MLPipelineEngine.train_and_evaluate(
        df=df,
        target_column=exp.target_column,
        task_type="classification",
        model_type=exp.model_type,
        hyperparameters=exp.hyperparameters or {},
        preprocessing_config=exp.preprocessing_config or {},
        feature_columns=exp.feature_selection,
        test_size=exp.test_size or 0.2,
        random_seed=exp.random_seed or 42,
    )

    assert type(result["pipeline"].named_steps["model"]).__name__ == "LogisticRegression"
    assert result["num_features"] == ["x1"]  # exactly the persisted feature_selection, not all columns
    assert result["cat_features"] == []
    assert len(result["y_val"]) == round(10 * exp.test_size)  # persisted test_size drove the split size
