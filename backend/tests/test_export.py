import csv
import io
import json

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

_CSV = "f1,f2,target\n" + "\n".join(f"{i},{i * 2},{i % 2}" for i in range(40)) + "\n"


def _project_with_runs(run_names):
    project_id = client.post("/api/projects/", json={"name": "Export test", "task_type": "classification"}).json()["id"]
    upload = client.post(
        f"/api/datasets/upload?project_id={project_id}",
        files={"file": ("data.csv", _CSV, "text/csv")},
    )
    assert upload.status_code == 200
    dataset_id = upload.json()["id"]

    experiment_ids = []
    for name in run_names:
        res = client.post("/api/experiments/", json={
            "project_id": project_id,
            "dataset_id": dataset_id,
            "name": name,
            "model_type": "logistic_regression",
            "target_column": "target",
            "primary_metric": "f1",
        })
        assert res.status_code == 200
        experiment_ids.append(res.json()["id"])
    return project_id, experiment_ids


def test_experiment_json_export_contains_config_and_metrics_but_no_server_paths():
    _, (exp_id,) = _project_with_runs(["Baseline"])

    res = client.get(f"/api/experiments/{exp_id}/export?format=json")

    assert res.status_code == 200
    assert res.headers["content-disposition"] == f'attachment; filename="experiment-{exp_id}.json"'
    data = json.loads(res.text)
    assert data["name"] == "Baseline"
    assert data["status"] == "completed"
    assert any(m["metric_name"] == "f1" and m["split"] == "val" for m in data["metrics"])
    assert all("file_path" not in a for a in data["artifacts"])


def test_experiment_markdown_report_has_the_main_sections():
    _, (exp_id,) = _project_with_runs(["Baseline"])

    res = client.get(f"/api/experiments/{exp_id}/export?format=md")

    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/markdown")
    body = res.text
    assert body.startswith("# Baseline")
    assert "## Reproducibility" in body
    assert "## Metrics" in body
    assert "| f1 |" in body
    assert "## Confusion matrix" in body


def test_project_csv_export_has_one_row_per_run_with_metric_columns():
    project_id, _ = _project_with_runs(["Run A", "Run B"])

    res = client.get(f"/api/experiments/project/{project_id}/export?format=csv")

    assert res.status_code == 200
    assert res.headers["content-disposition"] == f'attachment; filename="project-{project_id}-runs.csv"'
    rows = list(csv.DictReader(io.StringIO(res.text)))
    assert [r["name"] for r in rows] == ["Run A", "Run B"]
    assert "val_f1" in rows[0] and rows[0]["val_f1"] != ""
    assert rows[0]["model_type"] == "logistic_regression"


def test_project_csv_export_neutralizes_spreadsheet_formulas_in_names():
    project_id, _ = _project_with_runs(["=HYPERLINK(\"http://example.com\")"])

    res = client.get(f"/api/experiments/project/{project_id}/export?format=csv")

    rows = list(csv.DictReader(io.StringIO(res.text)))
    assert rows[0]["name"].startswith("'=")


def test_project_json_export_lists_every_run():
    project_id, _ = _project_with_runs(["Run A", "Run B"])

    res = client.get(f"/api/experiments/project/{project_id}/export?format=json")

    assert res.status_code == 200
    assert [e["name"] for e in json.loads(res.text)] == ["Run A", "Run B"]


def test_export_of_unknown_experiment_or_project_returns_404():
    assert client.get("/api/experiments/999999/export").status_code == 404
    assert client.get("/api/experiments/project/999999/export").status_code == 404


def test_export_rejects_unsupported_format():
    _, (exp_id,) = _project_with_runs(["Baseline"])

    assert client.get(f"/api/experiments/{exp_id}/export?format=pdf").status_code == 422
