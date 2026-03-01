# docRAG

A document question-answering system that extracts text from PDFs using OCR and enables semantic search through a REST API.

## Architecture

- **FastAPI** backend with async processing via Celery
- **Redis** for task queue management
- **doctr** for OCR text extraction
- **Qdrant** vector database for semantic search
- **Sentence Transformers** for generating embeddings (local)
- **OpenRouter** for LLM inference
- **Angular 17** frontend with standalone components

### How It Works

The system uses **two different models** for different purposes:

```
PDF → OCR → Text chunks → Embedding Model → Vectors stored in Qdrant
                                                    ↓
User Query → Embedding Model → Vector search → Top K chunks retrieved
                                                    ↓
                              Retrieved chunks + Query → LLM → Answer
```

1. **Embedding Model** (local, free) - Converts text into vectors for semantic search
2. **LLM Model** (OpenRouter-backed) - Generates natural language answers from retrieved context

## Research Features

- **Section-Aware Parsing**: OCR text is labeled into canonical sections (Abstract, Methods, Results, Limitations, etc.) and chunked while preserving section boundaries.
- **Citation-Aware Question Answering**: Chat answers are generated from retrieved evidence only, with inline `[Page X, Section Y]` references and quote-first prompting.
- **Paper-at-a-Glance Summary**: `/api/v1/summary/{doc_id}` produces a structured overview of Problem, Method, Key Results, and Limitations.
- **Claim Extraction and Indexing**: Worker extracts atomic claims and stores typed claim metadata (`method`, `result`, `assumption`) for precise retrieval.
- **Table Extraction and Table-Aware Retrieval**: Tables are indexed as raw markdown, normalized row statements, and metric facts for quantitative queries.
- **Optional OCR for Digital PDFs**: Upload supports `ocr_mode` (`auto`, `always`, `never`). In `auto`, OCR is skipped for digital PDFs and status reports the skip.

## Requirements

- Docker & Docker Compose
- Python 3.11
- Node.js 18+
- OpenRouter API key
- (Optional) Make for build shortcuts

## Project Structure

```
docRAG/
├── app/                    # Backend Python application
│   ├── api/               # FastAPI routes and main app
│   ├── core/              # Configuration
│   ├── services/          # OCR, embeddings, LLM, vector store
│   └── worker/            # Celery tasks
├── frontend-angular/       # Angular 17 frontend (recommended)
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/  # UI components
│   │   │   ├── services/    # API service
│   │   │   └── models/      # TypeScript interfaces
│   │   └── styles.scss      # Global styles
│   ├── Dockerfile
│   └── nginx.conf
├── frontend/              # Legacy vanilla JS frontend
├── scripts/               # Helper scripts
└── docker-compose.yml
```

## Installation

Use [INSTALLATION.md](INSTALLATION.md) for the full step-by-step setup guide.

The installation guide covers:

- Full-stack startup with Docker
- Local development with separate terminals
- PowerShell, Command Prompt, and Bash setup commands
- Required `.env` values for Docker and non-Docker runs

Quick start:

```bash
docker compose up --build -d
```

Important notes:

- `LLM_PROVIDER` must be `openrouter`
- When running the backend outside Docker, set `REDIS_URL=redis://localhost:6379/0`, `QDRANT_URL=http://localhost:6333`, and `UPLOAD_DIR=uploads`
- The first backend startup downloads the embedding model, so it will be slower than later runs

## Deployment

### Backend on Render

1. Create a new Web Service on Render
2. Connect your repository
3. Set build command: `docker build -t app .`
4. Set start command based on your Dockerfile
5. Add environment variables from your `.env` file

The backend is configured to accept CORS requests from any origin (`allow_origins=["*"]`).

### Frontend on Vercel

1. Import your repository on Vercel
2. Set the root directory to `frontend-angular`
3. Framework preset: Angular
4. Build command: `npm run build`
5. Output directory: `dist/docrag-frontend/browser`

The frontend is pre-configured to connect to `https://docrag-2gvg.onrender.com`. To change this, update:
- `frontend-angular/src/app/services/api.service.ts` - `DEFAULT_API_URL` constant
- `frontend-angular/src/index.html` - default input value

### Keep-Alive for Render Free Tier

The Angular frontend includes automatic keep-alive functionality that pings the backend every 14 minutes to prevent Render's free tier from sleeping (which happens after 15 minutes of inactivity). This only works while the frontend is open in a browser.

