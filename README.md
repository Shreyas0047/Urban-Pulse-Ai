# Urban Pulse Ai

<p align="center">
  <strong>AI-powered civic complaint intake, classification, review, and escalation platform.</strong>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img alt="Flask" src="https://img.shields.io/badge/Flask-AI_Service-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img alt="AI Vision" src="https://img.shields.io/badge/Vision-CLIP_Ready-5B5FC7?style=for-the-badge" />
  <img alt="GitHub Mermaid" src="https://img.shields.io/badge/GitHub-Mermaid_Diagrams-0969DA?style=for-the-badge&logo=github&logoColor=white" />
</p>

Urban Pulse Ai helps citizens submit civic complaints with text, images, or voice, then uses a production-oriented AI pipeline to classify the issue, estimate severity, explain the decision, and route the complaint for review or escalation.

The README uses GitHub-visible components only: badges, Mermaid diagrams, tables, and collapsible sections. GitHub does not run custom JavaScript or CSS animations inside README files, so the architecture visuals below are rendered natively by GitHub.

## Current System

| Layer | Component | Responsibility |
| --- | --- | --- |
| Frontend | `public/` | Citizen/admin dashboard, complaint form, image preparation, voice UI, chatbot, PDF export, account actions |
| API | `src/` | Express routes, auth, validation, complaint workflow, geocoding, email, AI orchestration |
| Database | MongoDB | Users, complaints, status history, chat sessions, registration OTPs |
| AI service | `ai_service/` | Flask `/analyze`, `/transcript/process`, `/chat`, `/health` endpoints |
| Shared AI data | `shared/aiCategories.json` | Single source of truth for complaint categories across Node and Flask |
| Evaluation | `scripts/evaluateAi.js`, `scripts/evaluateVision.py` | Deterministic category evaluation and optional local vision evaluation |
| Speech | Deepgram | Live speech-to-text with transcript cleanup through the AI service |
| Email | SMTP | OTP delivery and BBMP complaint forwarding |

## Architecture

```mermaid
flowchart LR
    Citizen[Citizen Browser] --> Frontend[Frontend Dashboard]
    Admin[Admin Browser] --> Frontend
    Frontend --> Express[Express API]
    Express --> Mongo[(MongoDB)]
    Express --> Flask[Flask AI Service]
    Flask --> Catalog[Shared Category Catalog]
    Flask --> TextAI[Text Classifier]
    Flask --> VisionAI[Local CLIP Vision]
    Flask --> VisionFallback[Feature Fallback]
    Express --> Deepgram[Deepgram STT]
    Express --> SMTP[SMTP Email]
    Express --> Geo[Nominatim Geocoding]
```

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Express API
    participant AI as Flask AI
    participant DB as MongoDB
    participant Mail as SMTP

    U->>FE: Submit text, image, or voice complaint
    FE->>FE: Resize image and prepare AI payload
    FE->>API: POST complaint
    API->>API: Validate auth, image size, MIME type
    API->>AI: Analyze complaint and optional image
    AI->>AI: Score text, vision, context, severity
    AI-->>API: Category, confidence, explanation, provenance
    API->>API: Calibrate confidence and geocode location
    API->>DB: Store complaint, status history, AI metadata
    API->>Mail: Optional BBMP forwarding
    API-->>FE: Complaint result and review state
