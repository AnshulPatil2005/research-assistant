from types import SimpleNamespace
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient

from app.api.main import app


@pytest.mark.asyncio
async def test_upload_forwards_ocr_mode_to_worker(tmp_path):
    with patch("app.api.routes.settings.UPLOAD_DIR", str(tmp_path)), patch(
        "app.api.routes.celery_app.send_task",
        return_value=SimpleNamespace(id="task-123"),
    ) as mock_send_task:
        async with AsyncClient(
            transport=ASGITransport(app=app, client=("127.0.0.9", 12345)),
            base_url="http://test",
        ) as ac:
            response = await ac.post(
                "/api/v1/upload?ocr_mode=always",
                files={"file": ("paper.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
            )

    assert response.status_code == 200
    body = response.json()
    assert body["ocr_mode"] == "always"
    assert body["task_id"] == "task-123"

    _, kwargs = mock_send_task.call_args
    assert kwargs["args"][2] == "always"


@pytest.mark.asyncio
async def test_upload_rejects_invalid_ocr_mode():
    async with AsyncClient(
        transport=ASGITransport(app=app, client=("127.0.0.10", 12346)),
        base_url="http://test",
    ) as ac:
        response = await ac.post(
            "/api/v1/upload?ocr_mode=invalid_mode",
            files={"file": ("paper.pdf", b"%PDF-1.4\n%%EOF", "application/pdf")},
        )

    assert response.status_code == 400
    assert "Invalid ocr_mode" in response.json()["detail"]
