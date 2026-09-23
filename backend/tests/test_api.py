import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_api_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["app"] == "ModelForge"
    assert data["status"] == "operational"

def test_api_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}

def test_projects_crud():
    # Create project
    create_res = client.post("/api/projects/", json={
        "name": "Test Web Project",
        "description": "API verification project",
        "task_type": "classification"
    })
    assert create_res.status_code == 200
    p_data = create_res.json()
    project_id = p_data["id"]
    assert p_data["name"] == "Test Web Project"

    # Get project
    get_res = client.get(f"/api/projects/{project_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == project_id

    # List projects
    list_res = client.get("/api/projects/")
    assert list_res.status_code == 200
    assert any(p["id"] == project_id for p in list_res.json())

    # Delete project
    del_res = client.delete(f"/api/projects/{project_id}")
    assert del_res.status_code == 200

def test_settings_reports_offline_as_only_available_ai_provider():
    res = client.get("/api/settings/")
    assert res.status_code == 200
    data = res.json()
    assert data["ai_provider"] == "offline"
    assert data["available_ai_providers"] == ["offline"]

def test_settings_rejects_unimplemented_ai_provider():
    """OpenAI/Gemini are not wired to any real API. The settings endpoint
    must reject attempts to select them rather than silently 'succeeding'
    and leaving the UI implying they are active."""
    res = client.post("/api/settings/", json={
        "ai_provider": "openai",
        "openai_api_key": "sk-fake-test-key"
    })
    assert res.status_code == 400
    assert "not implemented" in res.json()["detail"].lower()

    # The rejected update must not have taken effect.
    after = client.get("/api/settings/")
    assert after.json()["ai_provider"] == "offline"

def test_settings_accepts_offline_provider():
    res = client.post("/api/settings/", json={"ai_provider": "offline"})
    assert res.status_code == 200
    assert res.json()["ai_provider"] == "offline"


# --- Cross-project experiment integrity ---

def _create_project(name, task_type="classification"):
    res = client.post("/api/projects/", json={"name": name, "task_type": task_type})
    assert res.status_code == 200
    return res.json()["id"]

def _upload_dataset(project_id, filename="data.csv"):
    csv_content = "f1,f2,target\n1,2,0\n3,4,1\n5,6,0\n7,8,1\n9,10,0\n11,12,1\n13,14,0\n15,16,1\n"
    files = {"file": (filename, csv_content, "text/csv")}
    res = client.post(f"/api/datasets/upload?project_id={project_id}", files=files)
    assert res.status_code == 200
    return res.json()["id"]

def _create_experiment(project_id, dataset_id, parent_id=None, name="Exp"):
    return client.post("/api/experiments/", json={
        "project_id": project_id,
        "dataset_id": dataset_id,
        "parent_id": parent_id,
        "name": name,
        "model_type": "logistic_regression",
        "target_column": "target",
        "primary_metric": "f1"
    })

def test_experiment_rejects_dataset_from_different_project():
    proj_a = _create_project("Cross-Project Dataset Test A")
    proj_b = _create_project("Cross-Project Dataset Test B")
    ds_b = _upload_dataset(proj_b)

    res = _create_experiment(proj_a, ds_b, name="Uses foreign dataset")
    assert res.status_code == 400
    assert "project" in res.json()["detail"].lower()

    client.delete(f"/api/projects/{proj_a}")
    client.delete(f"/api/projects/{proj_b}")

def test_experiment_rejects_parent_from_different_project():
    proj_a = _create_project("Cross-Project Parent Test A")
    proj_b = _create_project("Cross-Project Parent Test B")
    ds_a = _upload_dataset(proj_a)
    ds_b = _upload_dataset(proj_b)

    baseline = _create_experiment(proj_a, ds_a, name="Baseline in A")
    assert baseline.status_code == 200
    baseline_id = baseline.json()["id"]

    res = _create_experiment(proj_b, ds_b, parent_id=baseline_id, name="Cross-project child")
    assert res.status_code == 400
    assert "branch" in res.json()["detail"].lower()

    client.delete(f"/api/projects/{proj_a}")
    client.delete(f"/api/projects/{proj_b}")

def test_experiment_rejects_nonexistent_parent_id():
    proj = _create_project("Nonexistent Parent Test")
    ds = _upload_dataset(proj)

    res = _create_experiment(proj, ds, parent_id=999999, name="Orphan child")
    assert res.status_code == 404

    client.delete(f"/api/projects/{proj}")

def test_experiment_accepts_valid_same_project_parent():
    proj = _create_project("Valid Same-Project Parent Test")
    ds = _upload_dataset(proj)

    baseline = _create_experiment(proj, ds, name="Baseline")
    assert baseline.status_code == 200
    baseline_id = baseline.json()["id"]

    child = _create_experiment(proj, ds, parent_id=baseline_id, name="Child")
    assert child.status_code == 200
    assert child.json()["parent_id"] == baseline_id

    client.delete(f"/api/projects/{proj}")

def test_diff_rejects_experiments_from_different_projects():
    proj_a = _create_project("Cross-Project Diff Test A")
    proj_b = _create_project("Cross-Project Diff Test B")
    ds_a = _upload_dataset(proj_a)
    ds_b = _upload_dataset(proj_b)

    exp_a = _create_experiment(proj_a, ds_a, name="A baseline").json()
    exp_b = _create_experiment(proj_b, ds_b, name="B baseline").json()

    res = client.get(f"/api/experiments/{exp_a['id']}/diff/{exp_b['id']}")
    assert res.status_code == 400
    assert "project" in res.json()["detail"].lower()

    client.delete(f"/api/projects/{proj_a}")
    client.delete(f"/api/projects/{proj_b}")

def test_lineage_does_not_drop_completed_child_of_non_completed_parent():
    """Regression test: get_lineage() used to query status == "completed"
    only, so a completed child branched from a still-failed/queued/running
    parent had its parent excluded from the response. The frontend lineage
    tree renders only nodes reachable from a root via parent/child pointers
    within that same list, so the (valid, completed) child silently vanished
    from the tree. Both nodes must now appear."""
    proj = _create_project("Lineage Orphan Test")
    ds = _upload_dataset(proj)

    # Force a failed parent run via an unsupported model type.
    failed_parent = client.post("/api/experiments/", json={
        "project_id": proj,
        "dataset_id": ds,
        "name": "Failed baseline",
        "model_type": "not_a_real_model",
        "target_column": "target",
        "primary_metric": "f1"
    })
    assert failed_parent.status_code == 200
    parent_data = failed_parent.json()
    assert parent_data["status"] == "failed"
    parent_id = parent_data["id"]

    # A valid child can still branch from the failed parent.
    child = _create_experiment(proj, ds, parent_id=parent_id, name="Retried child")
    assert child.status_code == 200
    child_data = child.json()
    assert child_data["status"] == "completed"
    child_id = child_data["id"]

    lineage = client.get(f"/api/experiments/project/{proj}/lineage")
    assert lineage.status_code == 200
    nodes = {n["id"]: n for n in lineage.json()}

    assert parent_id in nodes, "Failed parent must still appear in the lineage response"
    assert nodes[parent_id]["status"] == "failed"
    assert nodes[parent_id]["primary_metric_val"] is None

    assert child_id in nodes, "Completed child must not be dropped just because its parent isn't completed"
    assert nodes[child_id]["parent_id"] == parent_id
    assert nodes[child_id]["status"] == "completed"

    client.delete(f"/api/projects/{proj}")

def test_diff_allows_experiments_from_same_project():
    proj = _create_project("Same-Project Diff Test")
    ds = _upload_dataset(proj)

    exp_a = _create_experiment(proj, ds, name="Baseline").json()
    exp_b = _create_experiment(proj, ds, parent_id=exp_a["id"], name="Child").json()

    res = client.get(f"/api/experiments/{exp_a['id']}/diff/{exp_b['id']}")
    assert res.status_code == 200

    client.delete(f"/api/projects/{proj}")
