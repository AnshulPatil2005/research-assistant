from qdrant_client import QdrantClient
from qdrant_client.http import models
from app.core.config import settings
import structlog
import uuid
from typing import Optional, List

logger = structlog.get_logger()

_client = None

def get_client():
    global _client
    if _client is None:
        _client = QdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY
        )
    return _client

def init_collection():
    client = get_client()
    collection_name = settings.QDRANT_COLLECTION_NAME
    
    # Check if exists
    collections = client.get_collections().collections
    exists = any(c.name == collection_name for c in collections)
    
    if not exists:
        logger.info(f"Creating collection {collection_name}")
        # Dimension depends on model. all-MiniLM-L6-v2 is 384.
        # We should ideally get this from the model, but hardcoding for now or config.
        # SentenceTransformer default is 384.
        
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=settings.EMBEDDING_DIMENSION, 
                distance=models.Distance.COSINE
            )
        )

def upsert_vectors(collection_name: str, embeddings_data: list):
    """
    embeddings_data: list of dicts { "vector": ..., "payload": ... }
    """
    client = get_client()
    
    # Ensure collection exists
    init_collection()
    
    points = []
    for item in embeddings_data:
        points.append(models.PointStruct(
            id=str(uuid.uuid4()), # Generate random UUID for the point
            vector=item["vector"],
            payload=item["payload"]
        ))
        
    # Batch upsert
    # Qdrant client handles batching but explicit batching is good for huge lists.
    # For now, just upsert all.
    
    if points:
        client.upsert(
            collection_name=collection_name,
            points=points
        )
        logger.info(f"Upserted {len(points)} points to {collection_name}")

def search_vectors(
    query_vector: list = None,
    top_k: int = 5,
    doc_id: str = None,
    section: str = None,
    sections: Optional[List[str]] = None,
    section_bucket: str = None,
    is_claim: bool = None,
    claim_type: str = None,
    is_table: bool = None,
    table_variant: str = None,
):
    client = get_client()
    collection_name = settings.QDRANT_COLLECTION_NAME
    
    must_filters = []
    if doc_id:
        must_filters.append(models.FieldCondition(key="doc_id", match=models.MatchValue(value=doc_id)))
    if section:
        must_filters.append(models.FieldCondition(key="section", match=models.MatchValue(value=section)))
    if sections:
        must_filters.append(
            models.FieldCondition(key="section", match=models.MatchAny(any=sections))
        )
    if section_bucket:
        must_filters.append(models.FieldCondition(key="section_bucket", match=models.MatchValue(value=section_bucket)))
    if is_claim is not None:
        must_filters.append(models.FieldCondition(key="is_claim", match=models.MatchValue(value=is_claim)))
    if claim_type:
        must_filters.append(models.FieldCondition(key="claim_type", match=models.MatchValue(value=claim_type)))
    if is_table is not None:
        must_filters.append(models.FieldCondition(key="is_table", match=models.MatchValue(value=is_table)))
    if table_variant:
        must_filters.append(models.FieldCondition(key="table_variant", match=models.MatchValue(value=table_variant)))
        
    query_filter = models.Filter(must=must_filters) if must_filters else None
    
    if query_vector is not None:
        results = client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=top_k
        )
    else:
        # Just scroll if no vector provided to get content by metadata
        hits, _ = client.scroll(
            collection_name=collection_name,
            scroll_filter=query_filter,
            limit=top_k,
            with_payload=True,
            with_vectors=False
        )
        # Wrap hits to match search results format roughly (hit.payload)
        return hits
    
    return results
