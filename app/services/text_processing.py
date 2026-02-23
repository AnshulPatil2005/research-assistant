from typing import List, Dict, Any
from app.core.config import settings
from app.services.sections import normalize_section_name, section_bucket


def _chunk_words(
    words: List[str],
    pages: List[int],
    section: str,
    section_group: str,
    doc_id: str,
    chunk_size: int,
    overlap: int,
) -> List[Dict[str, Any]]:
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
                "section_bucket": section_group,
                "filename": f"{doc_id}.pdf",
                "is_table": False,
                "is_claim": False,
                "content_type": "text",
            }
        })

        i += (chunk_size - overlap)
        if chunk_size <= overlap:
            i += 1

    return chunks


def chunk_text(pages_data: List[Dict[str, Any]], doc_id: str) -> List[Dict[str, Any]]:
    """
    Chunks text while respecting section boundaries and handles tables.
    pages_data: list of { "page": int, "content": [{"text": str, "section": str}], "tables": [table_payload|str] }
    Returns list of dicts: { "text": chunk_text, "metadata": { "doc_id": ..., "page": ..., "section": ..., "is_table": bool } }
    """
    chunks = []
    chunk_size = settings.CHUNK_TOKENS
    overlap = settings.CHUNK_OVERLAP_TOKENS

    current_section = "General"
    current_section_bucket = section_bucket(current_section)
    section_words = []
    section_pages = []

    for page_data in pages_data:
        page_num = page_data["page"]

        # Handle tables first
        for table_obj in page_data.get("tables", []):
            if isinstance(table_obj, str):
                table_payloads = [{
                    "table_id": f"page{page_num}_table_legacy",
                    "section": current_section,
                    "section_bucket": current_section_bucket,
                    "markdown": table_obj,
                    "normalized_rows": [],
                    "metric_facts": [],
                }]
            else:
                table_payloads = [table_obj]

            for table_payload in table_payloads:
                table_section = normalize_section_name(
                    table_payload.get("section", current_section)
                )
                table_section_bucket = table_payload.get("section_bucket") or section_bucket(table_section)
                table_id = table_payload.get("table_id", f"page{page_num}_table")
                table_shape = table_payload.get("shape")

                markdown_text = table_payload.get("markdown", "")
                if markdown_text:
                    chunks.append({
                        "text": markdown_text,
                        "metadata": {
                            "doc_id": doc_id,
                            "page": page_num,
                            "section": table_section,
                            "section_bucket": table_section_bucket,
                            "filename": f"{doc_id}.pdf",
                            "is_table": True,
                            "is_claim": False,
                            "table_id": table_id,
                            "table_shape": table_shape,
                            "table_variant": "raw_markdown",
                            "content_type": "table",
                        }
                    })

                for row_text in table_payload.get("normalized_rows", []):
                    chunks.append({
                        "text": row_text,
                        "metadata": {
                            "doc_id": doc_id,
                            "page": page_num,
                            "section": table_section,
                            "section_bucket": table_section_bucket,
                            "filename": f"{doc_id}.pdf",
                            "is_table": True,
                            "is_claim": False,
                            "table_id": table_id,
                            "table_shape": table_shape,
                            "table_variant": "normalized_row",
                            "content_type": "table_row",
                        }
                    })

                for metric_text in table_payload.get("metric_facts", []):
                    chunks.append({
                        "text": metric_text,
                        "metadata": {
                            "doc_id": doc_id,
                            "page": page_num,
                            "section": table_section,
                            "section_bucket": table_section_bucket,
                            "filename": f"{doc_id}.pdf",
                            "is_table": True,
                            "is_claim": False,
                            "table_id": table_id,
                            "table_shape": table_shape,
                            "table_variant": "metric_fact",
                            "content_type": "table_metric",
                        }
                    })

        for line in page_data["content"]:
            text = line["text"]
            section = normalize_section_name(line.get("section"))
            section_group = line.get("section_bucket") or section_bucket(section)

            if section != current_section and section is not None:
                if section_words:
                    chunks.extend(
                        _chunk_words(
                            section_words,
                            section_pages,
                            current_section,
                            current_section_bucket,
                            doc_id,
                            chunk_size,
                            overlap,
                        )
                    )
                    section_words = []
                    section_pages = []
                current_section = section
                current_section_bucket = section_group

            words = text.split()
            section_words.extend(words)
            section_pages.extend([page_num] * len(words))

    if section_words:
        chunks.extend(
            _chunk_words(
                section_words,
                section_pages,
                current_section,
                current_section_bucket,
                doc_id,
                chunk_size,
                overlap,
            )
        )

    return chunks
