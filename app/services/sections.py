import re
from typing import Optional

# Canonical sections used across parsing, indexing, and retrieval.
SECTION_ALIASES = {
    "abstract": "Abstract",
    "introduction": "Introduction",
    "intro": "Introduction",
    "background": "Introduction",
    "related work": "Related Work",
    "literature review": "Related Work",
    "methods": "Methods",
    "method": "Methods",
    "methodology": "Methods",
    "materials and methods": "Methods",
    "approach": "Methods",
    "experimental setup": "Methods",
    "results": "Results",
    "result": "Results",
    "findings": "Results",
    "evaluation": "Results",
    "experiments": "Results",
    "discussion": "Results",
    "limitations": "Limitations",
    "limitation": "Limitations",
    "threats to validity": "Limitations",
    "caveats": "Limitations",
    "weaknesses": "Limitations",
    "conclusion": "Conclusion",
    "conclusions": "Conclusion",
    "future work": "Conclusion",
    "references": "References",
    "reference": "References",
    "bibliography": "References",
    "general": "General",
}

SECTION_PREFIX_RE = re.compile(
    r"^\s*(?:\d+(?:\.\d+)*|[IVXLCM]+|[A-Z])[\)\].:\-\s]+",
    flags=re.IGNORECASE,
)


def _sanitize_section_text(value: str) -> str:
    value = value or ""
    value = value.replace("_", " ").replace("-", " ")
    value = re.sub(r"\s+", " ", value).strip()
    value = SECTION_PREFIX_RE.sub("", value).strip()
    value = re.sub(r"[^\w\s]", "", value).strip()
    return value


def normalize_section_name(value: Optional[str]) -> str:
    if not value:
        return "General"
    cleaned = _sanitize_section_text(value).lower()
    if not cleaned:
        return "General"
    return SECTION_ALIASES.get(cleaned, cleaned.title())


def section_bucket(section_name: Optional[str]) -> str:
    section = normalize_section_name(section_name)
    if section in {"Abstract", "Introduction", "Related Work"}:
        return "problem"
    if section == "Methods":
        return "method"
    if section == "Results":
        return "results"
    if section in {"Limitations", "Conclusion"}:
        return "limitations"
    return "other"
