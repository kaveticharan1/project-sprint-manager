import pytest

from app.config import Settings, assert_allowed_database


async def test_health(client):
    r = await client.get("http://test/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "database": "sprint_manager_test"}


@pytest.mark.parametrize(
    "path", ["/developers/not-an-id", "/products/123", "/sprints/zz", "/tasks/x"]
)
async def test_invalid_object_id_is_404_not_500(client, path):
    r = await client.get(path)
    assert r.status_code == 404
    body = r.json()
    assert body["error"]["code"] == "not_found"
    assert set(body["error"]) == {"code", "message", "details"}


async def test_unknown_but_valid_id_is_404(client):
    r = await client.get("/developers/0123456789abcdef01234567")
    assert r.status_code == 404
    assert r.json()["error"]["message"] == "Developer not found"


async def test_validation_error_shape(client):
    r = await client.post("/developers", json={"name": "", "email": "nope", "role": "Wizard"})
    assert r.status_code == 422
    error = r.json()["error"]
    assert error["code"] == "validation_error"
    assert set(error["details"]["fields"]) == {"name", "email", "role"}


async def test_malformed_json_is_422(client):
    r = await client.post(
        "/developers", content="{bad json", headers={"content-type": "application/json"}
    )
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "validation_error"


def test_only_app_databases_are_allowed():
    with pytest.raises(ValueError):
        assert_allowed_database("admin")
    with pytest.raises(ValueError):
        Settings(mongodb_db="my_other_app")
