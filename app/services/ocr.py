import re
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF
import pandas as pd
import structlog
import torch
from doctr.models import ocr_predictor

from app.services.sections import SECTION_ALIASES, normalize_section_name, section_bucket

logger = structlog.get_logger()

_predictor = None
KNOWN_CANONICAL_SECTIONS = set(SECTION_ALIASES.values()) - {"General"}
ALLOWED_OCR_MODES = {"auto", "always", "never"}

# Most section headers in research papers are short; long lines are likely body text.
MAX_SECTION_HEADING_WORDS = 8
MAX_SECTION_HEADING_CHARS = 80
HEADING_PREFIX_RE = re.compile(
    r"^\s*(?:\d+(?:\.\d+)*|[IVXLCM]+|[A-Z])[\)\].:\-\s]+",
    flags=re.IGNORECASE,
)

# Digital PDF detection thresholds.
DIGITAL_TEXT_PAGE_WORD_THRESHOLD = 20
DIGITAL_TOTAL_WORD_THRESHOLD = 80
DIGITAL_PAGE_RATIO_THRESHOLD = 0.3


def get_predictor():
    global _predictor
    if _predictor is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Loading Doctr model on {device}")
        try:
            _predictor = ocr_predictor(
                det_arch="db_resnet50",
                reco_arch="crnn_vgg16_bn",
                pretrained=True,
            ).to(device)
        except Exception as e:
            logger.error(f"Failed to load Doctr model: {e}")
            raise e
    return _predictor


def _looks_like_heading(line_text: str) -> bool:
    line = line_text.strip()
    letters = [ch for ch in line if ch.isalpha()]
    uppercase_ratio = (
        sum(ch.isupper() for ch in letters) / len(letters) if letters else 0.0
    )
    has_heading_prefix = bool(HEADING_PREFIX_RE.match(line))
    return (
        line.endswith(":")
        or line.istitle()
        or uppercase_ratio >= 0.6
        or has_heading_prefix
    )


def _detect_section_heading(line_text: str) -> Optional[str]:
    line = re.sub(r"\s+", " ", (line_text or "")).strip()
    if not line:
        return None
    if len(line) > MAX_SECTION_HEADING_CHARS:
        return None
    if len(line.split()) > MAX_SECTION_HEADING_WORDS:
        return None

    candidate = normalize_section_name(line)
    if candidate not in KNOWN_CANONICAL_SECTIONS:
        return None

    alias_candidate = HEADING_PREFIX_RE.sub("", line).strip().lower()
    alias_candidate = re.sub(r"[^\w\s]", "", alias_candidate).strip()
    is_known_alias = alias_candidate in SECTION_ALIASES

    if is_known_alias or _looks_like_heading(line):
        return candidate
    return None


def _clean_table_columns(columns: List[Any]) -> List[str]:
    cleaned = []
    seen = {}
    for idx, col in enumerate(columns):
        name = re.sub(r"\s+", " ", str(col or "")).strip()
        if not name or name.lower().startswith("unnamed"):
            name = f"col_{idx + 1}"
        if name in seen:
            seen[name] += 1
            name = f"{name}_{seen[name]}"
        else:
            seen[name] = 1
        cleaned.append(name)
    return cleaned


def _sanitize_cell(value: Any) -> str:
    if pd.isna(value):
        return ""
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text


def _table_to_payload(
    df: pd.DataFrame, page_num: int, current_section: str, table_idx: int
) -> Optional[Dict[str, Any]]:
    if df is None or df.empty:
        return None

    table_df = df.copy()
    table_df.columns = _clean_table_columns(list(table_df.columns))
    table_df = table_df.fillna("")

    normalized_rows = []
    metric_facts = []
    for row_idx, (_, row) in enumerate(table_df.iterrows(), start=1):
        pairs = []
        for col in table_df.columns:
            value = _sanitize_cell(row[col])
            if not value:
                continue
            pairs.append(f"{col}={value}")
            if re.search(r"\d", value):
                metric_facts.append(
                    f"Table {table_idx + 1}, row {row_idx}: {col} is {value}"
                )
        if pairs:
            normalized_rows.append(
                f"Table {table_idx + 1}, row {row_idx}: " + "; ".join(pairs)
            )

    dedup_metric_facts = list(dict.fromkeys(metric_facts))
    return {
        "table_id": f"page{page_num}_table{table_idx + 1}",
        "section": current_section,
        "section_bucket": section_bucket(current_section),
        "shape": [int(table_df.shape[0]), int(table_df.shape[1])],
        "markdown": table_df.to_markdown(index=False),
        "normalized_rows": normalized_rows,
        "metric_facts": dedup_metric_facts,
    }


def _extract_page_tables(
    page: fitz.Page, page_num: int, current_section: str
) -> List[Dict[str, Any]]:
    page_tables = []
    try:
        tabs = page.find_tables()
        table_iterable = tabs.tables if hasattr(tabs, "tables") else tabs
        for table_idx, tab in enumerate(table_iterable):
            table_payload = _table_to_payload(
                tab.to_pandas(),
                page_num,
                current_section,
                table_idx,
            )
            if table_payload:
                page_tables.append(table_payload)
    except Exception as e:
        logger.warning(f"Table extraction failed on page {page_num}: {e}")
    return page_tables


