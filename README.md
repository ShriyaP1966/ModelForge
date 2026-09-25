# ModelForge: AI Model Evolution Lab

> **"See how your machine-learning model evolves."**

**Live demo:** _deploying — link will be added here once the Render services are up._

A free-first, portfolio-grade machine-learning experimentation platform designed for **AI Tools + AI System Design** coursework.

ModelForge turns tabular datasets into reproducible sequences of controlled experiments, making pipeline evolution, experiment lineage, and metric shifts transparent and tangible.

---

## 🌟 Why ModelForge Is Distinctive

- **Evolution Over Leaderboards**: Shows *how* and *why* a model/pipeline evolves across experiments rather than merely ranking final accuracy.
- **Visual Lineage DAG**: Interactive parent-child tree showing exactly how candidate pipelines derive from baselines.
- **Granular Experiment Diff**: Side-by-side configuration and hyperparameter diff with color-coded metric delta tags ($\Delta$ and %).
- **Zero-Variance Reproducibility**: Seed-locked execution, SHA-256 dataset fingerprinting, and automated metric tolerance verification ($\epsilon \le 10^{-4}$).
- **Pre-Training Dataset Intelligence**: Transparent Health Score (0-100), automated data leakage alerts, IQR outlier detection, and correlation matrices.
- **Interactive Visuals**: Missing-value heatmaps, confusion matrices, ROC/PR curves, feature importance, dynamic pipeline visualizer, and step-by-step experiment replay.
- **Free-First & Offline**: Runs entirely on a standard student laptop with local open-source tools. The AI assistant uses an intelligent deterministic scientific engine by default, requiring no paid APIs.

---

## 🏗️ Architecture

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

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0 |
| **Machine Learning** | scikit-learn, pandas, NumPy, SciPy, joblib |
| **Database** | SQLite (zero-config local persistence) |
| **Testing** | pytest, pytest-cov, Starlette TestClient |
| **AI Layer** | Structured deterministic scientific engine (Offline / Free), Optional OpenAI/Gemini |

---

## 📦 Supported ML Algorithms

### Classification
1. **Logistic Regression** (Linear baseline with $L_2$ regularization)
2. **K-Nearest Neighbors (KNN)** (Distance-based instance learning)
3. **Decision Tree Classifier** (Non-linear recursive partitioning)
4. **Random Forest Classifier** (Bagging ensemble of trees)
5. **Support Vector Machine (SVM)** (Maximum-margin hyperplane with RBF kernel)
6. **Gradient Boosting Classifier** (Sequential residual boosting)

### Regression
1. **Linear Regression** (Ordinary least squares baseline)
2. **Ridge Regression** ($L_2$ regularized linear model)
3. **Lasso Regression** ($L_1$ sparsity-inducing regularized model)
4. **Decision Tree Regressor** (Non-linear regression trees)
5. **Random Forest Regressor** (Ensemble averaging regression)
6. **Gradient Boosting Regressor** (Gradient boosted regression trees)

---

## 🚀 Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ and npm

### 1. Backend Setup
```bash
# Clone or navigate to the repository
cd ModelForge-ML

# Create and activate Python virtual environment
python -m venv backend/venv

# Windows PowerShell:
.\backend\venv\Scripts\Activate.ps1

# Linux / macOS:
source backend/venv/bin/activate

# Install backend dependencies
pip install -r backend/requirements.txt

# Start FastAPI server
python -m uvicorn app.main:app --app-dir backend --port 8000 --reload
```
API Documentation will be available at `http://127.0.0.1:8000/docs`.

### 2. Frontend Setup
In a new terminal window:
```bash
cd ModelForge-ML/frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Run Automated Tests
```bash
# Run complete test suite (28 passing tests covering all models & edge cases)
.\backend\venv\Scripts\python -m pytest -v
```

---

## 📂 Sample Datasets Included

Located in `sample_data/`:
1. `classification_titanic.csv`: Mixed types, missing ages/embarked, survival target.
2. `regression_housing.csv`: California housing market with geographic & socioeconomic features.
3. `problematic_dataset.csv`: Stress-test dataset containing synthetic target leaks, duplicate rows, constant zero-variance features, and 95:5 class imbalance.

---

## ☁️ Deploying to Render

This repo includes a [`render.yaml`](render.yaml) Blueprint that provisions two free-tier services: a Python web service for the FastAPI backend and a static site for the React/Vite frontend.

1. Sign in to [Render](https://render.com) with the `ShriyaP1966` GitHub account.
2. **New +** → **Blueprint** → select the `ModelForge` repo. Render detects `render.yaml` and creates `modelforge-backend` and `modelforge-frontend`.
3. Wait for both services to finish their first deploy, then copy each one's public URL (shown on its Render dashboard page).
4. Wire them together (one-time, since each URL is only known after the other exists):
   - On **modelforge-frontend** → Environment, set `VITE_API_BASE_URL` to the backend URL + `/api` (e.g. `https://modelforge-backend.onrender.com/api`), then trigger a redeploy.
   - On **modelforge-backend** → Environment, set `CORS_ORIGINS` to the frontend URL (e.g. `https://modelforge-frontend.onrender.com`), then trigger a redeploy.
5. Open the frontend URL — that's the live app.

**Note:** the free plan uses ephemeral disk, so the SQLite database resets on redeploy or after the service spins down from inactivity. Fine for a demo/portfolio deployment; real persistence would need a paid instance with a Render persistent disk attached.

---

## 📜 License

ModelForge is licensed under the [MIT License](LICENSE).
