from typing import List, Dict, Any
from app.core.config import settings

def _chunk_words(words: List[str], pages: List[int], section: str, doc_id: str, chunk_size: int, overlap: int) -> List[Dict[str, Any]]:
    chunks = []
    if not words:
        return chunks
        
    i = 0
    while i < len(words):
        end = min(i + chunk_size, len(words))
        chunk_words = words[i:end]
        chunk_str = " ".join(chunk_words)
        
        # Determine the page range for this chunk
        chunk_pages = pages[i:end]
        start_page = chunk_pages[0]
        end_page = chunk_pages[-1]
        
        chunks.append({
            "text": chunk_str,
            "metadata": {
                "doc_id": doc_id,
                "page": start_page,
                "end_page": end_page,
                "section": section,
                "filename": f"{doc_id}.pdf",
                "is_table": False
            }
        })
        
        i += (chunk_size - overlap)
        if chunk_size <= overlap:
            i += 1
            
    return chunks

def chunk_text(pages_data: List[Dict[str, Any]], doc_id: str) -> List[Dict[str, Any]]:
    """
    Chunks text while respecting section boundaries and handles tables.
    pages_data: list of { "page": int, "content": [{"text": str, "section": str}], "tables": [str] }
    Returns list of dicts: { "text": chunk_text, "metadata": { "doc_id": ..., "page": ..., "section": ..., "is_table": bool } }
    """
    chunks = []
    chunk_size = settings.CHUNK_TOKENS
    overlap = settings.CHUNK_OVERLAP_TOKENS
    
    current_section = "General"
    section_words = []
    section_pages = []
    
    for page_data in pages_data:
        page_num = page_data["page"]
        
        # Handle tables first
        for table_md in page_data.get("tables", []):
            chunks.append({
                "text": table_md,
                "metadata": {
                    "doc_id": doc_id,
                    "page": page_num,
                    "section": current_section, # Use last known section
                    "filename": f"{doc_id}.pdf",
                    "is_table": True
                }
            })

        for line in page_data["content"]:
            text = line["text"]
            section = line["section"]
            
            if section != current_section and section is not None:
                if section_words:
                    chunks.extend(_chunk_words(section_words, section_pages, current_section, doc_id, chunk_size, overlap))
                    section_words = []
                    section_pages = []
                current_section = section
            
            words = text.split()
            section_words.extend(words)
            section_pages.extend([page_num] * len(words))
            
    if section_words:
        chunks.extend(_chunk_words(section_words, section_pages, current_section, doc_id, chunk_size, overlap))
                
    return chunks
