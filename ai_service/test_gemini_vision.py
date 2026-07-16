import base64
import io
import json
import socket
import sys
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from gemini_vision_provider import GeminiVisionProvider, validate_observations
from pipeline import run_hybrid_pipeline
from vision_provider import VisionProviderChain


def observation_payload(**overrides):
    payload = {
        "sceneDescription": "An exposed electrical wire emits visible sparks above standing water on a road.",
        "visibleCivicIssues": [
            {"issue": "Exposed wire with visible sparks", "visibleEvidence": ["exposed wire", "visible sparks"], "confidence": 0.91},
            {"issue": "Standing water on the road", "visibleEvidence": ["standing water", "road partially flooded"], "confidence": 0.84},
        ],
        "damagedInfrastructure": ["electrical cable"],
        "hazards": ["possible electric shock near standing water"],
        "environmentalConditions": ["wet road"],
        "multipleProblems": True,
        "imageQuality": {"status": "usable", "limitations": []},
        "uncertainty": {"present": False, "reason": ""},
        "humanReviewRecommended": False,
    }
    payload.update(overrides)
    return payload


def gemini_envelope(payload):
    return {"candidates": [{"content": {"parts": [{"text": json.dumps(payload)}]}, "finishReason": "STOP"}]}


def sample_image_payload(size=(640, 480)):
    image = Image.new("RGB", size, (105, 120, 130))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=88)
    image.close()
    return base64.b64encode(buffer.getvalue()).decode("ascii")


class FakeResponse:
    def __init__(self, payload):
        self.payload = json.dumps(payload).encode("utf-8") if not isinstance(payload, bytes) else payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _limit=-1):
        return self.payload


class GeminiProviderTests(unittest.TestCase):
    def provider(self, opener):
        return GeminiVisionProvider(opener=opener, sleep=lambda _seconds: None)

    def configured(self):
        return patch.multiple(
            "gemini_vision_provider",
            GEMINI_VISION_ENABLED=True,
            GEMINI_API_KEY="test-key-not-for-production",
            GEMINI_MAX_RETRIES=1,
            GEMINI_RATE_LIMIT_PER_MINUTE=30,
        )

    def test_successful_structured_analysis_is_cached_by_image_hash(self):
        calls = []

        def opener(request, timeout):
            calls.append((request, timeout))
            return FakeResponse(gemini_envelope(observation_payload()))

        provider = self.provider(opener)
        image = Image.new("RGB", (1800, 1200), (110, 120, 130))
        with self.configured():
            first = provider.analyze(image, "same-image-hash")
            second = provider.analyze(image, "same-image-hash")
        image.close()

        self.assertEqual(first["status"], "available")
        self.assertEqual(first["structuredObservations"]["visibleCivicIssues"][0]["issue"], "Exposed wire with visible sparks")
        self.assertTrue(second["cacheHit"])
        self.assertEqual(len(calls), 1)
        request_body = json.loads(calls[0][0].data.decode("utf-8"))
        self.assertNotIn("test-key-not-for-production", calls[0][0].data.decode("utf-8"))
        self.assertLess(len(base64.b64decode(request_body["contents"][0]["parts"][1]["inlineData"]["data"])), 1_500_000)

    def test_timeout_returns_safe_status_after_limited_retry(self):
        calls = []

        def opener(_request, timeout):
            self.assertGreater(timeout, 0)
            calls.append(True)
            raise socket.timeout("timed out")

        provider = self.provider(opener)
        image = Image.new("RGB", (320, 240))
        with self.configured():
            result = provider.analyze(image, "timeout-hash")
        image.close()
        self.assertEqual(result["status"], "timeout")
        self.assertEqual(len(calls), 2)

    def test_quota_failure_does_not_retry_repeatedly(self):
        calls = []

        def opener(request, timeout):
            self.assertGreater(timeout, 0)
            calls.append(True)
            raise urllib.error.HTTPError(request.full_url, 429, "quota", {}, io.BytesIO(b"{}"))

        provider = self.provider(opener)
        image = Image.new("RGB", (320, 240))
        with self.configured():
            result = provider.analyze(image, "quota-hash")
        image.close()
        self.assertEqual(result["status"], "quota_exceeded")
        self.assertEqual(len(calls), 1)

    def test_invalid_json_is_rejected(self):
        provider = self.provider(lambda _request, timeout: FakeResponse(b"not-json"))
        image = Image.new("RGB", (320, 240))
        with self.configured():
            result = provider.analyze(image, "invalid-json-hash")
        image.close()
        self.assertEqual(result["status"], "invalid_response")

    def test_api_key_is_not_sent_to_an_untrusted_base_url(self):
        provider = self.provider(lambda _request, timeout: self.fail(f"Unexpected external call with timeout {timeout}"))
        image = Image.new("RGB", (320, 240))
        with self.configured(), patch("gemini_vision_provider.GEMINI_API_BASE_URL", "https://example.invalid/v1beta"):
            result = provider.analyze(image, "untrusted-endpoint-hash")
        image.close()
        self.assertEqual(result["status"], "unavailable")

    def test_unrelated_and_blurry_observations_require_review(self):
        unrelated = validate_observations(observation_payload(
            sceneDescription="A person is holding a cup in a clean indoor room.",
            visibleCivicIssues=[],
            damagedInfrastructure=[],
            hazards=[],
            multipleProblems=False,
        ))
        blurry = validate_observations(observation_payload(
            imageQuality={"status": "blurry", "limitations": ["Fine details are not visible"]}
        ))
        self.assertTrue(unrelated["uncertainty"]["present"])
        self.assertTrue(unrelated["humanReviewRecommended"])
        self.assertTrue(blurry["humanReviewRecommended"])


