import hashlib
import io
import re
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

def calculate_sha256(file_content: bytes) -> str:
    """Calculate SHA256 fingerprint for dataset byte stream."""
    return hashlib.sha256(file_content).hexdigest()

def calculate_file_sha256(file_path: str) -> str:
    """Calculate SHA256 fingerprint directly from disk file."""
    hasher = hashlib.sha256()
    with open(file_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def load_dataset(file_path: str) -> pd.DataFrame:
    """Robustly load dataset from CSV or Excel file."""
    if file_path.lower().endswith(".csv") or file_path.lower().endswith(".txt"):
        try:
            return pd.read_csv(file_path, sep=None, engine="python")
        except Exception:
            return pd.read_csv(file_path)
    elif file_path.lower().endswith((".xlsx", ".xls")):
        return pd.read_excel(file_path)
    else:
        # Default try CSV
        return pd.read_csv(file_path)

class DatasetAnalyzer:
    """Provides dataset health diagnostics, leakage checks, statistics, and visualizations data."""

    @staticmethod
    def infer_column_type(series: pd.Series, col_name: str) -> str:
        """Infer semantic column type."""
        non_null = series.dropna()
        if len(non_null) == 0:
            return "empty"
        
        lower_name = col_name.lower()
        if lower_name.endswith(("_id", "id")) or "uuid" in lower_name or "ssn" in lower_name:
            if series.nunique() / max(len(series), 1) > 0.8:
                return "id"

        if pd.api.types.is_bool_dtype(series):
            return "boolean"
        
        # Check datetime
        if pd.api.types.is_datetime64_any_dtype(series):
            return "datetime"
        
        # Try numeric
        if pd.api.types.is_numeric_dtype(series):
            # If only 2 unique values (0 and 1)
            unique_vals = set(non_null.unique())
            if unique_vals.issubset({0, 1, 0.0, 1.0}):
                return "boolean"
            return "numeric"
        
        # String or object
        unique_count = series.nunique()
        total_count = len(non_null)
        
        # If very high cardinality text
        if unique_count / total_count > 0.8 and total_count > 20:
            # Check avg string length
            avg_len = non_null.astype(str).str.len().mean()
            if avg_len > 30:
                return "text"
            return "id"
        
        return "categorical"

    @classmethod
    def analyze(cls, df: pd.DataFrame, target_candidate: Optional[str] = None) -> Dict[str, Any]:
        """Perform comprehensive dataset intelligence analysis."""
        row_count = len(df)
        col_count = len(df.columns)
        
        if row_count == 0 or col_count == 0:
            return {
                "row_count": row_count,
                "col_count": col_count,
                "duplicate_rows": 0,
                "total_missing_cells": 0,
                "missing_pct": 0.0,
                "health_score": 0.0,
                "health_status": "Critical",
                "columns": [],
                "potential_targets": [],
                "leakage_warnings": [{"column": "dataset", "reason": "Dataset is empty", "risk": "High"}],
                "correlation_matrix": {},
                "class_balance": None,
                "summary_notes": ["Dataset contains 0 rows or columns."]
            }

        duplicate_rows = int(df.duplicated().sum())
        total_cells = row_count * col_count
        total_missing = int(df.isna().sum().sum())
        missing_pct = round((total_missing / max(total_cells, 1)) * 100, 2)
        
        columns_info = []
        potential_targets = []
        target_confidences: Dict[str, int] = {}
        leakage_warnings = []
        summary_notes = []
        
        numeric_cols = []
        
        # Health deductions tracker
        health_penalties = 0
        
        if missing_pct > 25:
            health_penalties += 20
            summary_notes.append(f"High missing data rate: {missing_pct}% of dataset cells are missing.")
        elif missing_pct > 5:
            health_penalties += 8
            summary_notes.append(f"Moderate missing data: {missing_pct}% missing cells.")
            
        dup_pct = (duplicate_rows / row_count) * 100
        if dup_pct > 10:
            health_penalties += 15
            summary_notes.append(f"High duplicate rows count: {duplicate_rows} rows ({dup_pct:.1f}%).")
        elif duplicate_rows > 0:
            health_penalties += 5
            summary_notes.append(f"Found {duplicate_rows} duplicate rows.")

        if row_count < 30:
            health_penalties += 15
            summary_notes.append(f"Very small dataset size ({row_count} rows). Risk of high variance in evaluation.")

        for col in df.columns:
            series = df[col]
            missing_count = int(series.isna().sum())
            col_missing_pct = round((missing_count / row_count) * 100, 2)
            unique_count = int(series.nunique(dropna=True))
            inferred_type = cls.infer_column_type(series, str(col))
            is_constant = (unique_count <= 1)
            
            leakage_reasons = []
            is_leakage = False
            
            # Constant column check
            if is_constant:
                health_penalties += 4
                summary_notes.append(f"Column '{col}' is constant (zero variance).")
                
            # Identifier column warning
            if inferred_type == "id" and unique_count > 10:
                is_leakage = True
                leakage_reasons.append("High-cardinality identifier; may cause spurious memorization if used as feature.")

            # Name heuristic for leakage
            lower_name = str(col).lower()
            if any(term in lower_name for term in ["leak", "label_copy", "ground_truth", "proxy"]):
                is_leakage = True
                leakage_reasons.append("Column name strongly suggests synthetic or target proxy leakage.")

            # Compute stats
            stats: Dict[str, Any] = {}
            outlier_count = 0
            
            if inferred_type in ("numeric", "boolean"):
                numeric_cols.append(str(col))
                non_null = pd.to_numeric(series, errors="coerce").dropna()
                if len(non_null) > 0:
                    stats["min"] = float(non_null.min())
                    stats["max"] = float(non_null.max())
                    stats["mean"] = round(float(non_null.mean()), 4)
                    stats["std"] = round(float(non_null.std()), 4) if len(non_null) > 1 else 0.0
                    stats["median"] = round(float(non_null.median()), 4)
                    stats["q25"] = round(float(non_null.quantile(0.25)), 4)
                    stats["q75"] = round(float(non_null.quantile(0.75)), 4)
                    
                    # Outlier calculation via IQR
                    iqr = stats["q75"] - stats["q25"]
                    if iqr > 0:
                        lower_bound = stats["q25"] - 1.5 * iqr
                        upper_bound = stats["q75"] + 1.5 * iqr
                        outliers = non_null[(non_null < lower_bound) | (non_null > upper_bound)]
                        outlier_count = int(len(outliers))

                    # Histogram bins for distribution visualization. Skipped for
                    # constant columns (a single value has no meaningful shape).
                    if non_null.nunique() > 1:
                        bin_count = int(min(12, max(4, non_null.nunique())))
                        hist_counts, hist_edges = np.histogram(non_null.to_numpy(dtype=float), bins=bin_count)
                        stats["histogram"] = {
                            "bin_edges": [round(float(e), 4) for e in hist_edges],
                            "counts": [int(c) for c in hist_counts]
                        }
            else:
                # Categorical or text: top 5 frequent categories
                top_vals = series.dropna().value_counts().head(5).to_dict()
                stats["top_categories"] = {str(k): int(v) for k, v in top_vals.items()}

            # Target column candidate suggestion. Confidence tiers rank how
            # strong each signal is, so the caller (datasets.py, when no
            # explicit target is supplied on upload) can default to the most
            # confident guess rather than whichever column happens to appear
            # first: an explicit name match ("target", "label", ...) is much
            # stronger evidence than a column merely having a plausible
            # 2-10 unique-value cardinality, which many ordinary feature
            # columns also satisfy.
            is_target_cand = False
            target_confidence = 0
            if not is_constant and inferred_type != "id":
                if any(t in lower_name for t in ["target", "label", "survived", "fraud", "churn", "price", "medhouseval", "outcome", "class"]):
                    is_target_cand = True
                    target_confidence = 3  # explicit name match
                elif inferred_type == "numeric" and str(col) == df.columns[-1]:
                    is_target_cand = True
                    target_confidence = 2  # last-column convention
                elif 2 <= unique_count <= 10 and inferred_type in ("categorical", "boolean", "numeric"):
                    is_target_cand = True
                    target_confidence = 1  # weak cardinality-only heuristic

            if is_target_cand:
                potential_targets.append(str(col))
                target_confidences[str(col)] = target_confidence

            if is_leakage:
                leakage_warnings.append({
                    "column": str(col),
                    "reasons": leakage_reasons,
                    "risk": "High" if "target proxy" in " ".join(leakage_reasons) else "Medium"
                })

            columns_info.append({
                "name": str(col),
                "dtype": str(series.dtype),
                "inferred_type": inferred_type,
                "missing_count": missing_count,
                "missing_pct": col_missing_pct,
                "unique_count": unique_count,
                "is_constant": is_constant,
                "is_potential_target": is_target_cand,
                "is_potential_leakage": is_leakage,
                "leakage_reasons": leakage_reasons,
                "stats": stats,
                "outlier_count": outlier_count
            })

        # Rank target candidates by detection confidence (name match > last-column
        # convention > cardinality-only heuristic) rather than leaving them in
        # column order. Sort is stable, so ties keep their original column order.
        potential_targets.sort(key=lambda c: target_confidences.get(c, 0), reverse=True)

        # Calculate Correlation Matrix for numeric columns
        corr_matrix: Dict[str, Dict[str, float]] = {}
        if len(numeric_cols) >= 2:
            num_df = df[numeric_cols].apply(pd.to_numeric, errors="coerce")
            raw_corr = num_df.corr(method="pearson").fillna(0.0)
            for c1 in numeric_cols:
                corr_matrix[c1] = {}
                for c2 in numeric_cols:
                    val = float(raw_corr.loc[c1, c2])
                    corr_matrix[c1][c2] = round(val, 3)

            # Check for extreme feature-target correlation (>0.98) which indicates leakage
            active_target = target_candidate if target_candidate in df.columns else (potential_targets[0] if potential_targets else None)
            if active_target and active_target in numeric_cols:
                for col in numeric_cols:
                    if col != active_target:
                        corr_val = abs(corr_matrix.get(col, {}).get(active_target, 0.0))
                        if corr_val >= 0.98:
                            leakage_warnings.append({
                                "column": col,
                                "reasons": [f"Suspiciously high correlation ({corr_val:.3f}) with target '{active_target}', suggesting leakage."],
                                "risk": "High"
                            })
                            health_penalties += 10

        # Class balance check if a target is identified
        class_balance: Optional[Dict[str, int]] = None
        target_for_balance = target_candidate if target_candidate in df.columns else (potential_targets[0] if potential_targets else None)
        if target_for_balance and df[target_for_balance].nunique() <= 20:
            counts = df[target_for_balance].value_counts().to_dict()
            class_balance = {str(k): int(v) for k, v in counts.items()}
            # Check severe imbalance (>90:10 ratio in binary)
            if len(counts) == 2:
                vals = list(counts.values())
                ratio = max(vals) / max(sum(vals), 1)
                if ratio > 0.90:
                    health_penalties += 10
                    summary_notes.append(f"Severe class imbalance in '{target_for_balance}' ({ratio*100:.1f}% majority).")

        # Health score calculation
        health_score = max(0.0, min(100.0, 100.0 - health_penalties))
        if health_score >= 85:
            health_status = "Excellent"
        elif health_score >= 70:
            health_status = "Good"
        elif health_score >= 50:
            health_status = "Fair"
        else:
            health_status = "Critical"

        if not summary_notes:
            summary_notes.append("Dataset is clean with balanced features and low missingness.")

        return {
            "row_count": row_count,
            "col_count": col_count,
            "duplicate_rows": duplicate_rows,
            "total_missing_cells": total_missing,
            "missing_pct": missing_pct,
            "health_score": round(health_score, 1),
            "health_status": health_status,
            "columns": columns_info,
            "potential_targets": potential_targets,
            "leakage_warnings": leakage_warnings,
            "correlation_matrix": corr_matrix,
            "class_balance": class_balance,
            "summary_notes": summary_notes
        }
