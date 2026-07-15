import json
import logging
import threading
import time
from collections import OrderedDict

from ai_config import (
    FLORENCE_CACHE_SIZE,
    FLORENCE_ENABLED,
    FLORENCE_INFERENCE_TIMEOUT_SECONDS,
    FLORENCE_LAZY_LOAD,
    FLORENCE_MAX_IMAGE_DIMENSION,
    FLORENCE_MAX_NEW_TOKENS,
    FLORENCE_MODEL_NAME,
    FLORENCE_MODEL_REVISION,
    FLORENCE_NUM_BEAMS,
    FLORENCE_OBJECT_DETECTION,
    FLORENCE_QUEUE_TIMEOUT_SECONDS,
    FLORENCE_RETRY_COOLDOWN_SECONDS,
)

LOGGER = logging.getLogger("urban_pulse.vision")

try:
    import torch
    from transformers import AutoModelForCausalLM, AutoProcessor
except ImportError:  # pragma: no cover - exercised through degraded-mode tests
    torch = None
    AutoModelForCausalLM = None
    AutoProcessor = None


def _log(event, **details):
    LOGGER.info(json.dumps({"event": event, **details}, sort_keys=True, default=str))


class FlorenceRuntime:
    """Process-wide Florence model, bounded result cache, and serialized CPU inference."""

    def __init__(self):
        self.model = None
        self.processor = None
        self.state = "disabled" if not FLORENCE_ENABLED else "not_loaded"
        self.error = "" if FLORENCE_ENABLED else "Florence scene understanding is disabled."
        self.loaded_at = None
        self.load_duration_ms = 0
        self.failed_at = 0
        self._state_lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._loader_thread = None
        self._cache = OrderedDict()
        self._cache_lock = threading.Lock()

    def request_load(self, background=True):
        if not FLORENCE_ENABLED:
            return False
        with self._state_lock:
            if self.state == "ready":
                return True
            if self.state == "loading":
                return False
            if self.state == "unavailable" and time.time() - self.failed_at < FLORENCE_RETRY_COOLDOWN_SECONDS:
                return False
            self.state = "loading"
            self.error = ""

        if background:
            self._loader_thread = threading.Thread(target=self._load, name="florence-loader", daemon=True)
            self._loader_thread.start()
            return False
        self._load()
        return self.state == "ready"

    def _load(self):
        started = time.monotonic()
        _log("vision_model_load_started", model=FLORENCE_MODEL_NAME)
        try:
            if torch is None or AutoModelForCausalLM is None or AutoProcessor is None:
                raise RuntimeError("torch and transformers with Florence-2 support are required")
            processor = AutoProcessor.from_pretrained(
                FLORENCE_MODEL_NAME,
                revision=FLORENCE_MODEL_REVISION,
                trust_remote_code=True,
            )
            model = AutoModelForCausalLM.from_pretrained(
                FLORENCE_MODEL_NAME,
                revision=FLORENCE_MODEL_REVISION,
                torch_dtype=torch.float32,
                trust_remote_code=True,
                low_cpu_mem_usage=True,
                use_safetensors=True,
            ).to("cpu")
            model.eval()
            with self._state_lock:
                self.processor = processor
                self.model = model
                self.state = "ready"
                self.loaded_at = time.time()
                self.load_duration_ms = int((time.monotonic() - started) * 1000)
                self.failed_at = 0
            _log("vision_model_load_succeeded", model=FLORENCE_MODEL_NAME, durationMs=self.load_duration_ms)
        except Exception as error:  # pragma: no cover - environment/model-download dependent
            with self._state_lock:
                self.model = None
                self.processor = None
                self.state = "unavailable"
                self.error = str(error)[:300]
                self.load_duration_ms = int((time.monotonic() - started) * 1000)
                self.failed_at = time.time()
            _log("vision_model_load_failed", model=FLORENCE_MODEL_NAME, durationMs=self.load_duration_ms, errorType=type(error).__name__)

    def _cache_get(self, image_hash):
        if not image_hash or FLORENCE_CACHE_SIZE <= 0:
            return None
        with self._cache_lock:
            item = self._cache.pop(image_hash, None)
            if item is not None:
                self._cache[image_hash] = item
            return item

    def _cache_put(self, image_hash, value):
        if not image_hash or FLORENCE_CACHE_SIZE <= 0:
            return
        with self._cache_lock:
            self._cache.pop(image_hash, None)
            self._cache[image_hash] = value
            while len(self._cache) > FLORENCE_CACHE_SIZE:
                self._cache.popitem(last=False)

    def _run_task(self, image, task):
        inputs = self.processor(text=task, images=image, return_tensors="pt")
        inputs = {key: value.to("cpu") for key, value in inputs.items()}
        with torch.inference_mode():
            generated_ids = self.model.generate(
                input_ids=inputs.get("input_ids"),
                pixel_values=inputs.get("pixel_values"),
                max_new_tokens=FLORENCE_MAX_NEW_TOKENS,
                num_beams=FLORENCE_NUM_BEAMS,
                do_sample=False,
            )
        generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
        parsed = self.processor.post_process_generation(generated_text, task=task, image_size=image.size)
        return parsed.get(task, parsed) if isinstance(parsed, dict) else parsed

    def analyze(self, image, image_hash):
        cached = self._cache_get(image_hash)
        if cached is not None:
            _log("vision_cache_hit", hashPrefix=image_hash[:10])
            return {**cached, "cacheHit": True}
        _log("vision_cache_miss", hashPrefix=(image_hash or "")[:10])

        if self.state != "ready":
            if self.state in {"not_loaded", "unavailable"}:
                # Unavailable may recover after a transient model-download failure on a later request.
                self.request_load(background=FLORENCE_LAZY_LOAD)
            if not FLORENCE_LAZY_LOAD and self.state != "ready":
                self.request_load(background=False)
            if self.state != "ready":
                return {
                    "status": "warming_up" if self.state == "loading" else "unavailable",
                    "reason": "The scene model is loading. This image was handled by the safe fallback." if self.state == "loading" else "The scene model is unavailable.",
                    "cacheHit": False,
                }

        acquired = self._inference_lock.acquire(timeout=max(0.1, FLORENCE_QUEUE_TIMEOUT_SECONDS))
        if not acquired:
            _log("vision_queue_timeout", timeoutSeconds=FLORENCE_QUEUE_TIMEOUT_SECONDS)
            return {"status": "busy", "reason": "The scene analyzer is busy. Review or retry this image shortly.", "cacheHit": False}

        started = time.monotonic()
        try:
            prepared = image.copy()
            prepared.thumbnail((FLORENCE_MAX_IMAGE_DIMENSION, FLORENCE_MAX_IMAGE_DIMENSION))
            _log("vision_preprocessed", width=prepared.width, height=prepared.height)
            detailed = self._run_task(prepared, "<MORE_DETAILED_CAPTION>")
            objects = self._run_task(prepared, "<OD>") if FLORENCE_OBJECT_DETECTION else None
            duration_ms = int((time.monotonic() - started) * 1000)
            status = "timeout" if duration_ms > FLORENCE_INFERENCE_TIMEOUT_SECONDS * 1000 else "available"
            result = {
                "status": status,
                "description": str(detailed or "").strip(),
                "objects": objects,
                "inferenceMs": duration_ms,
                "cacheHit": False,
                "reason": "Scene analysis exceeded the configured latency budget; human review is recommended." if status == "timeout" else "",
            }
            self._cache_put(image_hash, result)
            _log("vision_inference_completed", durationMs=duration_ms, status=status, objectDetection=FLORENCE_OBJECT_DETECTION)
            return result
        except (MemoryError, RuntimeError) as error:
            event = "vision_memory_error" if isinstance(error, MemoryError) or "memory" in str(error).lower() else "vision_inference_failed"
            _log(event, errorType=type(error).__name__, durationMs=int((time.monotonic() - started) * 1000))
            return {"status": "unavailable", "reason": "Scene analysis could not complete within available service resources.", "cacheHit": False}
        except Exception as error:  # pragma: no cover - model-specific failure
            _log("vision_inference_failed", errorType=type(error).__name__, durationMs=int((time.monotonic() - started) * 1000))
            return {"status": "unavailable", "reason": "Scene analysis failed safely.", "cacheHit": False}
        finally:
            self._inference_lock.release()

    def status_payload(self):
        with self._cache_lock:
            cache_entries = len(self._cache)
        return {
            "enabled": FLORENCE_ENABLED,
            "model": FLORENCE_MODEL_NAME,
            "revision": FLORENCE_MODEL_REVISION,
            "state": self.state,
            "ready": self.state == "ready",
            "lazyLoad": FLORENCE_LAZY_LOAD,
            "loadDurationMs": self.load_duration_ms,
            "cacheEntries": cache_entries,
            "objectDetection": FLORENCE_OBJECT_DETECTION,
            "error": self.error if self.state == "unavailable" else "",
        }


florence_runtime = FlorenceRuntime()
