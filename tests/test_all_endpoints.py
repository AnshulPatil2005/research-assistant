import pytest
from httpx import AsyncClient, ASGITransport
from app.api.main import app
from unittest.mock import patch, MagicMock, AsyncMock
import io
import numpy as np


@pytest.mark.asyncio
async def test_root_endpoint():
    """Test GET / endpoint"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to PDF RAG API"}


@pytest.mark.asyncio
async def test_health_endpoint():
    """Test GET /api/v1/health endpoint"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_upload_valid_pdf():
    """Test POST /api/v1/upload with valid PDF"""
    pdf_content = b"%PDF-1.4\n%fake pdf content"
    
    with patch("app.api.routes.celery_app") as mock_celery:
        # Mock celery task
        mock_task = MagicMock()
        mock_task.id = "task-123"
        mock_celery.send_task.return_value = mock_task
        
        with patch("os.path.exists", return_value=False), \
             patch("os.rename"):
            
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
                response = await ac.post(
                    "/api/v1/upload",
                    files={"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")}
                )
    
    assert response.status_code == 200
    data = response.json()
    assert "doc_id" in data
    assert "task_id" in data
    assert data["status"] == "processing" or "processing" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_upload_invalid_file_type():
    """Test POST /api/v1/upload with non-PDF file"""
    non_pdf_content = b"This is not a PDF"
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/upload",
            files={"file": ("test.txt", io.BytesIO(non_pdf_content), "text/plain")}
        )
    
    assert response.status_code == 400
    assert "pdf" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_duplicate_file():
    """Test POST /api/v1/upload with duplicate file (force=false)"""
    pdf_content = b"%PDF-1.4\n%fake pdf content"
    
    with patch("os.path.exists", return_value=True):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                "/api/v1/upload",
                files={"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")},
                params={"force": "false"}
            )
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "existing"
    assert "force=true" in data.get("message", "").lower()


@pytest.mark.asyncio
async def test_upload_force_reprocess():
    """Test POST /api/v1/upload with force=true"""
    pdf_content = b"%PDF-1.4\n%fake pdf content"
    
    with patch("app.api.routes.celery_app") as mock_celery, \
         patch("os.path.exists", return_value=True), \
         patch("os.remove"), \
         patch("os.rename"):
        
        mock_task = MagicMock()
        mock_task.id = "task-456"
        mock_celery.send_task.return_value = mock_task
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                "/api/v1/upload",
                files={"file": ("test.pdf", io.BytesIO(pdf_content), "application/pdf")},
                params={"force": "true"}
            )
    
    assert response.status_code == 200
    data = response.json()
    assert "task_id" in data


@pytest.mark.asyncio
async def test_status_pending():
    """Test GET /api/v1/status/{task_id} with PENDING status"""
    with patch("app.api.routes.celery_app") as mock_celery:
        mock_result = MagicMock()
        mock_result.status = "PENDING"
        mock_result.ready.return_value = False
        mock_celery.AsyncResult.return_value = mock_result
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/status/task-123")
    
    assert response.status_code == 200
    data = response.json()
    assert data["task_id"] == "task-123"
    assert data["status"] == "PENDING"


@pytest.mark.asyncio
async def test_status_processing():
    """Test GET /api/v1/status/{task_id} with PROCESSING status"""
    with patch("app.api.routes.celery_app") as mock_celery:
        mock_result = MagicMock()
        mock_result.status = "PROCESSING"
        mock_result.ready.return_value = False
        mock_result.info = {"step": "OCR", "doc_id": "doc-123"}
        mock_celery.AsyncResult.return_value = mock_result
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/status/task-123")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "PROCESSING"
    assert "info" in data
    assert data["info"]["step"] == "OCR"


@pytest.mark.asyncio
async def test_status_success():
    """Test GET /api/v1/status/{task_id} with SUCCESS status"""
    with patch("app.api.routes.celery_app") as mock_celery:
        mock_result = MagicMock()
        mock_result.status = "SUCCESS"
        mock_result.ready.return_value = True
        mock_result.result = {"chunks_created": 42, "pages_processed": 10}
        mock_celery.AsyncResult.return_value = mock_result
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/status/task-123")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "SUCCESS"
    assert "result" in data
    assert data["result"]["chunks_created"] == 42


@pytest.mark.asyncio
async def test_chat_basic():
    """Test POST /api/v1/chat basic query"""
    with patch("app.api.routes.search_vectors") as mock_search, \
         patch("app.api.routes.llm_client") as mock_llm, \
         patch("app.api.routes.get_model") as mock_get_model:
        
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([0.1] * 384)
        mock_get_model.return_value = mock_model
        
        mock_hit = MagicMock()
        mock_hit.payload = {
            "text": "The result is significant.",
            "page": 1,
            "section": "Results",
            "section_bucket": "results",
            "doc_id": "doc-123",
            "filename": "paper.pdf",
            "is_table": False,
            "is_claim": False,
            "content_type": "text"
        }
        mock_search.return_value = [mock_hit]
        mock_llm.generate_response.return_value = "The result is significant [Page 1, Section Results]."
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                "/api/v1/chat",
                json={"query": "What is the result?", "doc_id": "doc-123"}
            )
    
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "citations" in data
    assert len(data["citations"]) > 0


@pytest.mark.asyncio
async def test_chat_with_filters():
    """Test POST /api/v1/chat with section filters"""
    with patch("app.api.routes.search_vectors") as mock_search, \
         patch("app.api.routes.llm_client") as mock_llm, \
         patch("app.api.routes.get_model") as mock_get_model:
        
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([0.1] * 384)
        mock_get_model.return_value = mock_model
        
        mock_search.return_value = []
        mock_llm.generate_response.return_value = "Answer with citations [Page X, Section Y]."
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                "/api/v1/chat",
                json={
                    "query": "What methods?",
                    "doc_id": "doc-123",
                    "section": "Methods",
                    "is_claim": False,
                    "is_table": False
                }
            )
    
    assert response.status_code == 200
    mock_search.assert_called_once()
    call_kwargs = mock_search.call_args.kwargs
    assert call_kwargs["section"] == "Methods"


@pytest.mark.asyncio
async def test_summary_basic():
    """Test GET /api/v1/summary/{doc_id}"""
    with patch("app.api.routes.search_vectors") as mock_search, \
         patch("app.api.routes.llm_client") as mock_llm:
        
        mock_hit = MagicMock()
        mock_hit.payload = {
            "text": "This work presents a novel approach.",
            "page": 1,
            "section": "Abstract"
        }
        mock_search.return_value = [mock_hit]
        
        summary_text = """
        1) Problem: Understanding text
        2) Method: Using transformers
        3) Key Results: 95% accuracy
        4) Limitations: Limited dataset
        """
        mock_llm.generate_response.return_value = summary_text
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/summary/doc-123")
    
    assert response.status_code == 200
    data = response.json()
    assert "summary" in data
    assert "Problem" in data["summary"]


@pytest.mark.asyncio
async def test_summary_not_found():
    """Test GET /api/v1/summary/{doc_id} when document not found"""
    with patch("app.api.routes.search_vectors") as mock_search:
        mock_search.return_value = []
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/summary/nonexistent-doc")
    
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()
