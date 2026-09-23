import pytest
import numpy as np
from app.services.evaluation_engine import EvaluationEngine

def test_evaluation_classification():
    y_train = np.array([0, 1, 0, 1, 1, 0, 1, 0])
    y_train_pred = np.array([0, 1, 0, 1, 1, 0, 1, 0])
    
    y_val = np.array([0, 1, 0, 1])
    y_val_pred = np.array([0, 1, 0, 0])
    
    res = EvaluationEngine.evaluate_classification(
        y_train=y_train,
        y_train_pred=y_train_pred,
        y_val=y_val,
        y_val_pred=y_val_pred
    )
    
    assert "accuracy" in res["validation_metrics"]
    assert "f1" in res["validation_metrics"]
    assert "confusion_matrix" in res
    assert "overfitting" in res
    assert res["validation_metrics"]["accuracy"] == 0.75
    # Train accuracy is 1.0, val is 0.75, so gap is observed
    assert res["overfitting"]["gap"] > 0

def test_confusion_matrix_shape_binary_class_absent_from_val():
    """Regression test: on a tiny/imbalanced split, y_val may only contain one
    class. Previously confusion_matrix() had no `labels=`, so sklearn sized the
    matrix by classes observed in y_val/y_val_pred only, producing e.g. a 1x1
    matrix while `confusion_matrix.labels` (from the label encoder) reported 2
    classes -- a shape mismatch that broke frontend rendering."""
    y_train = np.array([0, 0, 0, 1, 0, 0, 0, 0, 0, 0])
    y_train_pred = np.array([0, 0, 0, 1, 0, 0, 0, 0, 0, 0])

    # Validation split contains only class 0 (class 1 entirely absent) -- this
    # happens routinely on small/imbalanced datasets like the app's own
    # problematic_dataset.csv stress test.
    y_val = np.array([0, 0, 0, 0, 0])
    y_val_pred = np.array([0, 0, 0, 0, 0])

    res = EvaluationEngine.evaluate_classification(
        y_train=y_train,
        y_train_pred=y_train_pred,
        y_val=y_val,
        y_val_pred=y_val_pred,
        classes=["0", "1"]
    )

    cm = res["confusion_matrix"]["matrix"]
    labels = res["confusion_matrix"]["labels"]

    assert labels == ["0", "1"]
    # Matrix must be square and match the full label space, not collapse to 1x1.
    assert len(cm) == len(labels) == 2
    assert all(len(row) == len(labels) for row in cm)
    # All 5 validation rows are true-class-0, predicted-class-0.
    assert cm[0][0] == 5
    assert cm[0][1] == 0
    assert cm[1] == [0, 0]


def test_confusion_matrix_shape_class_absent_from_predictions():
    """A model that never predicts one of the known classes (e.g. always
    predicts the majority class) must still produce a full-shaped matrix,
    with a zero column for the unpredicted class rather than a collapsed
    matrix."""
    y_train = np.array([0, 1, 0, 1, 0, 1])
    y_train_pred = np.array([0, 1, 0, 1, 0, 1])

    y_val = np.array([0, 1, 0, 1])
    y_val_pred = np.array([0, 0, 0, 0])  # never predicts class 1

    res = EvaluationEngine.evaluate_classification(
        y_train=y_train,
        y_train_pred=y_train_pred,
        y_val=y_val,
        y_val_pred=y_val_pred,
        classes=["0", "1"]
    )

    cm = res["confusion_matrix"]["matrix"]
    assert len(cm) == 2 and all(len(row) == 2 for row in cm)
    # True class 1 rows: 2 predicted as 0, 0 predicted as 1.
    assert cm[1] == [2, 0]


def test_confusion_matrix_shape_multiclass():
    """Multiclass confusion matrix must be sized to the full label space even
    when not every class appears in every split."""
    y_train = np.array([0, 1, 2, 0, 1, 2, 0, 1, 2])
    y_train_pred = np.array([0, 1, 2, 0, 1, 2, 0, 1, 2])

    # Validation split is missing class 2 entirely.
    y_val = np.array([0, 1, 0, 1])
    y_val_pred = np.array([0, 1, 1, 1])

    res = EvaluationEngine.evaluate_classification(
        y_train=y_train,
        y_train_pred=y_train_pred,
        y_val=y_val,
        y_val_pred=y_val_pred,
        classes=["0", "1", "2"]
    )

    cm = res["confusion_matrix"]["matrix"]
    labels = res["confusion_matrix"]["labels"]
    assert labels == ["0", "1", "2"]
    assert len(cm) == 3 and all(len(row) == 3 for row in cm)
    # Class 2 row/column should be all zeros since it never appears.
    assert cm[2] == [0, 0, 0]
    assert [row[2] for row in cm] == [0, 0, 0]


def test_confusion_matrix_shape_no_classes_arg_falls_back_to_observed_union():
    """When called without an explicit `classes` list (e.g. direct unit calls
    without a label encoder), the matrix should still cover the union of
    classes observed across train and val, not just val alone."""
    y_train = np.array([0, 1, 2, 0, 1, 2])
    y_train_pred = np.array([0, 1, 2, 0, 1, 2])

    # val only contains classes 0 and 1; class 2 only appears in train.
    y_val = np.array([0, 1, 0, 1])
    y_val_pred = np.array([0, 1, 0, 1])

    res = EvaluationEngine.evaluate_classification(
        y_train=y_train,
        y_train_pred=y_train_pred,
        y_val=y_val,
        y_val_pred=y_val_pred
    )

    labels = res["confusion_matrix"]["labels"]
    cm = res["confusion_matrix"]["matrix"]
    assert labels == ["0", "1", "2"]
    assert len(cm) == 3 and all(len(row) == 3 for row in cm)


def test_evaluation_regression():
    y_train = np.array([10.0, 20.0, 30.0, 40.0])
    y_train_pred = np.array([10.1, 19.9, 30.0, 39.8])
    
    y_val = np.array([15.0, 25.0])
    y_val_pred = np.array([14.9, 25.2])
    
    res = EvaluationEngine.evaluate_regression(
        y_train=y_train,
        y_train_pred=y_train_pred,
        y_val=y_val,
        y_val_pred=y_val_pred
    )
    
    assert "rmse" in res["validation_metrics"]
    assert "r2" in res["validation_metrics"]
    assert "residuals" in res
