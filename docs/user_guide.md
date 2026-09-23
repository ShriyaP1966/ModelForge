# ModelForge User Guide & Walkthrough

Welcome to **ModelForge: AI Model Evolution Lab**. This guide walks through the end-to-end workflow from initial dataset ingestion to iterative pipeline evolution and certified reproduction.

---

## 1. Quick Start & Coursework Samples

1. Open the ModelForge web application at `http://localhost:5173`.
2. On the **Dashboard**, click **"Load Coursework Samples"** to automatically initialize:
   - **Titanic Passenger Survival**: Binary classification with missing data and mixed categorical/numerical types.
   - **California Housing Valuation**: Continuous regression benchmark with spatial/demographic features.
   - **Synthetic Fraud & Stress Test**: Problematic dataset with intentional data leaks, duplicate rows, constant columns, and severe class imbalance.

---

## 2. Dataset Intelligence & Health Diagnostics

1. Select a project and click **"Dataset Intelligence"**.
2. Review the **Health Score (0-100)**:
   - Identifies total missingness %, duplicate records, and constant columns.
   - Inspects the **Data Leakage Warnings** section to ensure no target proxy columns or synthetic labels leak into features.
3. Review column distributions, IQR outlier counts, and correlation matrices.
4. Upload custom CSV or Excel files (`.xlsx`) via the **"Upload New Dataset"** button.

---

## 3. Designing a Controlled Experiment

1. Click **"New Experiment"** (or click the branch fork icon next to any previous run to derive a child experiment).
2. Configure your pipeline:
   - **Lineage Parent**: Select a previous experiment to create an evolutionary child branch.
   - **Model Architecture**: Choose from 6 Classification or 6 Regression estimators.
   - **Hyperparameters**: Tune model-specific controls (e.g. `n_estimators`, `max_depth`, `C`, `alpha`).
   - **Preprocessing**: Choose imputer strategy (mean, median, mode), scaling (standard, minmax, robust, none), and encoding.
   - **Feature Selection**: Check/uncheck individual features to test feature subset hypotheses.
   - **Validation Protocol**: Adjust test split ratio and random seed.
3. Click **"Run Experiment"**.

---

## 4. Analyzing Experiment Results

- **Validation Metrics**: Inspect Accuracy, F1, Precision, Recall, ROC-AUC, or MAE, RMSE, R².
- **Overfitting Diagnostics**: Check the Generalization Gap banner between train and test splits.
- **Pipeline Visualizer**: Click each node in the interactive pipeline graph to inspect the exact transformations applied.
- **Confusion Matrix & Curves**: Examine classification heatmaps or ROC/PR curves.
- **Feature Importance**: View normalized predictive weightings.

---

## 5. Experiment Diff & Evolution Tracking

- **Evolution Graph**: Follow the sequential performance trajectory across iterations with clickable experiment nodes.
- **Lineage Tree**: Trace the hierarchical derivation DAG from baseline to advanced models, identifying the designated **Leader**.
- **Compare Diffs**: Select any two experiments to see a side-by-side table of modified hyperparameters, preprocessing transforms, feature changes, and metric shifts ($\Delta$ and %).
- **Experiment Replay**: Click "Experiment Replay" to step through or automatically play back the experiment sequence with live metric and configuration animations.

---

## 6. Reproducing Experiments

1. On any experiment detail page, click **"Reproduce Experiment"**.
2. ModelForge validates the SHA-256 fingerprint of the original dataset to ensure no data drift has occurred.
3. The exact pipeline is re-executed with the locked random seed and configuration.
4. A certified report confirms whether all metrics reproduced within tolerance ($\epsilon \le 10^{-4}$).

---

## 7. AI Explanation & Hypothesis Formulation

1. Click **"AI Explanation"** on any experiment.
2. ModelForge produces a structured report containing:
   - Summary of the transition.
   - Bullet points of observed configuration changes.
   - Performance shifts.
   - Grounded scientific hypotheses explaining observed metric behavior.
   - Overfitting and generalization limitations.
   - Recommended next experiment iterations.
3. Works completely offline with zero API key required, with optional OpenAI and Gemini provider integration in Settings.
