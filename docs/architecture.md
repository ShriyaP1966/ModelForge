# ModelForge System Architecture

## Overview
ModelForge is an AI Model Evolution and Reproducibility Laboratory designed for AI Tools and AI System Design coursework. Unlike basic model leaderboards that only display final accuracy, ModelForge tracks how machine-learning pipelines evolve across sequential iterations, establishes parent-child experiment lineage, calculates granular configuration diffs, and guarantees bit-level metric reproducibility.

---

## High-Level Architecture Diagram

```
+-------------------------------------------------------------------------------------------------+
|                                    React + TypeScript + Vite UI                                 |
|                                                                                                 |
|   +-------------------+    +--------------------+    +--------------------+                     |
|   |  Dashboard View   |    | Dataset Health View|    | Pipeline Visualizer|                     |
|   +-------------------+    +--------------------+    +--------------------+                     |
|   | Evolution Timeline|    | Lineage DAG Tree   |    | Experiment Replay  |                     |
|   +-------------------+    +--------------------+    +--------------------+                     |
|   | Experiment Diff   |    | Metric Diagnostics |    | AI Evolution Notes |                     |
|   +-------------------+    +--------------------+    +--------------------+                     |
+-------------------------------------------------------------------------------------------------+
                                                |
                                      REST API (JSON & Multipart)
                                                v
+-------------------------------------------------------------------------------------------------+
|                                          FastAPI Backend                                        |
|                                                                                                 |
|   +-----------------------+   +-----------------------+   +---------------------------------+   |
|   |   Dataset Analyzer    |   |  ML Pipeline Engine   |   |       Experiment Manager        |   |
|   |  - Health Score (0-100|   |  - 6 Classification   |   |  - Relational Run Persistence   |   |
|   |  - Data Leakage Check |   |  - 6 Regression       |   |  - Parent/Child Lineage DAG     |   |
|   |  - Outliers & Skew    |   |  - ColumnTransformer  |   |  - Leader Metric Identification |   |
|   +-----------------------+   +-----------------------+   +---------------------------------+   |
|                                                                                                 |
|   +-----------------------+   +-----------------------+   +---------------------------------+   |
|   |   Evaluation Engine   |   | Reproducibility Serv  |   |     AI Explanation Service      |   |
|   |  - Multi-Metric Suite |   |  - SHA-256 Fingerprint|   |  - Offline Deterministic Engine |   |
|   |  - Generalization Gap |   |  - Seed Freezing      |   |  - Grounded Hypotheses          |   |
|   |  - Confusion/ROC/PR   |   |  - Tolerance ε Check  |   |  - Optional OpenAI/Gemini       |   |
|   +-----------------------+   +-----------------------+   +---------------------------------+   |
+-------------------------------------------------------------------------------------------------+
                                                |
                                                v
                      [ SQLite Database (modelforge.db) + Stored Artifacts ]
```

---

## Core Components

### 1. Dataset Analyzer (`app.services.dataset_analyzer`)
- **Semantic Type Inference**: Classifies columns into numeric, categorical, boolean, datetime, unique ID, or free text.
- **Leakage Detection**: Identifies feature-target correlations exceeding 0.95, column naming patterns matching ground truth copies, and high-cardinality ID features that risk memorization.
- **Health Score Calculation**: Transparent 0-100 rating with penalty deductions for missing cells, duplicate rows, zero-variance (constant) features, and severe class imbalance.

### 2. Leak-Free ML Pipeline Engine (`app.services.pipeline_engine`)
- **Strict Partitioning**: Preprocessing transformers (imputation, scaling, one-hot/ordinal encoding) are fitted *strictly* on the training split ($X_{train}$) after partitioning to prevent statistical leakage into validation vectors ($X_{val}$).
- **Supported Estimators**:
  - **Classification**: Logistic Regression, K-Nearest Neighbors, Decision Tree, Random Forest, Support Vector Machine (SVM), Gradient Boosting.
  - **Regression**: Linear Regression, Ridge, Lasso, Decision Tree Regressor, Random Forest Regressor, Gradient Boosting Regressor.

### 3. Experiment Manager & Lineage DAG (`app.services.experiment_manager`)
- Tracks parent-child derivations (`parent_id`) allowing users to branch experiments and compare iterative hypotheses.
- Persists all hyperparameters, preprocessing configurations, feature masks, execution durations, and validation metrics in relational SQLite tables.
- Computes dynamic leaderboard status relative to the user's chosen primary metric (e.g. prioritizing weighted F1 over raw accuracy).

### 4. Evaluation Engine (`app.services.evaluation_engine`)
- Calculates complete metric suites:
  - Classification: Accuracy, Precision, Recall, F1, ROC-AUC, Confusion Matrix, ROC/PR curves.
  - Regression: MAE, MSE, RMSE, R², Explained Variance, Residuals.
- **Overfitting Diagnostics**: Calculates the Generalization Gap:
  $$\Delta_{\text{gen}} = \text{Metric}_{\text{train}} - \text{Metric}_{\text{val}}$$
  Warns when $\Delta_{\text{gen}} > 0.15$ (Moderate) or $> 0.25$ (High Risk).

### 5. Reproducibility Service (`app.services.reproducibility_service`)
- Computes SHA-256 hash of dataset at run time:
  $$H = \text{SHA-256}(\text{Dataset Bytes})$$
- On reproduction request, verifies dataset integrity and re-executes the exact pipeline configuration using locked seeds.
- Verifies that metric differences satisfy:
  $$|M_{\text{original}} - M_{\text{reproduced}}| \le \epsilon \quad (\text{default } \epsilon = 10^{-4})$$

### 6. AI Explanation Service (`app.services.ai_explanation_service`)
- **Free-First & Offline**: Operates seamlessly without external APIs using a deterministic scientific heuristic engine.
- Synthesizes:
  1. What changed between runs (architectures, scalers, features, parameters).
  2. Validation metric shifts ($\Delta$ and percentage change).
  3. Grounded scientific hypotheses explaining metric movement.
  4. Generalization limitations and overfitting risks.
  5. Actionable next experiment recommendations.
