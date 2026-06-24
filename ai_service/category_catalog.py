import json
from pathlib import Path


CATALOG_PATH = Path(__file__).resolve().parent.parent / "shared" / "aiCategories.json"


def _load_categories():
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        categories = json.load(handle)

    normalized = []
    for item in categories:
        normalized.append(
            {
                "id": item["id"],
                "label": item["label"],
                "group": item.get("group", "General"),
                "team": item.get("team", "Help Desk"),
                "authority": item.get("authority", "Gram Panchayat"),
                "aliases": item.get("aliases", []),
                "keywords": [(term, float(weight)) for term, weight in item.get("keywords", [])],
                "critical_keywords": item.get("critical_keywords", []),
                "base_priority": float(item.get("base_priority", 0.45)),
            }
        )

    return normalized


COMPLAINT_CATEGORIES = _load_categories()
CATEGORY_BY_ID = {category["id"]: category for category in COMPLAINT_CATEGORIES}

DATASET_CATEGORY_ALIASES = {
    "plumbing": "water_leakage",
    "electrical": "utility_fault",
    "sanitation": "garbage",
    "maintenance": "wall_damage",
    "infrastructure": "road_damage",
    "security": "security",
}

FAQ_HINTS = {
    "login": "Use the login/register overlay to authenticate as Citizen or Admin.",
    "report": "Use Report an Issue to submit text, voice, and image-based complaints.",
    "status": "Use My Complaints or ask the chatbot for your latest complaint status.",
    "map": "Use the live location preview in the map panel to verify the issue location.",
}

FAQ_TOPICS = [
    {
        "patterns": ["login", "sign in", "register", "signup", "sign up", "otp", "account"],
        "response": "Use the login and registration overlay to sign in as Citizen or Admin. Registration requires email OTP verification before the account is created.",
    },
    {
        "patterns": ["report", "raise complaint", "submit complaint", "file complaint", "how do i complain"],
        "response": "Use Report an Issue to submit a complaint. You can enter text, record voice, attach an image, set the location, then submit it for AI analysis and routing.",
    },
    {
        "patterns": ["voice", "audio", "transcript", "transcription", "recording", "microphone"],
        "response": "Voice complaints use live recording in the browser. After recording stops, the backend sends the audio to Deepgram, then the processed transcript is filled into the complaint summary.",
    },
    {
        "patterns": ["map", "location", "live location", "preview"],
        "response": "Use Live Location to fill the location field automatically. Show Map updates the live location preview without reopening the old complaint marker map.",
    },
    {
        "patterns": ["admin", "dashboard", "reset", "alerts", "status update"],
        "response": "Admin actions stay permission-protected. Admin users can review complaints, update status, manage dashboard data, and clear operational history through the admin panels.",
    },
    {
        "patterns": ["bbmp", "email", "mail", "portal"],
        "response": "The system can generate a PDF complaint summary and send the complaint to the BBMP email flow. The BBMP portal link remains available in the dashboard footer.",
    },
    {
        "patterns": ["pdf", "receipt", "download"],
        "response": "After complaint analysis, you can generate a PDF summary from the dashboard. That output is intended for record keeping and email escalation.",
    },
    {
        "patterns": ["status", "track", "progress", "latest complaint"],
        "response": "You can ask the chatbot for complaint status, or use the complaint history panels to review the latest status, priority, and assigned authority.",
    },
]
