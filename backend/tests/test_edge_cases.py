import pytest
import pandas as pd
import numpy as np
from app.services.dataset_analyzer import DatasetAnalyzer
from app.services.pipeline_engine import MLPipelineEngine
from app.services.evaluation_engine import EvaluationEngine

def test_edge_case_empty_dataset():
    df = pd.DataFrame()
    report = DatasetAnalyzer.analyze(df)
    assert report["row_count"] == 0
    assert report["health_status"] == "Critical"

def test_edge_case_all_null_column():
    df = pd.DataFrame({
        "all_null": [np.nan, np.nan, np.nan, np.nan, np.nan],
        "feature_1": [1.0, 2.0, 3.0, 4.0, 5.0],
        "target": [0, 1, 0, 1, 0]
    })
    report = DatasetAnalyzer.analyze(df)
    null_col = next(c for c in report["columns"] if c["name"] == "all_null")
    assert null_col["missing_pct"] == 100.0

def test_edge_case_one_class_target_fails_safely():
    df = pd.DataFrame({
        "feature": [1, 2, 3, 4, 5],
        "single_class_target": [1, 1, 1, 1, 1]
    })
    with pytest.raises(ValueError, match="at least 2 distinct classes"):
        MLPipelineEngine.prepare_data(
            df=df,
            target_column="single_class_target",
            task_type="classification"
        )

def test_edge_case_missing_target_column():
    df = pd.DataFrame({
        "feature_1": [1, 2, 3],
        "feature_2": [4, 5, 6]
    })
    with pytest.raises(ValueError, match="not found in dataset"):
        MLPipelineEngine.prepare_data(
            df=df,
            target_column="non_existent_target",
            task_type="classification"
        )

def test_edge_case_categorical_only_data():
    df = pd.DataFrame({
        "cat1": ["red", "blue", "green", "red", "blue", "green", "red", "blue", "green", "red"],
        "cat2": ["S", "M", "L", "S", "M", "L", "S", "M", "L", "S"],
        "target": [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]
    })
    res = MLPipelineEngine.train_and_evaluate(
        df=df,
        target_column="target",
        task_type="classification",
        model_type="decision_tree",
        hyperparameters={},
        preprocessing_config={"encoder": "onehot", "scaler": "none", "imputer_strategy": "most_frequent"},
        test_size=0.3,
        random_seed=42
    )
    assert res["pipeline"] is not None
    assert len(res["cat_features"]) == 2
    assert len(res["num_features"]) == 0

def test_edge_case_tiny_imbalanced_dataset_confusion_matrix_full_shape():
    """Regression test for the live audit finding: training on a tiny,
    severely imbalanced dataset (mirrors sample_data/problematic_dataset.csv)
    produced a validation split containing only the majority class, which
    collapsed the confusion matrix to a smaller-than-expected shape. The
    full end-to-end pipeline + evaluation must always return a confusion
    matrix whose shape matches the full label space."""
    np.random.seed(42)
    n = 21
    df = pd.DataFrame({
        "amount": np.random.uniform(10, 500, size=n),
        "risk_score": np.random.uniform(0, 1, size=n),
        # 19 of class 0, 2 of class 1 -- same ~90:10 imbalance as the app's
        # own stress-test dataset.
        "fraud": [0] * 19 + [1] * 2
    })

    pipeline_result = MLPipelineEngine.train_and_evaluate(
        df=df,
        target_column="fraud",
        task_type="classification",
        model_type="random_forest",
        hyperparameters={},
        preprocessing_config={"scaler": "standard", "imputer_strategy": "mean", "encoder": "onehot"},
        test_size=0.2,
        random_seed=42
    )

    classes = list(pipeline_result["label_encoder"].classes_)
    eval_result = EvaluationEngine.evaluate_classification(
        y_train=pipeline_result["y_train"],
        y_train_pred=pipeline_result["y_train_pred"],
        y_val=pipeline_result["y_val"],
        y_val_pred=pipeline_result["y_val_pred"],
        y_val_proba=pipeline_result["y_val_proba"],
        classes=classes
    )

    cm = eval_result["confusion_matrix"]["matrix"]
    labels = eval_result["confusion_matrix"]["labels"]

    assert len(labels) == len(classes) == 2
    assert len(cm) == len(labels)
    assert all(len(row) == len(labels) for row in cm)

def test_edge_case_numerical_only_data():
    df = pd.DataFrame({
        "n1": [1.2, 3.4, 5.6, 7.8, 9.0, 2.3, 4.5, 6.7, 8.9, 1.1],
        "n2": [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        "target": [1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    })
    res = MLPipelineEngine.train_and_evaluate(
        df=df,
        target_column="target",
        task_type="classification",
        model_type="logistic_regression",
        hyperparameters={},
        preprocessing_config={"scaler": "standard", "imputer_strategy": "mean"},
        test_size=0.3,
        random_seed=42
    )
    assert res["pipeline"] is not None
    assert len(res["num_features"]) == 2
    assert len(res["cat_features"]) == 0
