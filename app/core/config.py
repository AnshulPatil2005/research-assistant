from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from typing import Optional

class Settings(BaseSettings):
    model_config = ConfigDict(env_file=".env", env_file_encoding="utf-8")
    
    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # Qdrant
    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_NAME: str = "documents"

    # LLM (OpenRouter)
    OPENROUTER_API_KEY: Optional[str] = None
    LLM_PROVIDER: str = "openrouter"
    LLM_MODEL: str = "mistralai/mistral-7b-instruct"

    # Embeddings
    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    EMBEDDING_DIMENSION: int = 384

    # RAG Config
    RAG_TOP_K: int = 5
    SUMMARY_TOP_K_PER_SECTION: int = 8
    SUMMARY_FALLBACK_TOP_K: int = 15
    MAX_CONTEXT_TOKENS: int = 4096
    CHUNK_TOKENS: int = 500
    CHUNK_OVERLAP_TOKENS: int = 50

    # Celery
    CELERY_CONCURRENCY: int = 2
    
    # Upload
    MAX_UPLOAD_MB: int = 50
    UPLOAD_DIR: str = "/app/uploads"

settings = Settings()
