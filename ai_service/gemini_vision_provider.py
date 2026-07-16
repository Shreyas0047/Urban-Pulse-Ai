import base64
import json
import logging
import random
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import OrderedDict, deque

from ai_config import (
    GEMINI_API_BASE_URL,
    GEMINI_API_KEY,
    GEMINI_CACHE_SIZE,
    GEMINI_JPEG_QUALITY,
    GEMINI_MAX_IMAGE_DIMENSION,
    GEMINI_MAX_RETRIES,
    GEMINI_MAX_TRANSMIT_BYTES,
    GEMINI_MODEL_NAME,
    GEMINI_RATE_LIMIT_PER_MINUTE,
    GEMINI_TIMEOUT_SECONDS,
    GEMINI_VISION_ENABLED,
)
from memory_runtime import trim_process_memory
from vision_image_transport import prepare_jpeg
from vision_provider_contract import clean_text as _clean_text
from vision_provider_contract import provider_result, validate_observations

LOGGER = logging.getLogger("urban_pulse.vision")
TRANSIENT_HTTP_CODES = {408, 500, 502, 503, 504}
MAX_RESPONSE_BYTES = 512_000

SYSTEM_PROMPT = """You are a visual evidence observer for an Indian civic complaint system.
Inspect only what is visibly supported by the uploaded photograph. Do not choose a municipal
department, ward, complaint category, severity, priority, threat score, routing destination,
acceptance decision, or enforcement action. Report multiple simultaneous visible problems.
Distinguish observation from inference. If an issue is unclear, say so and recommend human review.
Do not identify people, read personal data, infer protected traits, or reproduce sensitive text.
Use concise factual phrases such as exposed wire, visible sparks, fallen tree blocking road,
open manhole, standing water, damaged road surface, smoke, or overflowing waste only when visible."""

RESPONSE_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "sceneDescription": {"type": "string"},
        "visibleCivicIssues": {
            "type": "array",
            "maxItems": 8,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "issue": {"type": "string"},
                    "visibleEvidence": {"type": "array", "maxItems": 5, "items": {"type": "string"}},
                    "confidence": {"type": "number", "minimum": 0, "maximum": 1},
                },
                "required": ["issue", "visibleEvidence", "confidence"],
            },
        },
        "damagedInfrastructure": {"type": "array", "maxItems": 8, "items": {"type": "string"}},
        "hazards": {"type": "array", "maxItems": 8, "items": {"type": "string"}},
        "environmentalConditions": {"type": "array", "maxItems": 6, "items": {"type": "string"}},
        "multipleProblems": {"type": "boolean"},
        "imageQuality": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "status": {"type": "string", "enum": ["usable", "limited", "blurry", "dark", "overexposed", "invalid"]},
                "limitations": {"type": "array", "maxItems": 5, "items": {"type": "string"}},
            },
            "required": ["status", "limitations"],
        },
        "uncertainty": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "present": {"type": "boolean"},
                "reason": {"type": "string"},
            },
            "required": ["present", "reason"],
        },
        "humanReviewRecommended": {"type": "boolean"},
    },
    "required": [
        "sceneDescription", "visibleCivicIssues", "damagedInfrastructure", "hazards",
        "environmentalConditions", "multipleProblems", "imageQuality", "uncertainty",
        "humanReviewRecommended"
    ],
}


