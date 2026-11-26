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


def test_per_class_metrics_match_hand_computed_values():
    # Rows are true classes, columns are predictions.
    matrix = [[8, 2], [1, 4]]
    rows = EvaluationEngine.per_class_metrics(matrix, ["no", "yes"])

    assert [r["label"] for r in rows] == ["no", "yes"]
    assert rows[0]["support"] == 10
    assert rows[1]["support"] == 5
    # class "no": precision 8/9, recall 8/10
    assert rows[0]["precision"] == round(8 / 9, 4)
    assert rows[0]["recall"] == 0.8
    # class "yes": precision 4/6, recall 4/5
    assert rows[1]["precision"] == round(4 / 6, 4)
    assert rows[1]["recall"] == 0.8


def test_per_class_metrics_handles_class_that_is_never_predicted():
    rows = EvaluationEngine.per_class_metrics([[5, 0], [3, 0]], ["a", "b"])

    assert rows[1]["precision"] == 0.0
    assert rows[1]["recall"] == 0.0
    assert rows[1]["f1"] == 0.0
    assert rows[1]["support"] == 3


def test_threshold_analysis_counts_are_consistent_at_every_threshold():
    y_val = np.array([0, 0, 1, 1, 1, 0])
    proba = np.array([0.1, 0.4, 0.35, 0.8, 0.9, 0.6])

    res = EvaluationEngine.threshold_analysis(y_val, proba, negative_label="no", positive_label="yes")

    assert res["thresholds"][0] == 0.0 and res["thresholds"][-1] == 1.0
    assert len(res["thresholds"]) == len(res["tp"]) == len(res["fn"])
    for tp, fp, tn, fn in zip(res["tp"], res["fp"], res["tn"], res["fn"], strict=True):
        assert tp + fp + tn + fn == len(y_val)
    # Threshold 0 predicts everything positive; raising it can only lose positives.
    assert res["tp"][0] == 3 and res["fp"][0] == 3
    assert res["tp"] == sorted(res["tp"], reverse=True)
    assert res["positive_label"] == "yes"


def test_threshold_analysis_at_half_matches_manual_confusion_matrix():
    y_val = np.array([0, 0, 1, 1, 1, 0])
    proba = np.array([0.1, 0.4, 0.35, 0.8, 0.9, 0.6])

    res = EvaluationEngine.threshold_analysis(y_val, proba, negative_label="no", positive_label="yes")
    i = res["thresholds"].index(0.5)

    # predicted positive: samples with proba >= 0.5 -> indices 3, 4, 5
    assert (res["tp"][i], res["fp"][i], res["tn"][i], res["fn"][i]) == (2, 1, 2, 1)


def test_evaluate_classification_includes_threshold_and_per_class_data_for_binary():
    y = np.array([0, 1, 0, 1, 1, 0])
    proba = np.array([[0.9, 0.1], [0.2, 0.8], [0.7, 0.3], [0.4, 0.6], [0.1, 0.9], [0.55, 0.45]])

    res = EvaluationEngine.evaluate_classification(
        y_train=y, y_train_pred=y, y_val=y, y_val_pred=(proba[:, 1] >= 0.5).astype(int),
        y_val_proba=proba, classes=["no", "yes"],
    )

    assert res["threshold_analysis"]["positive_label"] == "yes"
    assert [c["label"] for c in res["per_class_metrics"]] == ["no", "yes"]


def test_evaluate_classification_skips_threshold_analysis_without_probabilities():
    y = np.array([0, 1, 0, 1])

    res = EvaluationEngine.evaluate_classification(
        y_train=y, y_train_pred=y, y_val=y, y_val_pred=y, classes=["no", "yes"],
    )

    assert res["threshold_analysis"] is None
    assert len(res["per_class_metrics"]) == 2


def test_evaluate_classification_skips_threshold_analysis_for_multiclass():
    y = np.array([0, 1, 2, 0, 1, 2])
    proba = np.eye(3)[y]

    res = EvaluationEngine.evaluate_classification(
        y_train=y, y_train_pred=y, y_val=y, y_val_pred=y, y_val_proba=proba, classes=["a", "b", "c"],
    )

    assert res["threshold_analysis"] is None
    assert len(res["per_class_metrics"]) == 3
