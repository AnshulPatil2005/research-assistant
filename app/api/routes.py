from fastapi import APIRouter, UploadFile, File, HTTPException, Request
import hashlib
import os
import aiofiles
import re
from typing import Optional, List
from app.core.config import settings
from app.worker.celery_app import celery_app
from app.services.vector_store import search_vectors
from app.services.embeddings import get_model
from app.services.llm import llm_client
from app.services.sections import normalize_section_name
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
router = APIRouter()
ALLOWED_OCR_MODES = {"auto", "always", "never"}


def _safe_remove(path: str) -> None:
    try:
        os.remove(path)
    except FileNotFoundError:
        pass

class ChatRequest(BaseModel):
    query: str
    doc_id: Optional[str] = None
    section: Optional[str] = None
    sections: Optional[List[str]] = None
    section_bucket: Optional[str] = None
    is_claim: Optional[bool] = None
    claim_type: Optional[str] = None
    is_table: Optional[bool] = None
    table_variant: Optional[str] = None
    
class ChatResponse(BaseModel):
    answer: str
    citations: list

class SummaryResponse(BaseModel):
    summary: str

@router.post("/chat", response_model=ChatResponse)
@limiter.limit("20/minute")
async def chat(request: Request, body: ChatRequest):
    normalized_section_bucket = (
        body.section_bucket.strip().lower().replace(" ", "_")
        if body.section_bucket
        else None
    )
    if normalized_section_bucket == "key_results":
        normalized_section_bucket = "results"
    normalized_claim_type = body.claim_type.strip().lower() if body.claim_type else None
    normalized_table_variant = body.table_variant.strip().lower() if body.table_variant else None

    normalized_section = normalize_section_name(body.section) if body.section else None
    normalized_sections = (
        [normalize_section_name(s) for s in body.sections if s]
        if body.sections
        else None
    )
    if normalized_section and normalized_sections:
        normalized_sections.append(normalized_section)
    if normalized_sections:
        normalized_sections = list(dict.fromkeys(normalized_sections))

    # 1. Embed query
    model = get_model()
    query_vector = model.encode(body.query).tolist()
    
    # 2. Search Qdrant
    search_results = search_vectors(
        query_vector, 
        top_k=settings.RAG_TOP_K, 
        doc_id=body.doc_id,
        section=normalized_section,
        sections=normalized_sections,
        section_bucket=normalized_section_bucket,
        is_claim=body.is_claim,
        claim_type=normalized_claim_type,
        is_table=body.is_table,
        table_variant=normalized_table_variant,
    )

    if not search_results:
        return {
            "answer": (
                "I don't know based on the provided document evidence. "
                "No relevant passages were retrieved for this query."
            ),
            "citations": [],
        }
    
    # 3. Construct Context
    evidence_blocks = []
    citations = []
    
    for idx, hit in enumerate(search_results, start=1):
        payload = hit.payload
        text = payload.get("text", "")
        page = payload.get("page")
        section = payload.get("section", "General")
        section_bucket = payload.get("section_bucket", "other")
        is_table = payload.get("is_table", False)
        is_claim = payload.get("is_claim", False)
        claim_type = payload.get("claim_type")
        table_variant = payload.get("table_variant")
        content_type = payload.get("content_type", "text")
        
        prefix = f"[Page {page}, Section {section}]"
        if is_table:
            prefix += " [Table]"
            if table_variant:
                prefix += f" [Table:{table_variant}]"
        if is_claim:
            prefix += " [Atomic Claim]"
            if claim_type:
                prefix += f" [ClaimType:{claim_type}]"
        evidence_blocks.append(f"EVIDENCE {idx} {prefix}\n{text}")
        
        citations.append({
            "doc_id": payload.get("doc_id"),
            "page": page,
            "section": section,
            "section_bucket": section_bucket,
            "filename": payload.get("filename"),
            "is_table": is_table,
            "is_claim": is_claim,
            "claim_type": claim_type,
            "table_variant": table_variant,
            "content_type": content_type,
            "text_snippet": text[:200] + "..."
        })
    
    # 4. Generate Answer
    system_prompt = (
        "You are a citation-aware research assistant.\n"
        "Rules:\n"
        "1) Use only the provided evidence blocks.\n"
        "2) Every factual statement must include an inline citation in the form [Page X, Section Y].\n"
        "3) Include direct verbatim quotes from evidence in double quotes where possible.\n"
        "4) If evidence is insufficient, answer exactly: I don't know based on the provided evidence.\n"
        "5) Do not use outside knowledge."
    )
    prompt = (
        "Evidence:\n"
        f"{chr(10).join(evidence_blocks)}\n\n"
        f"Question: {body.query}\n\n"
        "Provide a concise answer grounded only in evidence."
    )
    
    answer = llm_client.generate_response(prompt, system_prompt=system_prompt)

    # Repair pass if provider omits required citation format.
    if citations and not re.search(r"\[Page\s+\d+,\s*Section\s+[^\]]+\]", answer):
        repair_prompt = (
            f"Rewrite the answer below so every factual statement has [Page X, Section Y] citations "
            "and includes direct quotes from the provided evidence.\n\n"
            f"Answer to rewrite:\n{answer}"
        )
        answer = llm_client.generate_response(repair_prompt, system_prompt=system_prompt)
    
    return {
        "answer": answer,
        "citations": citations
    }

