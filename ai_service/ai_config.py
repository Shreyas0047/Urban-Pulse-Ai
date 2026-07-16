import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # pragma: no cover - environment variables still work without dotenv
    pass


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default, minimum=0, maximum=None):
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    value = max(minimum, value)
    return min(maximum, value) if maximum is not None else value


EMBEDDING_MODEL_NAME = os.getenv("EMBEDDING_MODEL_NAME", "sentence-transformers/all-MiniLM-L6-v2")
EMBEDDING_MODEL_ENABLED = env_bool("EMBEDDING_MODEL_ENABLED", True)
VISION_MODEL_NAME = os.getenv("VISION_MODEL_NAME", "sentence-transformers/clip-ViT-B-32")
FLORENCE_MODEL_NAME = os.getenv("FLORENCE_MODEL_NAME", "microsoft/Florence-2-base-ft")
FLORENCE_MODEL_REVISION = os.getenv("FLORENCE_MODEL_REVISION", "58c9f97c2a8448696851e2cc95eb1b6919493fe4")
FLORENCE_ENABLED = env_bool("FLORENCE_ENABLED", True)
FLORENCE_LAZY_LOAD = env_bool("FLORENCE_LAZY_LOAD", True)
FLORENCE_WARMUP = env_bool("FLORENCE_WARMUP", False)
FLORENCE_OBJECT_DETECTION = env_bool("FLORENCE_OBJECT_DETECTION", False)
FLORENCE_INFERENCE_TIMEOUT_SECONDS = float(os.getenv("FLORENCE_INFERENCE_TIMEOUT_SECONDS", "90"))
FLORENCE_QUEUE_TIMEOUT_SECONDS = float(os.getenv("FLORENCE_QUEUE_TIMEOUT_SECONDS", "8"))
FLORENCE_MAX_IMAGE_DIMENSION = env_int("FLORENCE_MAX_IMAGE_DIMENSION", 768, 384, 1536)
FLORENCE_MAX_NEW_TOKENS = env_int("FLORENCE_MAX_NEW_TOKENS", 128, 32, 512)
FLORENCE_NUM_BEAMS = env_int("FLORENCE_NUM_BEAMS", 1, 1, 4)
FLORENCE_CACHE_SIZE = env_int("FLORENCE_CACHE_SIZE", 8, 0, 128)
FLORENCE_RETRY_COOLDOWN_SECONDS = int(os.getenv("FLORENCE_RETRY_COOLDOWN_SECONDS", "300"))
VISION_CLIP_FALLBACK_ENABLED = env_bool("VISION_CLIP_FALLBACK_ENABLED", False)
VISION_CLIP_SECONDARY_ENABLED = env_bool("VISION_CLIP_SECONDARY_ENABLED", False)
VISION_IMAGE_WEIGHT = float(os.getenv("VISION_IMAGE_WEIGHT", "0.38"))
VISION_CONFIDENCE_THRESHOLD = float(os.getenv("VISION_CONFIDENCE_THRESHOLD", "0.24"))
VISION_MAX_IMAGE_BYTES = int(os.getenv("VISION_MAX_IMAGE_BYTES", str(2 * 1024 * 1024)))
VISION_MAX_IMAGE_PIXELS = env_int("VISION_MAX_IMAGE_PIXELS", 12_000_000, 1_000_000, 40_000_000)
VISION_DECODE_MAX_DIMENSION = env_int("VISION_DECODE_MAX_DIMENSION", 2048, 768, 4096)
TEXT_CONFIDENCE_THRESHOLD = float(os.getenv("TEXT_CONFIDENCE_THRESHOLD", "0.26"))
CONTEXT_REPEAT_HIGH = int(os.getenv("CONTEXT_REPEAT_HIGH", "5"))
CONTEXT_REPEAT_MEDIUM = int(os.getenv("CONTEXT_REPEAT_MEDIUM", "3"))
MAX_EXPLANATION_KEYWORDS = int(os.getenv("MAX_EXPLANATION_KEYWORDS", "4"))

