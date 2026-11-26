"""Sample experiments for the bundled demo projects.

Each project gets a short lineage where every run changes one thing from its
parent, so the lineage graph, diff view and evolution chart have something real
to show the first time the app opens.
"""
import threading
from typing import Any

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.entities import Dataset, Experiment, Project
from app.services.experiment_manager import ExperimentManager

_seed_lock = threading.Lock()

TITANIC_BASE_FEATURES = ["Pclass", "Sex", "Age", "Fare"]
TITANIC_EXTENDED_FEATURES = [*TITANIC_BASE_FEATURES, "SibSp", "Parch", "Embarked"]

# Project name -> runs in creation order. `parent` is an index into the same list.
SAMPLE_EXPERIMENTS: dict[str, list[dict[str, Any]]] = {
    "Titanic Passenger Survival": [
        {
            "name": "Baseline: logistic regression",
            "description": "Starting point: four obvious features, no scaling.",
            "model_type": "logistic_regression",
            "preprocessing": {"imputer_strategy": "mean", "scaler": "none", "encoder": "onehot"},
            "features": TITANIC_BASE_FEATURES,
            "parent": None,
        },
        {
            "name": "Standardize numeric features",
            "description": "Same model and features; scale Age and Fare so they do not dominate optimization.",
            "model_type": "logistic_regression",
            "preprocessing": {"imputer_strategy": "mean", "scaler": "standard", "encoder": "onehot"},
            "features": TITANIC_BASE_FEATURES,
            "parent": 0,
        },
        {
            "name": "Add family size and port of embarkation",
            "description": "Add SibSp, Parch and Embarked, and impute missing values with the median.",
            "model_type": "logistic_regression",
            "preprocessing": {"imputer_strategy": "median", "scaler": "standard", "encoder": "onehot"},
            "features": TITANIC_EXTENDED_FEATURES,
            "parent": 1,
        },
        {
            "name": "Random forest",
            "description": "Swap the linear model for a depth-limited random forest to capture interactions.",
            "model_type": "random_forest",
            "hyperparameters": {"n_estimators": 100, "max_depth": 5},
            "preprocessing": {"imputer_strategy": "median", "scaler": "standard", "encoder": "onehot"},
            "features": TITANIC_EXTENDED_FEATURES,
            "cross_validation_folds": 3,
            "parent": 2,
        },
        {
            "name": "Gradient boosting",
            "description": "A shallow boosted ensemble on the same features, branched from the logistic model.",
            "model_type": "gradient_boosting",
            "hyperparameters": {"n_estimators": 60, "learning_rate": 0.05, "max_depth": 2},
            "preprocessing": {"imputer_strategy": "median", "scaler": "standard", "encoder": "onehot"},
            "features": TITANIC_EXTENDED_FEATURES,
            "parent": 2,
        },
    ],
    "California Housing Valuation": [
        {
            "name": "Baseline: linear regression",
            "description": "Ordinary least squares on raw features.",
            "model_type": "linear_regression",
            "preprocessing": {"imputer_strategy": "mean", "scaler": "none", "encoder": "onehot"},
            "parent": None,
        },
        {
            "name": "Ridge on standardized features",
            "description": "Standardize features and add L2 regularization.",
            "model_type": "ridge",
            "hyperparameters": {"alpha": 1.0},
            "preprocessing": {"imputer_strategy": "mean", "scaler": "standard", "encoder": "onehot"},
            "parent": 0,
        },
        {
            "name": "Random forest regressor",
            "description": "Non-linear ensemble to capture geographic effects.",
            "model_type": "random_forest_regressor",
            "hyperparameters": {"n_estimators": 50, "max_depth": 6},
            "preprocessing": {"imputer_strategy": "mean", "scaler": "standard", "encoder": "onehot"},
            "parent": 1,
        },
        {
            "name": "Gradient boosting regressor",
            "description": "Shallow boosted trees with a small learning rate.",
            "model_type": "gradient_boosting_regressor",
            "hyperparameters": {"n_estimators": 80, "learning_rate": 0.05, "max_depth": 2},
            "preprocessing": {"imputer_strategy": "mean", "scaler": "standard", "encoder": "onehot"},
            "parent": 1,
        },
    ],
}


def seed_sample_experiments(db: Session) -> list[int]:
    """Create and run the sample experiments for demo projects that have none yet.

    Runs synchronously; call `start_background_seeding` from request handlers or
    startup. Returns the ids of the experiments that were created.
    """
    created: list[int] = []
    with _seed_lock:
        for project_name, runs in SAMPLE_EXPERIMENTS.items():
            project = db.query(Project).filter(Project.name == project_name).first()
            if not project:
                continue
            if db.query(Experiment).filter(Experiment.project_id == project.id).count() > 0:
                continue
            dataset = db.query(Dataset).filter(Dataset.project_id == project.id).first()
            if not dataset or not dataset.target_column:
                continue

            is_classification = project.task_type == "classification"
            ids: list[int] = []
            for run in runs:
                exp = Experiment(
                    project_id=project.id,
                    dataset_id=dataset.id,
                    parent_id=ids[run["parent"]] if run["parent"] is not None else None,
                    name=run["name"],
                    description=run["description"],
                    model_type=run["model_type"],
                    hyperparameters=run.get("hyperparameters", {}),
                    preprocessing_config=run["preprocessing"],
                    feature_selection=run.get("features", []),
                    target_column=dataset.target_column,
                    random_seed=42,
                    test_size=0.25,
                    cross_validation_folds=run.get("cross_validation_folds", 0),
                    primary_metric="f1" if is_classification else "rmse",
                    status="queued",
                )
                db.add(exp)
                db.commit()
                db.refresh(exp)
                ids.append(exp.id)
                ExperimentManager.run_experiment(db=db, experiment_id=exp.id)
            created.extend(ids)
    return created


def _seed_in_new_session() -> None:
    db = SessionLocal()
    try:
        seed_sample_experiments(db)
    except Exception as e:  # never take the server down over demo data
        print(f"Sample experiment seeding notice: {e}")
    finally:
        db.close()


def start_background_seeding() -> threading.Thread:
    """Seed sample experiments on a daemon thread so requests are not blocked."""
    thread = threading.Thread(target=_seed_in_new_session, name="seed-sample-experiments", daemon=True)
    thread.start()
    return thread
