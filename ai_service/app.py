from flask import Flask, jsonify, request
from flask_cors import CORS

from category_catalog import COMPLAINT_CATEGORIES
from chat_logic import classify_chat_intent
from model_runtime import runtime_status
from pipeline import run_hybrid_pipeline


def compact_spaces(value):
    return " ".join(str(value or "").replace("\n", " ").split()).strip()


FILLER_PHRASES = [
    "um",
    "uh",
    "please note that",
    "i want to say",
    "i would like to report",
    "i want to report",
    "this is a complaint about",
]


TRANSCRIPT_REPLACEMENTS = {
    "water logging": "waterlogging",
    "street light": "streetlight",
    "garbage bin": "garbage bin",
    "bbmp": "BBMP",
}


def normalize_complaint_transcript(transcript):
    cleaned = compact_spaces(transcript)
    lowered = cleaned.lower()

    for phrase in FILLER_PHRASES:
        lowered = lowered.replace(phrase, " ")

    lowered = compact_spaces(lowered)
    for source, target in TRANSCRIPT_REPLACEMENTS.items():
        lowered = lowered.replace(source, target)

    if not lowered:
        return "", ""

    normalized = lowered[:1].upper() + lowered[1:]
    if normalized and normalized[-1] not in ".!?":
        normalized = f"{normalized}."

    summary = normalized
    if len(summary) > 420:
        summary = summary[:417].rsplit(" ", 1)[0].rstrip(".,;:") + "..."

    return normalized, summary

app = Flask(__name__)
CORS(app)


@app.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "service": "urban-pulse-ai-service",
            "engine": "ai-service-decision-engine-v4",
            "categoryCount": len(COMPLAINT_CATEGORIES),
            "models": runtime_status(),
            "capabilities": {
                "semanticTextClassification": True,
                "imageClassification": True,
                "confidenceCalibration": True,
                "textImageConflictDetection": True,
                "structuredExplainability": True,
                "transcriptNormalization": True,
            },
        }
    )


@app.post("/analyze")
def analyze():
    payload = request.get_json(silent=True) or {}
    return jsonify(run_hybrid_pipeline(payload))


@app.post("/transcript/process")
def process_transcript():
    payload = request.get_json(silent=True) or {}
    transcript = compact_spaces(payload.get("transcript"))

    if not transcript:
        return jsonify({"error": "Transcript text is required."}), 400

    normalized, summary = normalize_complaint_transcript(transcript)

    return jsonify(
        {
            "transcript": transcript,
            "normalizedTranscript": normalized,
            "summary": summary,
            "language": payload.get("language") or "unknown",
            "provider": "flask-transcript-normalizer-v2",
        }
    )


@app.post("/chat")
def chat():
    payload = request.get_json(silent=True) or {}
    message = compact_spaces(payload.get("message"))

    if not message:
        return jsonify({"error": "Message is required."}), 400

    result = classify_chat_intent(message, payload.get("history") or [])
    return jsonify(result)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
