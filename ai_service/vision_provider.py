import json
import logging

from ai_config import FLORENCE_ENABLED, VISION_FALLBACK_ENABLED, VISION_PROVIDER_ORDER
from florence_remote_provider import florence_remote_provider
from florence_runtime import florence_runtime
from gemini_vision_provider import gemini_vision_provider
from vision_provider_contract import SCHEMA_VERSION

LOGGER = logging.getLogger("urban_pulse.vision")


class VisionProviderChain:
    """Visual perception only. Urban Pulse owns every civic decision downstream."""

    def _call(self, provider, image, image_hash):
        if provider == "florence":
            return florence_remote_provider.analyze(image, image_hash)
        if provider == "gemini":
            return gemini_vision_provider.analyze(image, image_hash)
        if provider == "local" and FLORENCE_ENABLED:
            result = florence_runtime.analyze(image, image_hash)
            return {
                **result,
                "provider": "local-florence-2",
                "model": florence_runtime.status_payload()["model"],
            }
        return {
            "status": "disabled",
            "reason": "The requested visual provider is disabled.",
            "provider": provider,
            "cacheHit": False,
        }

    def analyze(self, image, image_hash):
        attempts = []
        uncertain_results = []
        provider_order = VISION_PROVIDER_ORDER if VISION_FALLBACK_ENABLED else VISION_PROVIDER_ORDER[:1]
        for provider in provider_order:
            result = self._call(provider, image, image_hash)
            structured = result.get("structuredObservations") if isinstance(result.get("structuredObservations"), dict) else None
            uncertainty = structured.get("uncertainty") if isinstance(structured, dict) and isinstance(structured.get("uncertainty"), dict) else {}
            issues = structured.get("visibleCivicIssues") if isinstance(structured, dict) else None
            provider_uncertain = bool(
                result.get("status") == "available"
                and structured is not None
                and (uncertainty.get("present") or not issues)
            )
            attempts.append({
                "provider": result.get("provider", provider),
                "status": "uncertain" if provider_uncertain else result.get("status", "unavailable"),
                "reason": str(
                    uncertainty.get("reason") if provider_uncertain else result.get("reason") or ""
                )[:180],
            })
            if provider_uncertain:
                uncertain_results.append(result)
                continue
            if result.get("status") == "available" and result.get("description"):
                fallback_used = len(attempts) > 1
                LOGGER.info(json.dumps({
                    "event": "vision_provider_selected",
                    "provider": result.get("provider"),
                    "fallbackUsed": fallback_used,
                    "attemptCount": len(attempts),
                }, sort_keys=True))
                return {
                    **result,
                    "schemaVersion": result.get("schemaVersion") or SCHEMA_VERSION,
                    "providerAttempts": attempts,
                    "fallbackUsed": fallback_used,
                }

        if uncertain_results:
            result = uncertain_results[-1]
            LOGGER.info(json.dumps({"event": "vision_provider_uncertain", "attempts": attempts}, sort_keys=True))
            return {
                **result,
                "schemaVersion": result.get("schemaVersion") or SCHEMA_VERSION,
                "providerAttempts": attempts,
                "fallbackUsed": len(attempts) > 1,
            }

        final = attempts[-1] if attempts else {"status": "unavailable", "reason": "No visual provider is configured."}
        LOGGER.info(json.dumps({"event": "vision_provider_exhausted", "attempts": attempts}, sort_keys=True))
        return {
            "schemaVersion": SCHEMA_VERSION,
            "status": final.get("status", "unavailable"),
            "reason": final.get("reason") or "Visual analysis is unavailable; human review may be required.",
            "provider": "human-review-fallback",
            "providerAttempts": attempts,
            "fallbackUsed": bool(attempts),
            "cacheHit": False,
        }

    def status_payload(self):
        return {
            "providerOrder": list(VISION_PROVIDER_ORDER),
            "fallbackEnabled": VISION_FALLBACK_ENABLED,
            "florenceRemote": florence_remote_provider.status_payload(),
            "gemini": gemini_vision_provider.status_payload(),
            "localLegacy": florence_runtime.status_payload(),
            "humanReviewFallback": True,
        }


vision_provider_chain = VisionProviderChain()