class GeminiVisionProvider:
    name = "gemini-vision"

    def __init__(self, opener=None, sleep=None):
        self._opener = opener or urllib.request.urlopen
        self._sleep = sleep or time.sleep
        self._cache = OrderedDict()
        self._cache_lock = threading.Lock()
        self._rate_events = deque()
        self._rate_lock = threading.Lock()
        self._status_lock = threading.Lock()
        self._last_status = "not_called"
        self._last_error = ""
        self._last_called_at = None

    @property
    def configured(self):
        endpoint = urllib.parse.urlparse(GEMINI_API_BASE_URL)
        official_endpoint = endpoint.scheme == "https" and endpoint.hostname == "generativelanguage.googleapis.com"
        return bool(GEMINI_VISION_ENABLED and GEMINI_API_KEY and GEMINI_MODEL_NAME and official_endpoint)

    def _log(self, event, **details):
        LOGGER.info(json.dumps({"event": event, "provider": self.name, **details}, sort_keys=True, default=str))

    def _set_status(self, status, error=""):
        with self._status_lock:
            self._last_status = status
            self._last_error = _clean_text(error, 180)
            self._last_called_at = time.time()

    def _cache_get(self, image_hash):
        if not image_hash or GEMINI_CACHE_SIZE <= 0:
            return None
        with self._cache_lock:
            item = self._cache.pop(image_hash, None)
            if item is not None:
                self._cache[image_hash] = item
            return item

    def _cache_put(self, image_hash, value):
        if not image_hash or GEMINI_CACHE_SIZE <= 0:
            return
        with self._cache_lock:
            self._cache.pop(image_hash, None)
            self._cache[image_hash] = value
            while len(self._cache) > GEMINI_CACHE_SIZE:
                self._cache.popitem(last=False)

    def _rate_allowed(self):
        now = time.monotonic()
        with self._rate_lock:
            while self._rate_events and now - self._rate_events[0] >= 60:
                self._rate_events.popleft()
            if len(self._rate_events) >= GEMINI_RATE_LIMIT_PER_MINUTE:
                return False
            self._rate_events.append(now)
            return True

    def _prepare_image(self, image):
        return prepare_jpeg(
            image,
            GEMINI_MAX_IMAGE_DIMENSION,
            GEMINI_JPEG_QUALITY,
            GEMINI_MAX_TRANSMIT_BYTES,
        )

    def _request_body(self, image_bytes):
        return json.dumps(
            {
                "contents": [{"role": "user", "parts": [
                    {"text": SYSTEM_PROMPT},
                    {"inlineData": {"mimeType": "image/jpeg", "data": base64.b64encode(image_bytes).decode("ascii")}},
                ]}],
                "generationConfig": {
                    "temperature": 0.1,
                    "candidateCount": 1,
                    "maxOutputTokens": 1400,
                    "responseMimeType": "application/json",
                    "responseJsonSchema": RESPONSE_SCHEMA,
                },
            },
            separators=(",", ":"),
        ).encode("utf-8")

    def _extract(self, payload):
        candidates = payload.get("candidates") if isinstance(payload, dict) else None
        if not isinstance(candidates, list) or not candidates:
            raise ValueError("Gemini returned no candidate response")
        parts = ((candidates[0].get("content") or {}).get("parts") or []) if isinstance(candidates[0], dict) else []
        text_parts = [part.get("text", "") for part in parts if isinstance(part, dict) and part.get("text")]
        if not text_parts:
            raise ValueError("Gemini returned no structured response")
        return validate_observations(json.loads("".join(text_parts)))

    def analyze(self, image, image_hash):
        if not GEMINI_VISION_ENABLED:
            return {"status": "disabled", "reason": "External visual analysis is disabled.", "provider": self.name, "cacheHit": False}
        if not self.configured:
            return {"status": "unavailable", "reason": "External visual analysis is not configured.", "provider": self.name, "cacheHit": False}

        cached = self._cache_get(image_hash)
        if cached is not None:
            self._log("gemini_vision_cache_hit", hashPrefix=image_hash[:10])
            return {**cached, "cacheHit": True}

        try:
            image_bytes = self._prepare_image(image)
            request_body = self._request_body(image_bytes)
        except (OSError, ValueError) as error:
            self._set_status("invalid_image", str(error))
            return {"status": "invalid_image", "reason": "The image could not be prepared for visual analysis.", "provider": self.name, "cacheHit": False}

        endpoint = f"{GEMINI_API_BASE_URL}/models/{urllib.parse.quote(GEMINI_MODEL_NAME, safe='-._')}:generateContent"
        max_attempts = GEMINI_MAX_RETRIES + 1
        try:
            for attempt in range(max_attempts):
                if not self._rate_allowed():
                    self._set_status("rate_limited", "Local provider rate limit reached")
                    self._log("gemini_vision_rate_limited", attempt=attempt + 1)
                    return {"status": "rate_limited", "reason": "Visual analysis is temporarily busy.", "provider": self.name, "cacheHit": False}

                started = time.monotonic()
                request = urllib.request.Request(
                    endpoint,
                    data=request_body,
                    method="POST",
                    headers={"Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
                )
                try:
                    with self._opener(request, timeout=GEMINI_TIMEOUT_SECONDS) as response:
                        raw = response.read(MAX_RESPONSE_BYTES + 1)
                    if len(raw) > MAX_RESPONSE_BYTES:
                        raise ValueError("Gemini response exceeded the safe response limit")
                    observations = self._extract(json.loads(raw.decode("utf-8")))
                    duration_ms = int((time.monotonic() - started) * 1000)
                    result = provider_result(
                        self.name,
                        GEMINI_MODEL_NAME,
                        observations,
                        inferenceMs=duration_ms,
                        cacheHit=False,
                    )
                    self._cache_put(image_hash, result)
                    self._set_status("available")
                    self._log("gemini_vision_succeeded", durationMs=duration_ms, attempt=attempt + 1, hashPrefix=image_hash[:10])
                    return result
                except urllib.error.HTTPError as error:
                    code = int(error.code or 0)
                    status = "quota_exceeded" if code == 429 else "provider_error"
                    self._set_status(status, f"HTTP {code}")
                    self._log("gemini_vision_http_error", statusCode=code, attempt=attempt + 1, durationMs=int((time.monotonic() - started) * 1000))
                    if code == 429:
                        return {"status": "quota_exceeded", "reason": "External visual-analysis quota is unavailable.", "provider": self.name, "cacheHit": False}
                    if code not in TRANSIENT_HTTP_CODES or attempt + 1 >= max_attempts:
                        return {"status": "unavailable", "reason": "External visual analysis is temporarily unavailable.", "provider": self.name, "cacheHit": False}
                except (TimeoutError, socket.timeout, urllib.error.URLError) as error:
                    self._set_status("timeout", type(error).__name__)
                    self._log("gemini_vision_timeout", attempt=attempt + 1, durationMs=int((time.monotonic() - started) * 1000))
                    if attempt + 1 >= max_attempts:
                        return {"status": "timeout", "reason": "External visual analysis timed out.", "provider": self.name, "cacheHit": False}
                except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
                    self._set_status("invalid_response", type(error).__name__)
                    self._log("gemini_vision_invalid_response", attempt=attempt + 1, durationMs=int((time.monotonic() - started) * 1000))
                    return {"status": "invalid_response", "reason": "External visual analysis returned an invalid response.", "provider": self.name, "cacheHit": False}

                self._sleep(min(2.0, 0.5 * (2 ** attempt)) + random.uniform(0, 0.2))
        finally:
            del request_body
            del image_bytes
            trim_process_memory()

    def status_payload(self):
        with self._cache_lock:
            cache_entries = len(self._cache)
        with self._rate_lock:
            recent_calls = len(self._rate_events)
        with self._status_lock:
            last_status = self._last_status
            last_error = self._last_error
            last_called_at = self._last_called_at
        return {
            "enabled": GEMINI_VISION_ENABLED,
            "configured": self.configured,
            "provider": self.name,
            "model": GEMINI_MODEL_NAME,
            "cacheEntries": cache_entries,
            "rateLimitPerMinute": GEMINI_RATE_LIMIT_PER_MINUTE,
            "recentCalls": recent_calls,
            "lastStatus": last_status,
            "lastError": last_error,
            "lastCalledAt": last_called_at,
        }


gemini_vision_provider = GeminiVisionProvider()