class ProviderChainAndDecisionTests(unittest.TestCase):
    def pipeline(self, scene, text=""):
        with (
            patch("vision_analysis.vision_provider_chain.analyze", return_value=scene),
            patch("text_processing.get_embedding_model", return_value=None),
        ):
            return run_hybrid_pipeline({
                "textComplaint": text,
                "voiceTranscript": "",
                "imageBase64": sample_image_payload(),
                "imageMimeType": "image/jpeg",
                "imageFeatures": {"averageBrightness": 0.5, "contrast": 0.2, "edgeDensity": 0.2},
                "location": "Bengaluru",
                "previousComplaints": [],
                "recentAreaComplaints": [],
            })

    def available_scene(self, payload=None):
        structured = payload or observation_payload()
        return {
            "status": "available",
            "provider": "gemini-vision",
            "model": "test-gemini",
            "description": structured["sceneDescription"],
            "structuredObservations": structured,
            "providerAttempts": [{"provider": "gemini-vision", "status": "available", "reason": ""}],
            "fallbackUsed": False,
            "cacheHit": False,
        }

    def test_multiple_hazards_are_normalized_before_urban_pulse_decision(self):
        result = self.pipeline(self.available_scene())
        categories = result["vision"]["observations"]["possibleCivicCategories"]
        self.assertIn("utility_fault", categories)
        self.assertIn("water_drainage", categories)
        self.assertEqual(result["vision"]["provider"], "gemini-vision")
        self.assertIn(result["category"], categories)

    def test_text_image_mismatch_forces_review(self):
        payload = observation_payload(
            sceneDescription="A deep pothole is visible in the damaged road.",
            visibleCivicIssues=[{"issue": "Deep pothole", "visibleEvidence": ["deep pothole", "damaged road"], "confidence": 0.92}],
            damagedInfrastructure=["road surface"],
            hazards=["traffic hazard"],
            multipleProblems=False,
        )
        result = self.pipeline(self.available_scene(payload), text="Garbage is overflowing beside the road")
        self.assertEqual(result["vision"]["observations"]["textImageConsistency"]["status"], "contradicts")
        self.assertTrue(result["reviewRequired"])

    def test_provider_uncertainty_routes_to_human_review(self):
        payload = observation_payload(
            sceneDescription="A dark unclear outdoor scene with no reliable civic issue visible.",
            visibleCivicIssues=[],
            damagedInfrastructure=[],
            hazards=[],
            multipleProblems=False,
            imageQuality={"status": "blurry", "limitations": ["Scene detail is blurred"]},
            uncertainty={"present": True, "reason": "The incident cannot be verified from this image."},
            humanReviewRecommended=True,
        )
        result = self.pipeline(self.available_scene(payload))
        self.assertTrue(result["reviewRequired"])
        self.assertTrue(result["abstained"])

    def test_legacy_local_provider_can_be_enabled_explicitly(self):
        chain = VisionProviderChain()
        image = Image.new("RGB", (320, 240))
        with (
            patch("vision_provider.VISION_PROVIDER_ORDER", ["gemini", "local"]),
            patch("vision_provider.VISION_FALLBACK_ENABLED", True),
            patch("vision_provider.gemini_vision_provider.analyze", return_value={
                "status": "quota_exceeded", "provider": "gemini-vision", "reason": "quota", "cacheHit": False
            }),
            patch("vision_provider.FLORENCE_ENABLED", True),
            patch("vision_provider.florence_runtime.analyze", return_value={
                "status": "available", "description": "A fallen tree is blocking the road.", "cacheHit": False
            }),
        ):
            result = chain.analyze(image, "fallback-hash")
        image.close()
        self.assertEqual(result["provider"], "local-florence-2")
        self.assertTrue(result["fallbackUsed"])
        self.assertEqual(len(result["providerAttempts"]), 2)

    def test_all_provider_failure_keeps_complaint_reviewable(self):
        result = self.pipeline({
            "status": "unavailable",
            "provider": "human-review-fallback",
            "reason": "No visual provider available.",
            "providerAttempts": [],
            "fallbackUsed": True,
            "cacheHit": False,
        })
        self.assertTrue(result["reviewRequired"])
        self.assertEqual(result["category"], "general")
        self.assertEqual(result["vision"]["sceneStatus"], "unavailable")


if __name__ == "__main__":
    unittest.main()
