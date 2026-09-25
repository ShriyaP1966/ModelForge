import pytest
import pandas as pd
import numpy as np
from app.services.dataset_analyzer import DatasetAnalyzer

def test_analyze_normal_dataset():
    df = pd.DataFrame({
        "age": [25, 30, 45, 35, 22, 50, 60, 40],
        "salary": [50000, 60000, 80000, 75000, 48000, 95000, 110000, 72000],
        "department": ["IT", "HR", "IT", "Sales", "HR", "IT", "Sales", "HR"],
        "target": [0, 1, 0, 1, 0, 1, 1, 0]
    })
    
    result = DatasetAnalyzer.analyze(df, target_candidate="target")
    
    assert result["row_count"] == 8
    assert result["col_count"] == 4
    assert result["duplicate_rows"] == 0
    assert result["health_score"] > 50
    assert "target" in result["potential_targets"]
    assert len(result["columns"]) == 4

def test_analyze_leakage_detection():
    # Construct synthetic leakage
    df = pd.DataFrame({
        "feature_1": np.random.randn(50),
        "target": np.random.choice([0, 1], size=50),
    })
    # Perfect leak column
    df["leak_target_copy"] = df["target"]
    
    result = DatasetAnalyzer.analyze(df, target_candidate="target")
    leak_warnings = result["leakage_warnings"]
    assert len(leak_warnings) > 0
    leak_cols = [w["column"] for w in leak_warnings]
    assert "leak_target_copy" in leak_cols

def test_analyze_constant_column():
    df = pd.DataFrame({
        "constant_col": [1, 1, 1, 1, 1],
        "normal_col": [10, 20, 30, 40, 50],
        "label": [0, 1, 0, 1, 0]
    })
    result = DatasetAnalyzer.analyze(df)
    const_cols = [c["name"] for c in result["columns"] if c["is_constant"]]
    assert "constant_col" in const_cols

def test_target_suggestions_rank_name_match_above_cardinality_heuristic():
    """Regression test: previously potential_targets was left in raw column
    order, so a column merely satisfying the weak "2-10 unique values"
    cardinality heuristic (here: 'a') could outrank an explicitly-named
    target column ('target') just because it appeared earlier in the file.
    Name-matched candidates must now be ranked first."""
    df = pd.DataFrame({
        "a": [1, 2, 3, 4, 5],       # numeric, 5 unique values -- weak cardinality-only signal
        "b": [5, 4, 3, 2, 1],       # same
        "target": [0, 1, 0, 1, 0],  # explicit name match -- strongest signal
    })
    result = DatasetAnalyzer.analyze(df)
    assert result["potential_targets"][0] == "target"

def test_target_suggestions_rank_last_column_above_cardinality_heuristic():
    """The last-column convention is a stronger signal than a bare cardinality
    match, and should be ranked above it even without a name hint."""
    df = pd.DataFrame({
        "category_code": ["A", "B", "A", "B", "A"],  # cardinality-only heuristic
        "outcome_value": [10, 20, 30, 40, 50],        # last column, no name hint
    })
    result = DatasetAnalyzer.analyze(df)
    assert result["potential_targets"][0] == "outcome_value"

def test_target_suggestions_rank_exact_name_match_above_substring_match():
    """Regression test found during final end-to-end QA: the bundled
    problematic_dataset.csv has columns in the order
    ...,leakage_label_copy,fraud -- both matched the name-heuristic tier
    (leakage_label_copy only because it contains "label" as a substring),
    so the stable sort's column-order tiebreak let the simulated leakage
    column win over the real target just because it appears first. An
    exact keyword match ("fraud") must outrank a mere substring match
    ("leakage_label_copy" containing "label"), regardless of column order."""
    df = pd.DataFrame({
        "transaction_id": [f"TX_{i}" for i in range(20)],
        "leakage_label_copy": [0, 1] * 10,  # appears first, substring match on "label"
        "fraud": [0, 1] * 10,               # appears second, exact match
    })
    result = DatasetAnalyzer.analyze(df)
    assert result["potential_targets"][0] == "fraud"

def test_analyze_numeric_column_includes_histogram_for_distribution_chart():
    df = pd.DataFrame({
        "age": [22, 25, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
        "constant_col": [1] * 12,
        "label": [0, 1] * 6
    })
    result = DatasetAnalyzer.analyze(df)
    age_col = next(c for c in result["columns"] if c["name"] == "age")
    const_col = next(c for c in result["columns"] if c["name"] == "constant_col")

    assert "histogram" in age_col["stats"]
    hist = age_col["stats"]["histogram"]
    assert len(hist["bin_edges"]) == len(hist["counts"]) + 1
    assert sum(hist["counts"]) == 12

    # A constant column has no distribution shape to plot -- histogram should
    # be omitted rather than a degenerate single bin.
    assert "histogram" not in const_col["stats"]
