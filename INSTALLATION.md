# Installation Guide

This project can be started in two practical ways:

1. `Docker` for the full stack with the least local setup.
2. `Local terminals` for development, where Redis and Qdrant run in Docker and the backend/frontend run from your terminal.

## Prerequisites

- Docker Desktop or Docker Engine with the Compose plugin
- Python 3.11
- Node.js 18 or newer
- An OpenRouter API key

## 1. Configure Environment Variables

Edit the root `.env` file before starting anything.

Minimum required values:

```env
LLM_PROVIDER=openrouter
LLM_MODEL=google/gemini-2.0-flash-001
OPENROUTER_API_KEY=sk-or-v1-your-key-here
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

If you are running the backend from your own terminal instead of inside Docker, also add these overrides:

```env
REDIS_URL=redis://localhost:6379/0
QDRANT_URL=http://localhost:6333
UPLOAD_DIR=uploads
```

Notes:

- `LLM_PROVIDER=openrouter` is required. The current codebase does not support Ollama.
- The first backend startup will download the embedding model, so the first run is slower.
- If you change `EMBEDDING_MODEL` later, re-upload your documents because stored vectors become incompatible.

## 2. Method A: Run Everything with Docker

This is the simplest setup. It starts:

- `redis`
- `qdrant`
- `api`
- `worker`
- `frontend`

From the project root:

```bash
docker compose up --build -d
```

If your machine still uses the older Compose CLI, use:

```bash
docker-compose up --build -d
```

Useful commands:

```bash
docker compose ps
docker compose logs -f api
docker compose logs -f worker
docker compose down
```

URLs after startup:

- Frontend: `http://localhost:8080`
- API: `http://localhost:8000`
- Qdrant: `http://localhost:6333`
- Redis: `localhost:6379`

## 3. Method B: Run from Local Terminals

This mode is better if you want hot reload, debugging, or to run backend/frontend directly from your shell.

### Step 1: Start Infrastructure Services

Start Redis and Qdrant only:

```bash
docker compose up -d redis qdrant
```

### Step 2: Create a Python Virtual Environment

Run the command for your terminal from the project root.

#### PowerShell

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

#### Command Prompt

```bat
python -m venv .venv
.venv\Scripts\activate.bat
```

#### Git Bash / WSL / Bash

```bash
python -m venv .venv
source .venv/Scripts/activate
```

After the environment is active, install backend dependencies:

```bash
pip install -r requirements.txt
```

### Step 3: Start the Backend API

Open a terminal in the project root, activate the virtual environment, then run:

```bash
uvicorn app.api.main:app --host 0.0.0.0 --port 8000 --reload
```

### Step 4: Start the Celery Worker

Open a second terminal in the project root, activate the virtual environment, then run:

```bash
celery -A app.worker.celery_app worker --loglevel=info --concurrency=2
```

### Step 5: Start the Angular Frontend

Open a third terminal:

```bash
cd frontend-angular
npm install
npm start
```

URLs in local-terminal mode:

- Frontend: `http://localhost:4200`
- API: `http://localhost:8000`

## 4. Verify the Installation

Check the API:

```bash
curl http://localhost:8000/api/v1/health
```

Open the frontend in your browser and confirm it can reach the API.

## 5. Common Issues

### Unsupported LLM provider

If startup fails with an error similar to `Only 'openrouter' is supported`, your `.env` is still set to an unsupported provider. Set:

```env
LLM_PROVIDER=openrouter
```

### Frontend shows API offline

- Confirm the backend is running on `http://localhost:8000`
- Confirm the frontend is using the correct API URL
- Check the backend logs for startup or model download errors

### Worker stays idle or tasks remain pending

- Make sure Redis and Qdrant are running
- Confirm `REDIS_URL` is `redis://localhost:6379/0` when running outside Docker
- Confirm the Celery worker is running in its own terminal

### OCR or model startup is slow on first run

This is expected on the first launch because Python dependencies and the embedding model may still be downloading or warming up.