@router.post("/upload")
@limiter.limit("5/minute")
async def upload_pdf(
    request: Request,
    file: UploadFile = File(...),
    force: bool = False,
    ocr_mode: str = "auto",
):
    normalized_ocr_mode = (ocr_mode or "auto").strip().lower()
    if normalized_ocr_mode not in ALLOWED_OCR_MODES:
        raise HTTPException(
            status_code=400,
            detail="Invalid ocr_mode. Allowed values: auto, always, never.",
        )

    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    # Streaming upload to temp file and calculating hash
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    sha256_hash = hashlib.sha256()
    temp_filename = f"temp_{os.urandom(8).hex()}.pdf"
    temp_path = os.path.join(settings.UPLOAD_DIR, temp_filename)
    
    try:
        async with aiofiles.open(temp_path, 'wb') as out_file:
            total_size = 0
            while content := await file.read(1024 * 1024): # 1MB chunks
                total_size += len(content)
                if total_size > settings.MAX_UPLOAD_MB * 1024 * 1024:
                     # Close and delete
                     await out_file.close()
                     _safe_remove(temp_path)
                     raise HTTPException(status_code=400, detail=f"File exceeds maximum size of {settings.MAX_UPLOAD_MB}MB")
                
                sha256_hash.update(content)
                await out_file.write(content)
    except Exception as e:
        if os.path.exists(temp_path):
             _safe_remove(temp_path)
        raise e

    # Determine Doc ID
    file_hash = sha256_hash.hexdigest()
    doc_id = file_hash
    final_filename = f"{doc_id}.pdf"
    final_path = os.path.join(settings.UPLOAD_DIR, final_filename)

    if os.path.exists(final_path) and not force:
         _safe_remove(temp_path) # Delete temp
         return {
             "message": "File already exists. Use force=true to re-process.",
             "doc_id": doc_id,
             "status": "existing",
             "ocr_mode": normalized_ocr_mode,
         }

    # Rename temp to final
    os.rename(temp_path, final_path)

    # Enqueue Task
    task = celery_app.send_task(
        "app.worker.tasks.process_pdf_task",
        args=[doc_id, final_path, normalized_ocr_mode],
    )
    
    return {
        "message": "File uploaded and processing started.",
        "status": "processing",
        "doc_id": doc_id,
        "task_id": task.id,
        "ocr_mode": normalized_ocr_mode,
    }

@router.get("/status/{task_id}")
async def get_status(task_id: str):
    task_result = celery_app.AsyncResult(task_id)
    
    response = {
        "task_id": task_id,
        "status": task_result.status,
    }
    
    if task_result.status == "PROCESSING":
         response["info"] = task_result.info # Contains the meta dict
    elif task_result.ready():
         response["result"] = task_result.result
    else:
         # PENDING or other states
         pass
         
    return response

@router.get("/summary/{doc_id}", response_model=SummaryResponse)
async def get_summary(doc_id: str):
    # 1. Retrieve structured evidence by summary bucket.
    summary_targets = {
        "Problem": ["Abstract", "Introduction", "Related Work"],
        "Method": ["Methods"],
        "Key Results": ["Results"],
        "Limitations": ["Limitations", "Conclusion"],
    }
    context_sections = []
    for label, target_sections in summary_targets.items():
        hits = search_vectors(
            doc_id=doc_id,
            sections=target_sections,
            top_k=settings.SUMMARY_TOP_K_PER_SECTION,
        )
        if not hits:
            # Fallback to coarse bucket retrieval.
            bucket_name = label.lower().replace(" ", "_")
            bucket_name = "results" if bucket_name == "key_results" else bucket_name
            hits = search_vectors(
                doc_id=doc_id,
                section_bucket=bucket_name,
                top_k=settings.SUMMARY_TOP_K_PER_SECTION,
            )
        if not hits:
            continue

        snippets = []
        for hit in hits:
            payload = hit.payload
            snippets.append(
                f"[Page {payload.get('page')}, Section {payload.get('section', 'General')}] "
                f"{payload.get('text', '')}"
            )
        context_sections.append(f"{label} Evidence:\n" + "\n".join(snippets))

    context_text = "\n\n".join(context_sections)
    if not context_text:
        # Fallback: get first few chunks if no section cues were captured.
        hits = search_vectors(doc_id=doc_id, top_k=settings.SUMMARY_FALLBACK_TOP_K)
        context_text = "\n".join(
            f"[Page {hit.payload.get('page')}, Section {hit.payload.get('section', 'General')}] {hit.payload.get('text', '')}"
            for hit in hits
        )

    if not context_text:
        raise HTTPException(status_code=404, detail="Document not found or no content extracted.")

    # 2. Generate summary using LLM
    system_prompt = (
        "You are a research assistant. Produce a paper-at-a-glance summary from evidence only.\n"
        "Return exactly these sections in order:\n"
        "1) Problem\n"
        "2) Method\n"
        "3) Key Results\n"
        "4) Limitations\n"
        "Under each section, provide bullet points and include citations in the form [Page X, Section Y].\n"
        "Use short verbatim quotes when possible.\n"
        "If evidence for a section is missing, write one bullet: Insufficient evidence."
    )
    prompt = (
        f"Evidence:\n{context_text}\n\n"
        "Generate the structured summary now."
    )
    
    summary = llm_client.generate_response(prompt, system_prompt=system_prompt)
    
    return {"summary": summary}

@router.get("/health")
async def health_check():
    return {"status": "ok"}
