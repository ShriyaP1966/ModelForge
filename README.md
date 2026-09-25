<a name="top"></a>
<div align="center">

# ModelForge: AI Model Evolution Lab

### See how your machine-learning model evolves.

[![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110%2B-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2.2-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.1.6-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4.3-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![scikit-learn](https://img.shields.io/badge/scikit--learn-1.4%2B-F7931E?style=for-the-badge&logo=scikitlearn&logoColor=white)](https://scikit-learn.org/)
[![pandas](https://img.shields.io/badge/pandas-2.2%2B-150458?style=for-the-badge&logo=pandas&logoColor=white)](https://pandas.pydata.org/)
[![SQLite](https://img.shields.io/badge/SQLite-Database-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![pytest](https://img.shields.io/badge/pytest-8.0%2B-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)](https://pytest.org/)
[![Deployed on Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://modelforge-frontend-sgbp.onrender.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

[![Live Demo](https://img.shields.io/badge/Live_Demo-View_App-4CAF50?style=for-the-badge)](https://modelforge-frontend-sgbp.onrender.com)
[![API Docs](https://img.shields.io/badge/API_Docs-Swagger_UI-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://modelforge-backend-xbr6.onrender.com/docs)

*The free Render backend sleeps after periods of inactivity, so the first load can take ~30–60 seconds while it spins back up.*

**[Features](#features) · [Architecture](#architecture) · [Tech Stack](#tech-stack) · [Quick Start](#quick-start) · [Deployment](#deployment)**

</div>

---

A free-first, portfolio-grade machine-learning experimentation platform designed for **AI Tools + AI System Design** coursework.

ModelForge turns tabular datasets into reproducible sequences of controlled experiments, making pipeline evolution, experiment lineage, and metric shifts transparent and tangible.

---

<a name="features"></a>
## 🌟 Why ModelForge Is Distinctive

- **Evolution Over Leaderboards**: Shows *how* and *why* a model/pipeline evolves across experiments rather than merely ranking final accuracy.
- **Visual Lineage DAG**: Interactive parent-child tree showing exactly how candidate pipelines derive from baselines.
- **Granular Experiment Diff**: Side-by-side configuration and hyperparameter diff with color-coded metric delta tags ($\Delta$ and %).
- **Zero-Variance Reproducibility**: Seed-locked execution, SHA-256 dataset fingerprinting, and automated metric tolerance verification ($\epsilon \le 10^{-4}$).
- **Pre-Training Dataset Intelligence**: Transparent Health Score (0-100), automated data leakage alerts, IQR outlier detection, and correlation matrices.
- **Interactive Visuals**: Missing-value heatmaps, confusion matrices, ROC/PR curves, feature importance, dynamic pipeline visualizer, and step-by-step experiment replay.
- **Free-First & Offline**: Runs entirely on a standard student laptop with local open-source tools. The AI assistant uses an intelligent deterministic scientific engine by default, requiring no paid APIs.

<div align="right"><a href="#top">⬆ Back to top</a></div>

---

## 📸 Screenshots

<!-- TODO(ShriyaP1966): drop the real screenshots into docs/screenshots/ using these
     exact filenames (dashboard.png, dataset-health.png, experiment-diff.png,
     lineage.png) and this section will render them automatically. -->

| Dashboard | Dataset Health |
|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Dataset Health](docs/screenshots/dataset-health.png) |

| Experiment Diff | Lineage DAG |
|---|---|
| ![Experiment Diff](docs/screenshots/experiment-diff.png) | ![Lineage](docs/screenshots/lineage.png) |

<div align="right"><a href="#top">⬆ Back to top</a></div>

---

<a name="architecture"></a>
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

<div align="right"><a href="#top">⬆ Back to top</a></div>

---

<a name="tech-stack"></a>
## 🛠️ Technology Stack

| Layer | Tools |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **Backend** | Python 3.13, FastAPI, Pydantic v2, SQLAlchemy 2.0 |
| **Machine Learning** | scikit-learn, pandas, NumPy, SciPy, joblib |
| **Database** | SQLite (zero-config local persistence) |
| **Testing** | pytest, pytest-cov, Starlette TestClient |
| **AI Layer** | Structured deterministic scientific engine (Offline / Free) — works today. OpenAI/Gemini providers are **planned**, not yet implemented. |

<div align="right"><a href="#top">⬆ Back to top</a></div>

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

<div align="right"><a href="#top">⬆ Back to top</a></div>

---

<a name="quick-start"></a>
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
# Run complete test suite (76 passing tests covering all models & edge cases)
.\backend\venv\Scripts\python -m pytest -v
```

<div align="right"><a href="#top">⬆ Back to top</a></div>

---

## 📂 Sample Datasets Included

Located in `sample_data/`:
1. `classification_titanic.csv`: Mixed types, missing ages/embarked, survival target.
2. `regression_housing.csv`: California housing market with geographic & socioeconomic features.
3. `problematic_dataset.csv`: Stress-test dataset containing synthetic target leaks, duplicate rows, constant zero-variance features, and 95:5 class imbalance.

<div align="right"><a href="#top">⬆ Back to top</a></div>

---

<a name="deployment"></a>
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

<div align="right"><a href="#top">⬆ Back to top</a></div>

---

## 📜 License

ModelForge is licensed under the [MIT License](LICENSE).
