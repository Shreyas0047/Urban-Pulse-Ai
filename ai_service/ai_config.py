import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # pragma: no cover - environment variables still work without dotenv
    pass


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
VISION_MODEL_NAME = os.getenv("VISION_MODEL_NAME", "sentence-transformers/clip-ViT-B-32")
FLORENCE_MODEL_NAME = os.getenv("FLORENCE_MODEL_NAME", "microsoft/Florence-2-base-ft")
FLORENCE_MODEL_REVISION = os.getenv("FLORENCE_MODEL_REVISION", "58c9f97c2a8448696851e2cc95eb1b6919493fe4")
FLORENCE_ENABLED = env_bool("FLORENCE_ENABLED", True)
FLORENCE_LAZY_LOAD = env_bool("FLORENCE_LAZY_LOAD", True)
FLORENCE_WARMUP = env_bool("FLORENCE_WARMUP", False)
FLORENCE_OBJECT_DETECTION = env_bool("FLORENCE_OBJECT_DETECTION", False)
FLORENCE_INFERENCE_TIMEOUT_SECONDS = float(os.getenv("FLORENCE_INFERENCE_TIMEOUT_SECONDS", "90"))
FLORENCE_QUEUE_TIMEOUT_SECONDS = float(os.getenv("FLORENCE_QUEUE_TIMEOUT_SECONDS", "8"))
FLORENCE_MAX_IMAGE_DIMENSION = int(os.getenv("FLORENCE_MAX_IMAGE_DIMENSION", "1024"))
FLORENCE_MAX_NEW_TOKENS = int(os.getenv("FLORENCE_MAX_NEW_TOKENS", "256"))
FLORENCE_NUM_BEAMS = int(os.getenv("FLORENCE_NUM_BEAMS", "2"))
FLORENCE_CACHE_SIZE = int(os.getenv("FLORENCE_CACHE_SIZE", "24"))
FLORENCE_RETRY_COOLDOWN_SECONDS = int(os.getenv("FLORENCE_RETRY_COOLDOWN_SECONDS", "300"))
VISION_CLIP_FALLBACK_ENABLED = env_bool("VISION_CLIP_FALLBACK_ENABLED", False)
VISION_CLIP_SECONDARY_ENABLED = env_bool("VISION_CLIP_SECONDARY_ENABLED", False)
VISION_IMAGE_WEIGHT = float(os.getenv("VISION_IMAGE_WEIGHT", "0.38"))
VISION_CONFIDENCE_THRESHOLD = float(os.getenv("VISION_CONFIDENCE_THRESHOLD", "0.24"))
VISION_MAX_IMAGE_BYTES = int(os.getenv("VISION_MAX_IMAGE_BYTES", str(2 * 1024 * 1024)))
VISION_MAX_IMAGE_PIXELS = int(os.getenv("VISION_MAX_IMAGE_PIXELS", "20000000"))
TEXT_CONFIDENCE_THRESHOLD = float(os.getenv("TEXT_CONFIDENCE_THRESHOLD", "0.26"))
CONTEXT_REPEAT_HIGH = int(os.getenv("CONTEXT_REPEAT_HIGH", "5"))
CONTEXT_REPEAT_MEDIUM = int(os.getenv("CONTEXT_REPEAT_MEDIUM", "3"))
MAX_EXPLANATION_KEYWORDS = int(os.getenv("MAX_EXPLANATION_KEYWORDS", "4"))
