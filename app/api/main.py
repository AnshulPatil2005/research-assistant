from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.core.config import settings
import structlog
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

logger = structlog.get_logger()

# Setup Rate Limiting
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup event
    logger.info("Application starting up...")
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    from app.services.embeddings import get_model
    logger.info("Warming up embedding model...")
    get_model()
    
    yield
    
    # Shutdown event (if needed in future)
    logger.info("Application shutting down...")


app = FastAPI(title="PDF RAG API", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Welcome to PDF RAG API"}
