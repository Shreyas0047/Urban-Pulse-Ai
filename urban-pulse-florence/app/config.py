import os


def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_int(name, default, minimum=0, maximum=None):
    try:
        value = int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        value = default
    value = max(minimum, value)
    return min(maximum, value) if maximum is not None else value


MODEL_NAME = os.getenv("FLORENCE_MODEL_NAME", "/models/florence").strip()
MODEL_REVISION = os.getenv("FLORENCE_MODEL_REVISION", "58c9f97c2a8448696851e2cc95eb1b6919493fe4").strip()
MODEL_DISPLAY_NAME = os.getenv("FLORENCE_MODEL_DISPLAY_NAME", "microsoft/Florence-2-base-ft").strip()
MAX_IMAGE_BYTES = env_int("MAX_IMAGE_BYTES", 2_000_000, 100_000, 8_000_000)
MAX_IMAGE_PIXELS = env_int("MAX_IMAGE_PIXELS", 12_000_000, 1_000_000, 40_000_000)
MAX_IMAGE_DIMENSION = env_int("MAX_IMAGE_DIMENSION", 1024, 384, 1536)
MAX_NEW_TOKENS = env_int("MAX_NEW_TOKENS", 192, 64, 512)
NUM_BEAMS = env_int("NUM_BEAMS", 1, 1, 4)
SERVICE_TOKEN = os.getenv("FLORENCE_SERVICE_TOKEN", "").strip()
REQUIRE_SERVICE_TOKEN = env_bool("REQUIRE_SERVICE_TOKEN", True)
WARMUP = env_bool("FLORENCE_WARMUP", True)
