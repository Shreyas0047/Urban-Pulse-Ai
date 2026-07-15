import base64
import io
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))

from florence_runtime import FlorenceRuntime
from pipeline import run_hybrid_pipeline
from scene_observations import build_scene_observations
from vision_analysis import decode_image_payload
from ai_config import VISION_MAX_IMAGE_BYTES


def sample_image(size=(320, 240), color=(110, 120, 125)):
    image = Image.new("RGB", size, color)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return image, base64.b64encode(buffer.getvalue()).decode("ascii")


class SceneObservationTests(unittest.TestCase):
    def observe(self, caption, text="", features=None, status="available"):
        image, _payload = sample_image()
        return build_scene_observations(
            {"status": status, "description": caption, "cacheHit": False, "inferenceMs": 80},
            image,
            features or {"averageBrightness": 0.5, "contrast": 0.2, "edgeDensity": 0.2},
            text,
        )

    def test_supported_civic_incidents(self):
        examples = {
            "safety_fire": "Visible flames and heavy smoke rise from an active fire.",
            "road_damage": "A deep pothole is visible in the damaged road.",
            "garbage": "A large garbage pile and scattered litter cover the footpath.",
            "water_drainage": "A flooded road has deep standing water beside a blocked drain.",
            "utility_fault": "An exposed wire hangs from a utility pole and emits sparks.",
            "tree_obstruction": "A fallen tree is blocking the road.",
            "wall_damage": "A building has a large cracked wall and structural crack.",
            "sewage_overflow": "An open manhole has visible sewage overflow and sewage sludge.",
            "water_leakage": "A burst pipe is spraying water across the footpath.",
            "security": "A public gate has a broken lock and forced entry damage.",
            "animal_intrusion": "Stray cattle are blocking the road.",
            "vehicle_obstruction": "A truck is blocking the road and emergency access.",
        }
        for expected, caption in examples.items():
            with self.subTest(expected=expected):
                observed = self.observe(caption)
                self.assertIn(expected, observed["possibleCivicCategories"])

    def test_multiple_hazards_are_preserved(self):
        observed = self.observe("An exposed wire hangs above standing water on a flooded road.")
        self.assertTrue(observed["multipleIssues"])
        self.assertIn("utility_fault", observed["possibleCivicCategories"])
        self.assertIn("water_drainage", observed["possibleCivicCategories"])

    def test_compositional_caption_variants(self):
        road = self.observe("There is a large hole in the asphalt roadway.")
        electrical = self.observe("A damaged cable is hanging above the street.")
        drain = self.observe("The gutter is visibly clogged with debris.")
        self.assertIn("road_damage", road["possibleCivicCategories"])
        self.assertIn("utility_fault", electrical["possibleCivicCategories"])
        self.assertIn("water_drainage", drain["possibleCivicCategories"])

    def test_text_image_match_and_mismatch(self):
        matching = self.observe("A fallen tree is blocking the road.", "A fallen tree blocks this road")
        mismatch = self.observe("A deep pothole is visible in the damaged road.", "Garbage is overflowing here")
        self.assertEqual(matching["textImageConsistency"]["status"], "supports")
        self.assertEqual(mismatch["textImageConsistency"]["status"], "contradicts")
        self.assertTrue(mismatch["humanReviewRecommended"])

    def test_unrelated_and_blurry_images_abstain(self):
        unrelated = self.observe("A person is holding a cup in a clean indoor room.", "There is a pothole")
        blurry = self.observe(
            "A dark outdoor area with no clearly visible objects.",
            "There is an exposed wire",
            {"averageBrightness": 0.04, "contrast": 0.01, "edgeDensity": 0.005},
        )
        self.assertEqual(unrelated["possibleCivicCategories"], [])
        self.assertEqual(unrelated["textImageConsistency"]["status"], "unrelated")
        self.assertEqual(blurry["imageQuality"]["status"], "limited")
        self.assertTrue(blurry["humanReviewRecommended"])

    def test_timeout_recommends_review(self):
        observed = self.observe("A pothole is visible in the road.", status="timeout")
        self.assertTrue(observed["humanReviewRecommended"])
        self.assertTrue(observed["uncertainty"]["present"])