```

## Updated AI Service

The AI service is now broader, more explainable, and easier to evaluate. It no longer depends on separate category definitions in different runtimes, and image classification now supports every shared complaint category through CLIP-style local vision when available, with deterministic fallback behavior when it is not.

| Area | Old AI Service | New AI Service |
| --- | --- | --- |
| Category source | Python and Node logic could drift separately | `shared/aiCategories.json` drives Flask and Express fallback |
| Image input | Mostly frontend-derived hints and narrow image signals | Browser sends resized `imageBase64` plus MIME type to the AI pipeline |
| Vision range | Limited image mapping for a small set of visual issues | All shared categories can receive image candidates |
| Vision model | No local zero-shot vision model path | Optional local CLIP model: `sentence-transformers/clip-ViT-B-32` |
| Vision fallback | Implicit and difficult to inspect | Explicit feature fallback with `provider`, `model`, and `fallbackUsed` metadata |
| Precision | One dominant category with limited decision context | Top candidates, confidence breakdown, label, explanation, and review flag |
| Low-confidence handling | Less explicit review routing | Low-confidence complaints become `Needs Review` |
| Auditability | Limited AI provenance on stored complaints | Provider, engine, model, fallback state, category ID, vision candidates, geocoding source, and evaluation version are stored |
| Evaluation | No focused local AI regression command | `npm run evaluate:ai` plus optional `AI_EVAL_WITH_VISION=true npm run evaluate:ai` |
| Logs | General application logs | Structured `ai_complaint_decision` JSON logs |
| Transcript handling | Basic transcript pass-through | Filler cleanup, civic-term normalization, summaries, and provider metadata |

## AI Capabilities

| Capability | Status | Notes |
| --- | --- | --- |
| Text classification | Production-ready baseline | Semantic similarity, keyword signals, category aliases, severity, sentiment, priority |
| Image classification | Broadened | Local CLIP model when available, feature fallback when unavailable |
| Voice complaints | Integrated | Deepgram STT with Flask transcript post-processing |
| Context awareness | Integrated | Prior user complaints and nearby/recent issues influence urgency |
| Explainability | Integrated | Explanation, confidence label, confidence breakdown, and candidates are returned |
| Review routing | Integrated | Uncertain cases are assigned `Needs Review` |
| Evaluation | Integrated | Deterministic local evaluation with optional vision checks |

## Product And User Experience

| Area | Current Behavior |
| --- | --- |
| Authentication | Email OTP registration, standard login, no captcha, no demo login route |
| Citizen workflow | Submit text, image, or voice complaints and review generated summaries |
| Admin workflow | Review complaints, update statuses, inspect details, manage accounts |
| Complaint detail | Case-file modal with routing summary, AI decision notes, confidence breakdown, alternatives, alert history, and status timeline |
| Status tracking | Complaint status history is persisted |
| AI helper | Floating chatbot supports status lookup, complaint guidance, FAQ, and navigation help |
| Reporting | PDF complaint reports and BBMP email forwarding |
| Operations map | Visual marker board, hotspot summary, priority watch, focused complaint preview, and direct case opening |
| Dashboard insights | Review load, priority load, hotspot, oldest open case, resolution rate, and routing concentration |
| Safety | Low-confidence AI classifications require review instead of being silently trusted |

## Latest UX And Ops Upgrades

The current production pass focuses on making the system easier to trust, scan, and operate under real complaint volume.

| Upgrade | What Changed | Why It Helps |
| --- | --- | --- |
| Case-file complaint detail | Complaint details now open as a structured case view with summary cards, AI explanation, numeric decision breakdown, alternatives, alert notes, and a timeline | Admins can understand and verify a case faster |
| Operations map | The map area now renders complaint markers from stored coordinates, highlights visible hotspots, and lets operators open a case directly from the map rail | Makes geographic clustering and triage easier |
| Stronger admin insights | Dashboard insight cards now surface hotspot concentration, oldest open case, and resolution rate in addition to confidence and review load | Gives admins clearer operational priorities |
| Loading polish | Dashboard panels can show loading placeholders while filtered data reloads | Reduces UI jumpiness and makes the app feel more deliberate |
| Single-focus navigation | Each top-level workspace keeps attention on one functional area at a time | Reduces clutter and supports task-based usage |

## Main User Journeys

### Citizen Journey

1. Login or register with email and password.
2. Add a location, complaint text or voice transcript, and optional image.
3. Review AI-generated description and submit the case.
4. Generate a PDF, forward the complaint, or notify close contacts.
5. Track the complaint later from the dedicated complaints view.

### Admin Journey

1. Open the dashboard and inspect review load, hotspot concentration, and open-case pressure.
2. Open a complaint in the case-file modal to inspect history, alerts, and AI reasoning.
3. Update status or acknowledge alerts.
4. Use the operations map to focus on geographic clusters and jump into cases quickly.
5. Manage roles, account state, and account deletion from the accounts area.

## Run Locally

Install Node dependencies:

```bash
npm install
```

Install Python dependencies:

```bash
pip install -r ai_service/requirements.txt
```

Use Python 3.11 for the full AI model stack. The Render blueprint pins `PYTHON_VERSION=3.11.11`; newer local Python versions can still run the Flask service in deterministic fallback mode, but skip the `torch` and `sentence-transformers` model packages.

Create `.env` in the project root:

```bash
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smart-community?retryWrites=true&w=majority
JWT_SECRET=replace-with-a-strong-secret
AI_SERVICE_URL=http://127.0.0.1:5000
DEEPGRAM_API_KEY=your_deepgram_api_key
DEEPGRAM_MODEL=nova-3
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@example.com
SMTP_PASS=your_app_password
SMTP_FROM=your_email@example.com
BBMP_EMAIL_TO=comm@bbmp.gov.in
CORS_ORIGIN=http://localhost:3000
ALLOW_ROLE_TOKEN_ISSUE=false
```

AI-specific environment variables:

```bash
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
VISION_MODEL_NAME=sentence-transformers/clip-ViT-B-32
VISION_CONFIDENCE_THRESHOLD=0.24
VISION_MAX_IMAGE_BYTES=2097152
VISION_IMAGE_WEIGHT=0.38
TEXT_CONFIDENCE_THRESHOLD=0.26
CONTEXT_REPEAT_HIGH=5
CONTEXT_REPEAT_MEDIUM=3
MAX_EXPLANATION_KEYWORDS=4
AI_EVAL_MIN_ACCURACY=0.65
```

Optional database seed:

```bash
npm run seed
```

Start the Flask AI service:

```bash
npm run start:ai
```

Start the Express app in another terminal:

```bash
npm start
```

Open the app:

```text
http://localhost:3000
```

The first Python 3.11 vision run may download or load the configured `sentence-transformers/clip-ViT-B-32` model. If the model cannot load, the AI service still returns deterministic feature-fallback image candidates.

## Evaluation

Run the deterministic AI category evaluation:

```bash
npm run evaluate:ai
```

Run category evaluation plus optional real image vision evaluation:

```bash
AI_EVAL_WITH_VISION=true npm run evaluate:ai
```

The default minimum accuracy threshold is controlled by:

```bash
AI_EVAL_MIN_ACCURACY=0.65
```

## API And Workflow Components

<details>
<summary>Complaint Intake</summary>

- Validates authenticated users.
- Accepts complaint text, location, optional image, and optional voice transcript.
- Compresses browser image input before sending it for AI analysis.
- Validates AI image payload size and MIME type on the server.
- Runs AI analysis through Flask when available.
- Falls back to local deterministic analysis if the AI service is unavailable.
- Stores AI provenance and status history with the complaint.

</details>

<details>
<summary>AI Decision Metadata</summary>

Stored complaint AI metadata includes:

- `provider`
- `engine`
- `model`
- `fallbackUsed`
- `categoryId`
- `visionEngine`
- `visionProvider`
- `visionFallbackUsed`
- `visionCandidates`
- `confidenceBreakdown`
- `evaluationVersion`
- `geocodingSource`
- `explanation`
- `confidenceLabel`
- `reviewRequired`

</details>

<details>
<summary>Authentication Notes</summary>

- Captcha has been removed from the login page.
- Demo login has been removed.
- Registration uses email OTP verification.
- Seed scripts may create local seed users for development databases; replace or remove seeded credentials before production use.

</details>

## Project Structure

```text
Urban-Pulse-Ai/
|-- ai_service/              # Flask AI service
|   |-- app.py               # AI HTTP endpoints
|   |-- pipeline.py          # Complaint analysis pipeline
|   |-- vision_analysis.py   # CLIP vision and feature fallback
|   |-- category_catalog.py  # Shared category loader
|   `-- requirements.txt
|-- public/                  # Browser UI
|   |-- app.js               # Complaint, auth, admin, image preparation
|   |-- chatbot.js           # AI helper bot
|   |-- audio-transcriber.js # Voice recording/transcription UI
|   `-- styles.css
|-- scripts/
|   |-- evaluateAi.js        # Main AI evaluation runner
|   |-- evaluateVision.py    # Optional image evaluation
|   `-- seedDatabase.js
|-- shared/
|   `-- aiCategories.json    # Shared complaint category catalog
|-- src/
|   |-- controllers/         # Express controllers
|   |-- middleware/          # Auth and security middleware
|   |-- models/              # MongoDB models
|   |-- routes/              # API routes
|   `-- services/            # AI, complaint, email, OTP, seed services
|-- dataset/                 # Local category evaluation images/data
|-- render.yaml              # Render deployment blueprint
|-- package.json
`-- README.md
```

## Deployment

Recommended production layout:

| Service | Runtime | Notes |
| --- | --- | --- |
| Main app | Node.js on Render | Runs Express, frontend, auth, complaints, email, and AI orchestration |
| AI service | Python on Render | Runs Flask AI endpoints and loads text/vision models |
| Database | MongoDB Atlas | Stores users, complaints, chat sessions, OTPs, and AI metadata |
| Speech | Deepgram | Provides speech-to-text for voice complaints |
| Email | SMTP provider | Sends OTPs and complaint forwarding emails |

Use `render.yaml` as the deployment starting point. Configure production secrets in the Render dashboard instead of committing them.

## Production Checklist

| Item | Why It Matters |
| --- | --- |
| Strong `JWT_SECRET` | Protects session tokens |
| Production MongoDB URI | Keeps local and production data separate |
| Real SMTP credentials | Enables OTP and escalation emails |
| Deepgram API key | Enables voice complaint transcription |
| AI service URL | Connects Express to Flask in production |
| Vision model cache planning | Prevents slow cold starts for the local CLIP model |
| Evaluation in CI | Catches category regressions before deploy |
| Seed credential cleanup | Prevents development credentials from reaching production |
