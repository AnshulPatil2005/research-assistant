import pytest
from httpx import AsyncClient, ASGITransport
from app.api.main import app
from unittest.mock import patch, MagicMock
import numpy as np

@pytest.mark.asyncio
async def test_summary_endpoint():
    with patch("app.api.routes.search_vectors") as mock_search, \
         patch("app.api.routes.llm_client") as mock_llm:
        
        # Mock search results
        mock_hit = MagicMock()
        mock_hit.payload = {"text": "This is an abstract.", "section": "Abstract"}
        mock_search.return_value = [mock_hit]
        
        # Mock LLM response
        mock_llm.generate_response.return_value = "Structured summary content"
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.get("/api/v1/summary/test_doc")
            
        assert response.status_code == 200
        assert response.json()["summary"] == "Structured summary content"
        mock_search.assert_called()

@pytest.mark.asyncio
async def test_chat_with_citations():
    with patch("app.api.routes.search_vectors") as mock_search, \
         patch("app.api.routes.llm_client") as mock_llm, \
         patch("app.api.routes.get_model") as mock_get_model:
        
        # Mock embedding model
        mock_model = MagicMock()
        # SentenceTransformer.encode returns numpy array by default
        mock_model.encode.return_value = np.array([0.1] * 384)
        mock_get_model.return_value = mock_model
        
        # Mock search results
        mock_hit = MagicMock()
        mock_hit.payload = {
            "text": "The result is 42.",
            "page": 1,
            "section": "Results",
            "doc_id": "test_doc",
            "filename": "test.pdf"
        }
        mock_search.return_value = [mock_hit]
        
        # Mock LLM response
        mock_llm.generate_response.return_value = "The answer is 42 [Page 1, Section Results]."
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/api/v1/chat", json={"query": "What is the result?", "doc_id": "test_doc"})
            
        assert response.status_code == 200
        data = response.json()
        assert "answer" in data
        assert "citations" in data
        assert data["citations"][0]["page"] == 1
        assert data["citations"][0]["section"] == "Results"

@pytest.mark.asyncio
async def test_chat_no_evidence_returns_unknown():
    with patch("app.api.routes.search_vectors") as mock_search, \
         patch("app.api.routes.get_model") as mock_get_model:
        
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([0.1] * 384)
        mock_get_model.return_value = mock_model
        mock_search.return_value = []
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post("/api/v1/chat", json={"query": "What is the result?", "doc_id": "test_doc"})
            
        assert response.status_code == 200
        data = response.json()
        assert "I don't know based on the provided document evidence" in data["answer"]
        assert data["citations"] == []

@pytest.mark.asyncio
async def test_chat_supports_section_filters():
    with patch("app.api.routes.search_vectors") as mock_search, \
         patch("app.api.routes.llm_client") as mock_llm, \
         patch("app.api.routes.get_model") as mock_get_model:
        
        mock_model = MagicMock()
        mock_model.encode.return_value = np.array([0.1] * 384)
        mock_get_model.return_value = mock_model

        mock_hit = MagicMock()
        mock_hit.payload = {
            "text": "A method statement.",
            "page": 2,
            "section": "Methods",
            "doc_id": "test_doc",
            "filename": "test.pdf",
        }
        mock_search.return_value = [mock_hit]
        mock_llm.generate_response.return_value = "Method quote \"A method statement.\" [Page 2, Section Methods]"
        
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(
                "/api/v1/chat",
                json={
                    "query": "What method is used?",
                    "doc_id": "test_doc",
                    "sections": ["1. METHODS", "Results"],
                    "is_claim": False
                },
            )
            
        assert response.status_code == 200
        _, kwargs = mock_search.call_args
        assert kwargs["doc_id"] == "test_doc"
        assert kwargs["sections"] == ["Methods", "Results"]
