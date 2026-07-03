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
| Database | MongoDB | Users, complaints, department units, emergency broadcasts, status history, chat sessions, registration and password reset OTPs |
| AI service | `ai_service/` | Flask `/analyze`, `/transcript/process`, `/chat`, `/health` endpoints |
| Shared AI data | `shared/aiCategories.json` | Single source of truth for complaint categories across Node and Flask |
| Evaluation | `scripts/evaluateAi.js`, `scripts/evaluateVision.py` | Deterministic category evaluation and optional local vision evaluation |
| Speech | Deepgram | Live speech-to-text with transcript cleanup through the AI service |
| Email | SMTP | OTP delivery, authority forwarding, close-contact warnings, and emergency broadcast emails |

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
    API->>API: Route to department unit by ward, category, severity, workload
    API->>DB: Store complaint, routing, status history, AI metadata
    API->>DB: Create emergency broadcast record when high-risk
    API->>Mail: Optional authority forwarding or emergency email broadcast
    API-->>FE: Complaint result, routing, broadcast, and review state
```

## Updated AI Service

The AI service now uses a decision-engine v4 layer that fuses text, image, context, severity, and confidence signals into an auditable final decision. It no longer depends on separate category definitions in different runtimes, and image classification supports every shared complaint category through CLIP-style local vision when available, with deterministic fallback behavior when it is not.

| Area | Old AI Service | New AI Service |
| --- | --- | --- |
| Category source | Python and Node logic could drift separately | `shared/aiCategories.json` drives Flask and Express fallback |
| Image input | Mostly frontend-derived hints and narrow image signals | Browser sends resized `imageBase64` plus MIME type to the AI pipeline |
| Vision range | Limited image mapping for a small set of visual issues | All shared categories can receive image candidates |
| Vision model | No local zero-shot vision model path | Optional local CLIP model: `sentence-transformers/clip-ViT-B-32` |
| Vision fallback | Implicit and difficult to inspect | Explicit feature fallback with `provider`, `model`, and `fallbackUsed` metadata |
| Precision | One dominant category with limited decision context | Text prediction, image prediction, final prediction, confidence calibration, conflict detection, and review flag |
| Low-confidence handling | Less explicit review routing | Low-confidence complaints become `Needs Review` |
| Auditability | Limited AI provenance on stored complaints | Provider, engine, model, fallback state, category ID, evidence used, reasoning, vision candidates, geocoding source, and evaluation version are stored |
| Evaluation | No focused local AI regression command | `npm run evaluate:ai`, `python scripts/evaluateAiService.py`, plus optional vision evaluation |
| Logs | General application logs | Structured `ai_complaint_decision` JSON logs |
| Transcript handling | Basic transcript pass-through | Filler cleanup, civic-term normalization, summaries, and provider metadata |

## AI Capabilities

| Capability | Status | Notes |
| --- | --- | --- |
| Text classification | Production-ready baseline | Semantic similarity, keyword signals, category aliases, severity, sentiment, priority |
| Image classification | Broadened | Local CLIP model when available, feature fallback when unavailable |
| Voice complaints | Integrated | Deepgram STT with Flask transcript post-processing |
| Context awareness | Integrated | Prior user complaints and nearby/recent issues influence urgency |
| Explainability | Integrated | Structured reasoning includes matched keywords, visual signals, context signals, risk factors, and decision summary |
| Conflict detection | Integrated | Strong disagreement between text and image evidence is flagged for admin review |
| Review routing | Integrated | Low-confidence or conflicting cases are assigned `Needs Review` |
| Evaluation | Integrated | Deterministic local evaluation, AI-service decision evaluation, and optional vision checks |

## Product And User Experience

| Area | Current Behavior |
| --- | --- |
| Authentication | Email OTP registration, forgot-password OTP reset, standard login, no captcha, no demo login route |
| Citizen workflow | Submit text, image, or voice complaints and review generated summaries |
| Admin workflow | Review complaints, inspect AI/routing/broadcast details, update statuses, manage accounts |
| Complaint detail | Case-file modal with department routing, emergency broadcast status, AI decision notes, confidence breakdown, alternatives, alert history, and status timeline |
| Status tracking | Complaint status history is persisted |
| AI helper | Floating chatbot supports status lookup, complaint guidance, FAQ, and navigation help |
| Reporting | PDF complaint reports, BBMP email forwarding, routing metadata, and emergency broadcast audit |
| Operations map | Visual marker board, hotspot summary, priority watch, focused complaint preview, and direct case opening |
| Dashboard insights | Review load, priority load, hotspot, oldest open case, resolution rate, and routing concentration |
| Smart response | Department/unit routing uses issue type, severity, ward inference, and active workload |
| Safety | Low-confidence AI classifications require review, while high-risk cases create emergency broadcast records |

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
4. Receive the routed authority, department unit, and broadcast status where applicable.
5. Generate a PDF, forward the complaint, or notify close contacts.
6. Track the complaint later from the dedicated complaints view.

### Admin Journey

1. Open the dashboard and inspect review load, hotspot concentration, and open-case pressure.
2. Open a complaint in the case-file modal to inspect history, alerts, AI reasoning, routing, and emergency broadcast audit.
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

Smart routing uses built-in fallback department units when no `DepartmentUnit` records exist in MongoDB. Add `DepartmentUnit` records later to replace the fallback registry with real ward, department, contact email, and portal metadata.

## Evaluation

Run the deterministic AI category evaluation:

```bash
npm run evaluate:ai
```

Run category evaluation plus optional real image vision evaluation:

```bash
AI_EVAL_WITH_VISION=true npm run evaluate:ai
```

Run the Flask AI-service decision-engine evaluation:

```bash
python scripts/evaluateAiService.py
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
- Stores routing and emergency broadcast audit metadata when applicable.

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
- `decision`
- `textPrediction`
- `imagePrediction`
- `conflictDetected`
- `evidenceUsed`
- `reasoning`
- `quality`
- `confidenceLabel`
- `reviewRequired`

