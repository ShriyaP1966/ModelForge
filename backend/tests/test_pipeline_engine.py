import pytest
import pandas as pd
import numpy as np
from app.services.pipeline_engine import MLPipelineEngine

@pytest.fixture
def classification_data():
    np.random.seed(42)
    n = 60
    return pd.DataFrame({
        "num_feature": np.random.randn(n),
        "cat_feature": np.random.choice(["A", "B", "C"], size=n),
        "target": np.random.choice(["survived", "perished"], size=n)
    })

@pytest.fixture
def regression_data():
    np.random.seed(42)
    n = 60
    X1 = np.random.randn(n)
    X2 = np.random.randn(n)
    y = 3.0 * X1 + 2.0 * X2 + np.random.randn(n) * 0.1
    return pd.DataFrame({
        "feat_1": X1,
        "feat_2": X2,
        "price": y
    })

@pytest.mark.parametrize("model_type", [
    "logistic_regression", "knn", "decision_tree", "random_forest", "svm", "gradient_boosting"
])
def test_all_classification_models(classification_data, model_type):
    res = MLPipelineEngine.train_and_evaluate(
        df=classification_data,
        target_column="target",
        task_type="classification",
        model_type=model_type,
        hyperparameters={},
        preprocessing_config={"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"},
        test_size=0.25,
        random_seed=42
    )
    assert res["pipeline"] is not None
    assert len(res["y_val_pred"]) == len(res["y_val"])
    assert len(res["feature_importances"]) > 0

@pytest.mark.parametrize("model_type", [
    "linear_regression", "ridge", "lasso", "decision_tree_regressor", "random_forest_regressor", "gradient_boosting_regressor"
])
def test_all_regression_models(regression_data, model_type):
    res = MLPipelineEngine.train_and_evaluate(
        df=regression_data,
        target_column="price",
        task_type="regression",
        model_type=model_type,
        hyperparameters={},
        preprocessing_config={"scaler": "minmax", "imputer_strategy": "median"},
        test_size=0.25,
        random_seed=42
    )
    assert res["pipeline"] is not None
    assert len(res["y_val_pred"]) == len(res["y_val"])


def test_cross_validation_disabled_by_default(classification_data):
    """cross_validation_folds defaults to 0 -- CV must not run, and the
    existing single train/val split behavior must be completely unaffected."""
    res = MLPipelineEngine.train_and_evaluate(
        df=classification_data,
        target_column="target",
        task_type="classification",
        model_type="logistic_regression",
        hyperparameters={},
        preprocessing_config={"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"},
        test_size=0.25,
        random_seed=42
    )
    assert res["cross_validation"] is None
    assert res["pipeline"] is not None

def test_cross_validation_runs_and_reports_fold_scores(classification_data):
    res = MLPipelineEngine.train_and_evaluate(
        df=classification_data,
        target_column="target",
        task_type="classification",
        model_type="logistic_regression",
        hyperparameters={},
        preprocessing_config={"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"},
        test_size=0.25,
        random_seed=42,
        cross_validation_folds=5,
        primary_metric="f1"
    )
    cv = res["cross_validation"]
    assert cv is not None
    assert cv["error"] is None
    assert cv["effective_folds"] == 5
    assert len(cv["scores"]) == 5
    assert cv["mean"] is not None
    assert cv["std"] is not None
    # cross_val_score fits/evaluates independently of the single split above --
    # this must not have mutated or replaced that split's own result.
    assert len(res["y_val_pred"]) == len(res["y_val"])

def test_cross_validation_gracefully_reduces_folds_for_tiny_imbalanced_data():
    """Requesting more folds than the minority class has rows must not crash
    the experiment -- it should transparently reduce the fold count and say so,
    the same 'fail gracefully, never crash the run' philosophy used everywhere
    else in this pipeline."""
    np.random.seed(1)
    df = pd.DataFrame({
        "amount": np.random.uniform(10, 500, size=21),
        "fraud": [0] * 19 + [1] * 2
    })
    res = MLPipelineEngine.train_and_evaluate(
        df=df,
        target_column="fraud",
        task_type="classification",
        model_type="random_forest",
        hyperparameters={},
        preprocessing_config={"scaler": "standard", "imputer_strategy": "mean"},
        test_size=0.2,
        random_seed=42,
        cross_validation_folds=10,
        primary_metric="f1"
    )
    cv = res["cross_validation"]
    assert cv is not None
    assert cv["requested_folds"] == 10
    assert cv["effective_folds"] <= 2  # minority class only has 2 rows
    assert cv["error"] is None

def test_cross_validation_reports_unsupported_metric_without_crashing(regression_data):
    res = MLPipelineEngine.train_and_evaluate(
        df=regression_data,
        target_column="price",
        task_type="regression",
        model_type="linear_regression",
        hyperparameters={},
        preprocessing_config={"scaler": "minmax", "imputer_strategy": "median"},
        test_size=0.25,
        random_seed=42,
        cross_validation_folds=5,
        primary_metric="not_a_real_metric"
    )
    cv = res["cross_validation"]
    assert cv is not None
    assert cv["error"] is not None
    assert cv["mean"] is None
