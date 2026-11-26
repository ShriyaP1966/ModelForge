import pytest

from app.api.endpoints import projects as projects_endpoint
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.entities import Experiment, Project
from app.services.demo_seed import SAMPLE_EXPERIMENTS, seed_sample_experiments


@pytest.fixture
def db(monkeypatch):
    # The project seeder normally kicks off a background thread; this test runs
    # the experiment seeding itself so it can inspect the result deterministically.
    monkeypatch.setattr(projects_endpoint, "start_background_seeding", lambda: None)
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    projects_endpoint.seed_sample_projects(session)
    yield session
    session.close()


def _experiments(db, project_name):
    project = db.query(Project).filter(Project.name == project_name).first()
    return db.query(Experiment).filter(Experiment.project_id == project.id).order_by(Experiment.id).all()


def test_seeding_creates_a_completed_lineage_for_each_sample_project(db):
    seed_sample_experiments(db)

    for project_name, runs in SAMPLE_EXPERIMENTS.items():
        experiments = _experiments(db, project_name)
        assert len(experiments) == len(runs)
        assert [e.status for e in experiments] == ["completed"] * len(runs), [e.error_message for e in experiments]
        assert all(e.metrics for e in experiments)

        # Lineage mirrors the spec: the first run is a baseline, every other run has a parent.
        assert experiments[0].parent_id is None
        for run, exp in zip(runs[1:], experiments[1:], strict=True):
            assert exp.parent_id == experiments[run["parent"]].id


def test_seeding_is_idempotent(db):
    seed_sample_experiments(db)
    before = db.query(Experiment).count()

    assert seed_sample_experiments(db) == []
    assert db.query(Experiment).count() == before


def test_seeding_skips_projects_that_already_have_experiments(db):
    titanic = db.query(Project).filter(Project.name == "Titanic Passenger Survival").first()
    existing = _experiments(db, titanic.name)
    if not existing:
        seed_sample_experiments(db)
        existing = _experiments(db, titanic.name)
    before = len(existing)

    seed_sample_experiments(db)

    assert len(_experiments(db, titanic.name)) == before