</details>

<details>
<summary>Smart Routing And Emergency Broadcast</summary>

- New complaints receive a routing decision with authority, department, unit, ward/coverage, workload score, escalation level, and routing reason.
- Routing uses AI category, priority, inferred ward/location keywords, and active complaint workload.
- High-risk complaints can create emergency broadcast records with in-app audit data and email delivery when SMTP recipients are available.
- Emergency broadcast recipients currently include admins and users with recent complaints in the same area.
- SMS is represented as `sms-ready` metadata so Twilio or another SMS provider can be connected later without changing the complaint workflow.

</details>

<details>
<summary>Core Data Models</summary>

- `User`: authenticated Citizen/Admin accounts, email, role, disabled state, and login metadata.
- `Complaint`: complaint details, AI metadata, routing decision, broadcast summary, alerts, status history, and map coordinates.
- `DepartmentUnit`: configurable authority, department, unit, ward coverage, category coverage, workload capacity, contact email, and portal URL.
- `EmergencyBroadcast`: high-risk broadcast audit record with channels, recipients, delivery status, message, and linked complaint.
- `RegistrationOtp` and `PasswordResetOtp`: short-lived OTP records for account creation and password reset.
- `ChatSession`: stored chatbot conversation state.

</details>

<details>
<summary>Authentication Notes</summary>

- Captcha has been removed from the login page.
- Demo login has been removed.
- Registration uses email OTP verification.
- Forgot password uses email-only OTP reset. The reset request does not reveal whether an email is registered.
- Auth OTPs expire after 90 seconds.
- Seed scripts may create local seed users for development databases; replace or remove seeded credentials before production use.

</details>

## Project Structure

```text
Urban-Pulse-Ai/
|-- ai_service/              # Flask AI service
|   |-- app.py               # AI HTTP endpoints
|   |-- pipeline.py          # Complaint analysis pipeline
|   |-- decision_engine.py   # Confidence calibration, conflict detection, structured reasoning
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
|   |-- evaluateAiService.py # Flask decision-engine evaluation
|   |-- evaluateVision.py    # Optional image evaluation
|   `-- seedDatabase.js
|-- shared/
|   `-- aiCategories.json    # Shared complaint category catalog
|-- src/
|   |-- controllers/         # Express controllers
|   |-- middleware/          # Auth and security middleware
|   |-- models/              # MongoDB models, department units, emergency broadcasts
|   |-- routes/              # API routes
|   `-- services/            # AI, complaint, routing, broadcast, email, OTP, seed services
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
| Email | SMTP provider | Sends OTPs, authority forwarding emails, close-contact warnings, and emergency broadcast emails |

Use `render.yaml` as the deployment starting point. Configure production secrets in the Render dashboard instead of committing them.

## Production Checklist

| Item | Why It Matters |
| --- | --- |
| Strong `JWT_SECRET` | Protects session tokens |
| Production MongoDB URI | Keeps local and production data separate |
| Real SMTP credentials | Enables registration, password reset, and escalation emails |
| Authority contact registry | Replace fallback department units with real ward, department, email, and portal metadata |
| Deepgram API key | Enables voice complaint transcription |
| AI service URL | Connects Express to Flask in production |
| Vision model cache planning | Prevents slow cold starts for the local CLIP model |
| Evaluation in CI | Catches category regressions before deploy |
| Broadcast dry run | Confirm emergency broadcast records are created and email failures do not block complaint submission |
| Seed credential cleanup | Prevents development credentials from reaching production |