class VisionValidationTests(unittest.TestCase):
    def test_malformed_and_mime_mismatch_are_rejected(self):
        image, payload = sample_image()
        decoded, _hash, malformed_reason = decode_image_payload("not-base64", "image/jpeg")
        mismatch, _hash, mismatch_reason = decode_image_payload(payload, "image/png")
        self.assertIsNone(decoded)
        self.assertIn("base64", malformed_reason)
        self.assertIsNone(mismatch)
        self.assertIn("does not match", mismatch_reason)
        self.assertEqual(image.size, (320, 240))

    def test_oversized_payload_is_rejected_before_image_decode(self):
        payload = base64.b64encode(b"x" * (VISION_MAX_IMAGE_BYTES + 1)).decode("ascii")
        image, _hash, reason = decode_image_payload(payload, "image/jpeg")
        self.assertIsNone(image)
        self.assertIn("upload limit", reason)


class FlorenceCacheTests(unittest.TestCase):
    def test_identical_image_uses_bounded_cache(self):
        runtime = FlorenceRuntime()
        runtime.state = "ready"
        runtime.model = object()
        runtime.processor = object()
        image, _payload = sample_image()
        with patch.object(runtime, "_run_task", return_value="A fallen tree is blocking the road.") as task:
            first = runtime.analyze(image, "abc123")
            second = runtime.analyze(image, "abc123")
        self.assertFalse(first["cacheHit"])
        self.assertTrue(second["cacheHit"])
        self.assertEqual(task.call_count, 1)


class PipelineIntegrationTests(unittest.TestCase):
    def test_upload_to_observations_threat_and_decision(self):
        _image, payload = sample_image()
        scene = {
            "status": "available",
            "description": "An exposed wire emits sparks above standing water on a flooded road.",
            "cacheHit": False,
            "inferenceMs": 120,
        }
        with patch("vision_analysis.florence_runtime.analyze", return_value=scene):
            result = run_hybrid_pipeline(
                {
                    "textComplaint": "",
                    "voiceTranscript": "",
                    "imageBase64": payload,
                    "imageMimeType": "image/jpeg",
                    "imageFeatures": {"averageBrightness": 0.5, "contrast": 0.2, "edgeDensity": 0.2},
                    "location": "Bengaluru",
                    "previousComplaints": [],
                    "recentAreaComplaints": [],
                }
            )
        observations = result["vision"]["observations"]
        self.assertEqual(result["vision"]["provider"], "local-florence-2")
        self.assertIn("utility_fault", observations["possibleCivicCategories"])
        self.assertIn("water_drainage", observations["possibleCivicCategories"])
        self.assertEqual(result["aiMeta"]["sceneUnderstandingStatus"], "available")
        self.assertIn(result["threatAssessment"]["safetyGate"]["action"], {"auto_route", "needs_review", "request_more_evidence"})

    def test_model_unavailable_degrades_without_crashing(self):
        _image, payload = sample_image()
        with patch(
            "vision_analysis.florence_runtime.analyze",
            return_value={"status": "unavailable", "reason": "mock unavailable", "cacheHit": False},
        ):
            result = run_hybrid_pipeline(
                {
                    "textComplaint": "",
                    "voiceTranscript": "",
                    "imageBase64": payload,
                    "imageMimeType": "image/jpeg",
                    "imageFeatures": {},
                    "location": "Bengaluru",
                    "previousComplaints": [],
                    "recentAreaComplaints": [],
                }
            )
        self.assertTrue(result["reviewRequired"])
        self.assertEqual(result["vision"]["sceneStatus"], "unavailable")


if __name__ == "__main__":
    unittest.main()
