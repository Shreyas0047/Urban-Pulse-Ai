from functools import lru_cache

import numpy as np

from ai_config import (
    EMBEDDING_MODEL_ENABLED,
    EMBEDDING_MODEL_NAME,
    VISION_CLIP_FALLBACK_ENABLED,
    VISION_CLIP_SECONDARY_ENABLED,
    VISION_MODEL_NAME,
)
from florence_runtime import florence_runtime
from memory_runtime import memory_pressure
from vision_provider import vision_provider_chain

try:
    if not (EMBEDDING_MODEL_ENABLED or VISION_CLIP_FALLBACK_ENABLED or VISION_CLIP_SECONDARY_ENABLED):
        raise ImportError
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover - exercised through lightweight production mode
    SentenceTransformer = None


@lru_cache(maxsize=1)
def get_embedding_model():
    if SentenceTransformer is None or not EMBEDDING_MODEL_ENABLED:
        return None
    try:
        return SentenceTransformer(EMBEDDING_MODEL_NAME)
    except Exception:
        return None


@lru_cache(maxsize=1)
def get_vision_model():
    if SentenceTransformer is None:
        return None
    try:
        return SentenceTransformer(VISION_MODEL_NAME)
    except Exception:
        return None


def runtime_status():
    return {
        "sentenceTransformersInstalled": SentenceTransformer is not None,
        "embeddingModelEnabled": EMBEDDING_MODEL_ENABLED,
        "embeddingModel": EMBEDDING_MODEL_NAME,
        "visionModel": VISION_MODEL_NAME,
        "embeddingModelCached": get_embedding_model.cache_info().currsize > 0,
        "visionModelCached": get_vision_model.cache_info().currsize > 0,
        "sceneUnderstanding": florence_runtime.status_payload(),
        "visionProviders": vision_provider_chain.status_payload(),
        "memory": memory_pressure(),
    }


def cosine_similarity(left, right):
    left_norm = np.linalg.norm(left)
    right_norm = np.linalg.norm(right)
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return float(np.dot(left, right) / (left_norm * right_norm))