For reliable uptime without the frontend open, use an external monitoring service like UptimeRobot to ping your backend's `/api/v1/health` endpoint.

## Usage

### Web Interface

Open the frontend URL in your browser:
- Local: http://localhost:4200
- Deployed: Your Vercel URL

**Features:**
- API URL configuration with online/offline status indicator
- Drag & drop PDF upload with optional force re-processing
- Task status monitoring with auto-refresh
- Chat/query interface with citation display
- Recent tasks tracking with quick actions

### Quick Start Workflow

1. **Upload a PDF**
   - Drag & drop or click to select a PDF file
   - Click "Upload PDF"
   - Note the `task_id` and `doc_id` returned

2. **Monitor Processing**
   - The task ID auto-fills for status checking
   - Status progresses: PENDING → STARTED → SUCCESS

3. **Query Documents**
   - Enter your question in the chat section
   - Optionally specify a `doc_id` to search only that document
   - View the answer and citations with source references

### Command Line

Upload a PDF:
```bash
./scripts/load_small_pdf.sh "/path/to/document.pdf"
```

Query your documents:
```bash
./scripts/query_rag.sh "What is the main topic of the document?"
```

## API Reference

All endpoints are prefixed with `/api/v1`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/health` | GET | Health check |
| `/api/v1/upload` | POST | Upload a PDF for processing |
| `/api/v1/status/{task_id}` | GET | Check processing status |
| `/api/v1/chat` | POST | Query documents with natural language |
| `/api/v1/summary/{doc_id}` | GET | Structured paper-at-a-glance summary |

### Example API Calls

**Upload PDF:**
```bash
curl -X POST "http://localhost:8000/api/v1/upload" \
  -F "file=@document.pdf"
```

**Upload PDF with OCR mode:**
```bash
curl -X POST "http://localhost:8000/api/v1/upload?ocr_mode=auto" \
  -F "file=@document.pdf"
```

**Check Status:**
```bash
curl "http://localhost:8000/api/v1/status/{task_id}"
```

**Chat Query:**
```bash
curl -X POST "http://localhost:8000/api/v1/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the main quantitative results?",
    "doc_id": "optional-doc-id",
    "sections": ["Results", "Limitations"],
    "is_table": true,
    "table_variant": "metric_fact",
    "is_claim": false
  }'
```

## Development

### Backend

Run tests:
```bash
docker-compose run api pytest
```

View logs:
```bash
docker-compose logs -f api      # API logs
docker-compose logs -f worker   # Worker logs
```

### Frontend

The Angular frontend uses:
- Angular 17 with standalone components
- Signals for reactive state management
- SCSS for styling
- Inter font for typography

Key files:
- `src/app/services/api.service.ts` - API communication and state
- `src/app/components/` - UI components (upload, status, chat, recent-tasks, header)
- `src/styles.scss` - Global styles and CSS variables

## Troubleshooting

### Unsupported LLM provider
If startup fails with an error saying only `openrouter` is supported, update `.env` so `LLM_PROVIDER=openrouter`.

### API shows "Offline" in frontend
- Check containers are running: `docker-compose ps`
- Check API logs: `docker-compose logs api`
- Verify the API URL is correct in the frontend header
- If deployed, ensure CORS is enabled and the backend is awake

### CORS errors in browser console
The backend has CORS enabled for all origins. If you still see errors:
- Ensure the backend is running and accessible
- Check that the URL doesn't have a trailing slash
- Verify the backend responded (might be sleeping on Render free tier)

### OCR processing fails
Check worker logs: `docker-compose logs -f worker`

### Status stays "PENDING"
- Check worker is running: `docker-compose ps`
- Check worker logs: `docker-compose logs worker`
- Verify Redis and Qdrant are healthy

### Connection errors
Verify Qdrant is running: `curl http://localhost:6333/collections`

### No results when querying
- Ensure document processing completed (status: SUCCESS)
- Check if embeddings were generated in the worker logs
- Try a more specific question

### Changed embedding model but search doesn't work
If you change `EMBEDDING_MODEL` after uploading documents, the old vectors are incompatible. Re-upload your documents to regenerate embeddings with the new model.

### Frontend build fails
```bash
cd frontend-angular
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Render backend sleeping
Render free tier sleeps after 15 minutes of inactivity. The first request after sleeping may take 30-60 seconds. Keep the frontend open to maintain keep-alive pings, or use an external monitoring service.
