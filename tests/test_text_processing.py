from app.core.config import settings
from app.services.sections import normalize_section_name, section_bucket
from app.services.text_processing import chunk_text


def test_section_normalization_and_bucketing():
    assert normalize_section_name("1. INTRODUCTION") == "Introduction"
    assert normalize_section_name("materials and methods") == "Methods"
    assert normalize_section_name("THREATS TO VALIDITY") == "Limitations"
    assert section_bucket("Methods") == "method"
    assert section_bucket("Results") == "results"


def test_chunk_text_respects_section_boundaries():
    original_chunk_size = settings.CHUNK_TOKENS
    original_overlap = settings.CHUNK_OVERLAP_TOKENS
    settings.CHUNK_TOKENS = 50
    settings.CHUNK_OVERLAP_TOKENS = 5

    try:
        pages_data = [
            {
                "page": 1,
                "content": [
                    {"text": "Abstract", "section": "Abstract"},
                    {"text": "This work studies retrieval augmented generation.", "section": "Abstract"},
                    {"text": "Methods", "section": "Methods"},
                    {"text": "We train a dual encoder with contrastive learning.", "section": "Methods"},
                ],
                "tables": [],
            }
        ]

        chunks = chunk_text(pages_data, "doc123")
        text_chunks = [c for c in chunks if not c["metadata"].get("is_table")]
        sections = [c["metadata"]["section"] for c in text_chunks]

        assert "Abstract" in sections
        assert "Methods" in sections
        assert all("section_bucket" in c["metadata"] for c in text_chunks)
        assert all("content_type" in c["metadata"] for c in text_chunks)
    finally:
        settings.CHUNK_TOKENS = original_chunk_size
        settings.CHUNK_OVERLAP_TOKENS = original_overlap


def test_chunk_text_indexes_table_variants():
    pages_data = [
        {
            "page": 2,
            "content": [{"text": "Results", "section": "Results"}],
            "tables": [
                {
                    "table_id": "page2_table1",
                    "section": "Results",
                    "section_bucket": "results",
                    "shape": [2, 2],
                    "markdown": "| metric | value |\n|---|---|\n| accuracy | 91.2 |",
                    "normalized_rows": [
                        "Table 1, row 1: metric=accuracy; value=91.2",
                    ],
                    "metric_facts": [
                        "Table 1, row 1: value is 91.2",
                    ],
                }
            ],
        }
    ]

    chunks = chunk_text(pages_data, "doc456")
    table_chunks = [c for c in chunks if c["metadata"].get("is_table")]
    variants = {c["metadata"].get("table_variant") for c in table_chunks}

    assert "raw_markdown" in variants
    assert "normalized_row" in variants
    assert "metric_fact" in variants
    assert all(c["metadata"]["section"] == "Results" for c in table_chunks)
