from app.worker.celery_app import celery_app
from celery.utils.log import get_task_logger
from app.services.ocr import extract_text_from_pdf
from app.services.text_processing import chunk_text
from app.services.embeddings import generate_embeddings
from app.services.vector_store import upsert_vectors
from app.services.llm import llm_client
from app.core.config import settings

logger = get_task_logger(__name__)

@celery_app.task(bind=True, name="app.worker.tasks.process_pdf_task", max_retries=3)
def process_pdf_task(self, doc_id: str, file_path: str, ocr_mode: str = "auto"):
    try:
        logger.info(f"Starting processing for doc_id: {doc_id}")
        progress_meta = {"doc_id": doc_id, "ocr_mode": ocr_mode}
        self.update_state(state='PROCESSING', meta={'step': 'OCR', **progress_meta})
        
        # 1. OCR / Digital text extraction
        logger.info("Step 1: Text Extraction")
        pages_text, extraction_meta = extract_text_from_pdf(file_path, ocr_mode=ocr_mode)
        progress_meta.update(
            {
                "ocr_mode": extraction_meta.get("ocr_mode_requested"),
                "ocr_used": extraction_meta.get("ocr_used"),
                "ocr_skipped": extraction_meta.get("ocr_skipped"),
                "ocr_skip_reason": extraction_meta.get("ocr_skip_reason"),
                "ingestion_mode": extraction_meta.get("ingestion_mode"),
                "pdf_type": extraction_meta.get("pdf_type"),
            }
        )
        
        if not pages_text:
            logger.warning("No text extracted from PDF.")
            return {
                "status": "failed",
                "reason": "No text extracted",
                **progress_meta,
            }

        self.update_state(state='PROCESSING', meta={'step': 'CHUNKING', **progress_meta})

        # 2. Chunking
        logger.info("Step 2: Chunking")
        chunks = chunk_text(pages_text, doc_id)
        
        self.update_state(state='PROCESSING', meta={'step': 'EMBEDDING', **progress_meta})
        
        # 3. Embeddings
        logger.info("Step 3: Generating Embeddings")
        embeddings_data = generate_embeddings(chunks) # Returns list of (vector, payload)
        
        # 4. Claim Extraction
        self.update_state(state='PROCESSING', meta={'step': 'CLAIM_EXTRACTION', **progress_meta})
        logger.info("Step 4: Extracting Claims")
        claim_chunks = []
        # Only extract claims from non-table chunks to save time/resources
        for chunk in chunks:
            if chunk["metadata"].get("is_table"):
                continue
            
            try:
                extracted_claims = llm_client.extract_claims_with_types(chunk["text"])
                for claim_obj in extracted_claims:
                    claim_text = claim_obj.get("text", "").strip()
                    claim_type = claim_obj.get("claim_type", "result").strip().lower()
                    if not claim_text:
                        continue

                    claim_chunks.append({
                        "text": claim_text,
                        "metadata": {
                            **chunk["metadata"],
                            "is_claim": True,
                            "claim_type": claim_type,
                            "content_type": "claim",
                            "original_text": chunk["text"][:200]
                        }
                    })
            except Exception as e:
                logger.error(f"Failed to extract claims from chunk: {e}")

        if claim_chunks:
            logger.info(f"Generated {len(claim_chunks)} claims")
            claim_embeddings = generate_embeddings(claim_chunks)
            embeddings_data.extend(claim_embeddings)

        self.update_state(state='PROCESSING', meta={'step': 'UPSERTING', **progress_meta})
        
        # 5. Upsert to Qdrant
        logger.info("Step 5: Upserting to Qdrant")
        upsert_vectors(settings.QDRANT_COLLECTION_NAME, embeddings_data)
        
        logger.info(f"Processing complete for doc_id: {doc_id}")
        return {
            "status": "completed",
            "doc_id": doc_id,
            "chunks_count": len(chunks),
            "claims_count": len(claim_chunks),
            **progress_meta,
        }
        
    except Exception as e:
        logger.error(f"Error processing PDF: {e}")
        self.retry(exc=e, countdown=2 ** self.request.retries)
        raise e