VISION_PROVIDER_ORDER = [
    provider.strip().lower()
    for provider in os.getenv("VISION_PROVIDER_ORDER", "florence,gemini").split(",")
    if provider.strip().lower() in {"florence", "gemini", "local"}
]
if not VISION_PROVIDER_ORDER:
    VISION_PROVIDER_ORDER = ["florence", "gemini"]
VISION_FALLBACK_ENABLED = env_bool("VISION_FALLBACK_ENABLED", True)
FLORENCE_REMOTE_ENABLED = env_bool("FLORENCE_REMOTE_ENABLED", True)
FLORENCE_SERVICE_URL = os.getenv("FLORENCE_SERVICE_URL", "").strip().rstrip("/")
FLORENCE_SERVICE_TOKEN = os.getenv("FLORENCE_SERVICE_TOKEN", "").strip()
FLORENCE_ALLOW_HTTP = env_bool("FLORENCE_ALLOW_HTTP", False)
FLORENCE_TIMEOUT_SECONDS = env_int("FLORENCE_TIMEOUT_SECONDS", 35, 5, 120)
FLORENCE_MAX_RETRIES = env_int("FLORENCE_MAX_RETRIES", 1, 0, 2)
FLORENCE_CACHE_SIZE = env_int("FLORENCE_REMOTE_CACHE_SIZE", 128, 0, 1000)
FLORENCE_MAX_TRANSMIT_BYTES = env_int("FLORENCE_MAX_TRANSMIT_BYTES", 1_500_000, 200_000, 3_000_000)
FLORENCE_REMOTE_MAX_IMAGE_DIMENSION = env_int("FLORENCE_REMOTE_MAX_IMAGE_DIMENSION", 1280, 640, 2048)
FLORENCE_JPEG_QUALITY = env_int("FLORENCE_JPEG_QUALITY", 82, 45, 90)
FLORENCE_CIRCUIT_FAILURE_THRESHOLD = env_int("FLORENCE_CIRCUIT_FAILURE_THRESHOLD", 3, 1, 20)
FLORENCE_CIRCUIT_COOLDOWN_SECONDS = env_int("FLORENCE_CIRCUIT_COOLDOWN_SECONDS", 60, 5, 900)
GEMINI_VISION_ENABLED = env_bool("GEMINI_VISION_ENABLED", True)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash-lite").strip()
GEMINI_API_BASE_URL = os.getenv(
    "GEMINI_API_BASE_URL", "https://generativelanguage.googleapis.com/v1beta"
).strip().rstrip("/")
GEMINI_TIMEOUT_SECONDS = env_int("GEMINI_TIMEOUT_SECONDS", 25, 5, 90)
GEMINI_MAX_RETRIES = env_int("GEMINI_MAX_RETRIES", 1, 0, 3)
GEMINI_RATE_LIMIT_PER_MINUTE = env_int("GEMINI_RATE_LIMIT_PER_MINUTE", 10, 1, 120)
GEMINI_CACHE_SIZE = env_int("GEMINI_CACHE_SIZE", 128, 0, 1000)
GEMINI_MAX_IMAGE_DIMENSION = env_int("GEMINI_MAX_IMAGE_DIMENSION", 1280, 640, 2048)
GEMINI_JPEG_QUALITY = env_int("GEMINI_JPEG_QUALITY", 82, 45, 90)
GEMINI_MAX_TRANSMIT_BYTES = env_int("GEMINI_MAX_TRANSMIT_BYTES", 1_500_000, 200_000, 3_000_000)

# Set this to the Render plan's RAM. Zero means unknown and disables budget gating.
AI_MEMORY_BUDGET_MB = env_int("AI_MEMORY_BUDGET_MB", 0, 0)
AI_MEMORY_RESERVE_MB = env_int("AI_MEMORY_RESERVE_MB", 256, 64)
AI_MEMORY_CLEANUP_ENABLED = env_bool("AI_MEMORY_CLEANUP_ENABLED", True)
FLORENCE_MIN_MEMORY_MB = env_int("FLORENCE_MIN_MEMORY_MB", 1400, 512)