def _extract_content_from_lines(
    raw_lines: List[str], current_section: str
) -> Tuple[List[Dict[str, Any]], str]:
    page_content = []
    section_state = current_section

    for raw_line in raw_lines:
        line_text = re.sub(r"\s+", " ", (raw_line or "")).strip()
        if not line_text:
            continue

        detected_section = _detect_section_heading(line_text)
        if detected_section:
            section_state = detected_section

        page_content.append(
            {
                "text": line_text,
                "section": section_state,
                "section_bucket": section_bucket(section_state),
            }
        )

    return page_content, section_state


def _extract_page_content_from_digital_text(
    page: fitz.Page, current_section: str
) -> Tuple[List[Dict[str, Any]], str]:
    page_text = page.get_text("text") or ""
    lines = page_text.splitlines()
    return _extract_content_from_lines(lines, current_section)


def _extract_page_content_with_ocr(
    page: fitz.Page, predictor: Any, current_section: str
) -> Tuple[List[Dict[str, Any]], str]:
    import cv2
    import numpy as np

    pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
    img_bytes = pix.tobytes("png")
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    result = predictor([img])

    lines = []
    for block in result.pages[0].blocks:
        for line in block.lines:
            lines.append(" ".join(word.value for word in line.words).strip())

    return _extract_content_from_lines(lines, current_section)


def _detect_digital_pdf(doc: fitz.Document) -> Dict[str, Any]:
    total_pages = len(doc)
    pages_with_text = 0
    total_words = 0

    for page in doc:
        word_count = len((page.get_text("text") or "").split())
        total_words += word_count
        if word_count >= DIGITAL_TEXT_PAGE_WORD_THRESHOLD:
            pages_with_text += 1

    text_page_ratio = (pages_with_text / total_pages) if total_pages else 0.0
    is_digital_pdf = (
        total_words >= DIGITAL_TOTAL_WORD_THRESHOLD
        and (
            pages_with_text >= 1
            or text_page_ratio >= DIGITAL_PAGE_RATIO_THRESHOLD
        )
    )

    if total_pages and pages_with_text == total_pages and total_words > 20:
        is_digital_pdf = True

    return {
        "is_digital_pdf": is_digital_pdf,
        "total_pages": total_pages,
        "pages_with_text": pages_with_text,
        "total_words": total_words,
        "text_page_ratio": round(text_page_ratio, 3),
    }


def _resolve_ocr_strategy(
    ocr_mode: str, digital_signal: Dict[str, Any]
) -> Dict[str, Any]:
    mode = (ocr_mode or "auto").strip().lower()
    if mode not in ALLOWED_OCR_MODES:
        raise ValueError(
            f"Invalid ocr_mode '{ocr_mode}'. Allowed values: auto, always, never."
        )

    if mode == "always":
        return {
            "ocr_mode_requested": mode,
            "ocr_used": True,
            "ocr_skipped": False,
            "ocr_skip_reason": None,
            "ingestion_mode": "ocr",
        }

    if mode == "never":
        return {
            "ocr_mode_requested": mode,
            "ocr_used": False,
            "ocr_skipped": True,
            "ocr_skip_reason": "ocr_disabled_by_request",
            "ingestion_mode": "digital_text",
        }

    if digital_signal.get("is_digital_pdf"):
        return {
            "ocr_mode_requested": mode,
            "ocr_used": False,
            "ocr_skipped": True,
            "ocr_skip_reason": "digital_pdf_detected",
            "ingestion_mode": "digital_text",
        }

    return {
        "ocr_mode_requested": mode,
        "ocr_used": True,
        "ocr_skipped": False,
        "ocr_skip_reason": None,
        "ingestion_mode": "ocr",
    }


def extract_text_from_pdf(
    file_path: str, ocr_mode: str = "auto"
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Extract text and tables from PDF with optional OCR:
    - auto: skip OCR for digital PDFs
    - always: always run OCR
    - never: never run OCR (embedded text only)
    """
    doc = None
    try:
        doc = fitz.open(file_path)
        digital_signal = _detect_digital_pdf(doc)
        strategy = _resolve_ocr_strategy(ocr_mode, digital_signal)

        results = []
        predictor = get_predictor() if strategy["ocr_used"] else None
        current_section = "General"

        for page_num, page in enumerate(doc, start=1):
            if strategy["ocr_used"]:
                page_content, current_section = _extract_page_content_with_ocr(
                    page, predictor, current_section
                )
            else:
                page_content, current_section = _extract_page_content_from_digital_text(
                    page, current_section
                )

            page_tables = _extract_page_tables(page, page_num, current_section)
            results.append(
                {
                    "page": page_num,
                    "content": page_content,
                    "tables": page_tables,
                }
            )

        extraction_meta = {
            **strategy,
            "pdf_type": "digital" if digital_signal["is_digital_pdf"] else "scanned_or_image",
            "digital_signal": digital_signal,
        }
        return results, extraction_meta
    except Exception as e:
        logger.error(f"Text extraction failed: {e}")
        raise e
    finally:
        if doc is not None:
            doc.close()
