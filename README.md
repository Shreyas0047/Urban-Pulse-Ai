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



## Current System

| Layer | Component | Responsibility |
| --- | --- | --- |
| Frontend | `public/` | Citizen/admin dashboard, complaint form, image preparation, voice UI, chatbot, PDF export, account actions |
| API | `src/` | Express routes, auth, validation, complaint workflow, geocoding, email, AI orchestration |
| Database | MongoDB | Users, complaints, department units, emergency broadcasts, incident commands, status history, chat sessions, registration and password reset OTPs |
| AI service | `ai_service/` | Flask `/analyze`, `/transcript/process`, `/chat`, `/health` endpoints |
| Shared AI data | `shared/aiCategories.json` | Single source of truth for complaint categories across Node and Flask |
| Evaluation | `scripts/evaluateAi.js`, `scripts/evaluateVision.py` | Deterministic category evaluation and optional local vision evaluation |
| Speech | Deepgram | Live speech-to-text with transcript cleanup through the AI service |
| Email | SMTP | OTP delivery, authority forwarding, close-contact warnings, and emergency broadcast emails |
| Weather | Weatherstack | Current weather context for complaint reasoning, PDF reports, and risk notes |
| Civic search | Zenserp | Official source discovery, public incident context, and civic reference links |
| Predictive risk | `riskPredictionService` | 72-hour ward-level civic risk forecast from complaints, weather context, broadcasts, and active incidents |

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
    Express --> Weather[Weatherstack Current Weather]
    Express --> Zenserp[Zenserp Google Search]
    Express --> Risk[Risk Forecast Engine]
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
    API->>API: Fetch current weather context when configured
    API->>API: Route to department unit by ward, category, severity, workload
    API->>API: Find official sources and public context when quota allows
    API->>API: Build dashboard risk forecast from recent civic pressure
    API->>DB: Store complaint, routing, weather, civic evidence, status history, AI metadata
    API->>DB: Create emergency broadcast and incident command records when high-risk
    API->>Mail: Optional authority forwarding or emergency email broadcast
    API-->>FE: Complaint result, routing, broadcast, incident command, and review state
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
| Weather context | Integrated | Weatherstack current conditions are stored with complaints and used for weather-sensitive risk notes |
| Civic evidence | Integrated | Zenserp adds official-source links and public incident context as supporting references |
| Civic risk forecast | Integrated | Dashboard predicts 72-hour ward-level risk using complaint velocity, priority, unresolved pressure, weather, broadcasts, and incident commands |
| Evaluation | Integrated | Deterministic local evaluation, AI-service decision evaluation, and optional vision checks |

## Product And User Experience

| Area | Current Behavior |
| --- | --- |
| Authentication | Clean Urban Pulse AI login/register modal, email OTP registration, forgot-password OTP reset, standard login, no captcha, no demo login route |
| Citizen workflow | Submit text, image, or voice complaints and review generated summaries |
| Admin workflow | Review complaints, inspect AI/routing/broadcast details, update statuses, manage accounts |
| Complaint detail | Case-file modal with department routing, emergency broadcast status, AI decision notes, confidence breakdown, alternatives, alert history, and status timeline |
| Status tracking | Complaint status history is persisted |
| AI helper | Floating chatbot supports status lookup, complaint guidance, FAQ, and navigation help |
| Reporting | PDF complaint reports, authority email forwarding, routing metadata, and emergency broadcast audit |
| Operations map | Visual marker board, hotspot summary, priority watch, focused complaint preview, and direct case opening |
| Dashboard insights | Review load, priority load, hotspot, oldest open case, resolution rate, and routing concentration |
| Smart response | Department/unit routing uses issue type, severity, ward inference, and active workload |
| Weather context | Weatherstack current conditions enrich complaint reasoning, reports, and weather-sensitive risk notes |
| Civic evidence | Zenserp official-source and public-context searches add supporting references to case details and PDF reports |
| Civic digital twin | Dashboard-level city health model built from complaint pressure, severity, broadcasts, active incidents, and ward hotspots |
| Civic risk forecast | 72-hour ward risk forecast ranks zones by complaint velocity, issue repetition, unresolved pressure, weather sensitivity, broadcasts, and active incidents |
| Incident command | High-risk complaints can open command-room records with SLA, assigned unit, checklist, risk score, and timeline |
| Safety | Low-confidence AI classifications require review, while high-risk cases create emergency broadcast records |

## Latest UX And Ops Upgrades

The current production pass focuses on making the system easier to trust, scan, and operate under real complaint volume.

| Upgrade | What Changed | Why It Helps |
| --- | --- | --- |
| Case-file complaint detail | Complaint details now open as a structured case view with summary cards, AI explanation, numeric decision breakdown, alternatives, alert notes, and a timeline | Admins can understand and verify a case faster |
| Operations map | The map area now renders complaint markers from stored coordinates, highlights visible hotspots, and lets operators open a case directly from the map rail | Makes geographic clustering and triage easier |
| Stronger admin insights | Dashboard insight cards now surface hotspot concentration, oldest open case, and resolution rate in addition to confidence and review load | Gives admins clearer operational priorities |
| Civic digital twin | Admin dashboard now has a dedicated City Health section for civic health, stressed zones, active incidents, weakest zone, and recommended operational focus | Helps evaluators see a city-scale intelligence layer, not only a complaint list |
| Autonomous incident command | High-risk complaints can automatically create an Active Response Room with SLA, checklist, responsible unit, timeline, risk score, and status synchronization | Turns severe reports into trackable response operations |
| Premium glass UI | The frontend now uses a Rideradian-inspired editorial layout, warm iOS/macOS-style glass surfaces, Adwaita Sans-first typography, and practical civic labels | Makes the product feel mature and polished without fake command-center wording |
| Cleaner auth screen | Login/register now uses a single `Urban Pulse AI` heading and removes the unused back button | Reduces clutter and avoids a control that did not add functionality |
| Loading polish | Dashboard panels can show loading placeholders while filtered data reloads | Reduces UI jumpiness and makes the app feel more deliberate |
| Single-focus navigation | Each top-level workspace keeps attention on one functional area at a time | Reduces clutter and supports task-based usage |
| Weather-aware complaint context | Weatherstack current conditions are stored with each complaint, shown in case details, added to PDF reports, and appended to AI reasoning when relevant | Adds real-world context for drainage, tree obstruction, road damage, utility, and safety complaints |
| Official source finder | Zenserp searches official civic/department references and recent public context without changing AI decisions | Helps admins verify escalation paths and makes formal reports more credible |
| Civic risk prediction | City Health now includes a 72-hour forecast for likely ward-level civic pressure, with confidence, drivers, and operational recommendation | Shows proactive intelligence instead of only reacting to submitted complaints |

## Main User Journeys

### Citizen Journey

1. Login or register with email and password.
2. Add a location, complaint text or voice transcript, and optional image.
3. Review AI-generated description and submit the case.
4. Receive the routed authority, department unit, and broadcast status where applicable.
5. Generate a PDF, forward the complaint, or notify close contacts.
6. Track the complaint later from the dedicated complaints view.

### Admin Journey

1. Open the dashboard and inspect review load, hotspot concentration, city health, predicted ward risk, active incidents, and open-case pressure.
2. Open a complaint in the case-file modal to inspect history, alerts, AI reasoning, routing, emergency broadcast audit, and incident command state.
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
WEATHERSTACK_API_KEY=your_weatherstack_api_key
WEATHERSTACK_BASE_URL=http://api.weatherstack.com
WEATHERSTACK_ENABLED=true
WEATHERSTACK_MONTHLY_LIMIT=90
ZENSERP_API_KEY=your_zenserp_api_key
ZENSERP_BASE_URL=https://app.zenserp.com/api/v2/search
ZENSERP_ENABLED=true
ZENSERP_MONTHLY_LIMIT=48
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FAMILY=4
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

Weather context and civic search are optional and non-blocking. If `WEATHERSTACK_API_KEY` or `ZENSERP_API_KEY` is missing, disabled, quota-limited, or temporarily unavailable, complaint submission continues and the stored complaint records that context as unavailable.

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

Verify SMTP login and TLS settings without sending an email:

```bash
npm run verify:smtp
```

Send one test OTP email through the same registration email path:

```bash
npm run verify:smtp -- --send-test=your_email@example.com
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
- Fetches Weatherstack current conditions server-side and stores weather context when available.
- Fetches Zenserp official-source links and public incident context server-side when monthly quota allows.
- Stores AI provenance and status history with the complaint.
- Stores routing, emergency broadcast, incident command, digital-twin input, and risk-forecast input metadata when applicable.

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
<summary>Monthly External API Quotas</summary>

- Weatherstack is capped by `WEATHERSTACK_MONTHLY_LIMIT`, default `90` calls per UTC calendar month.
- Zenserp is capped by `ZENSERP_MONTHLY_LIMIT`, default `48` calls per UTC calendar month.
- Quota usage is tracked in MongoDB by provider and `YYYY-MM` month.
- The app checks quota before external calls and skips providers once the monthly limit is reached.
- Quota skips never block complaint creation.

</details>

<details>
<summary>Weather Context</summary>

- Weather is fetched server-side through Weatherstack after complaint location geocoding.
- The API key is read from `WEATHERSTACK_API_KEY` and is never sent to the browser.
- Stored complaint weather data includes status, provider, observation time, location name, temperature, condition, precipitation, humidity, wind speed, and an optional context note.
- Weather notes are added only when relevant to the complaint category, such as drainage, sewage overflow, fallen trees, road damage, utility faults, or safety hazards.
- Weather failures do not block complaint creation.

</details>

<details>
<summary>Civic Evidence Search</summary>

- Zenserp is called only from the backend, and the API key is never sent to the browser.
- Official source finder searches for civic/department pages using issue type, routing department, authority, location, and Bengaluru terms.
- Public incident context searches for recent public references around high-risk or weather-sensitive complaints.
- Search results are supporting context only and never override AI classification, priority, routing, or emergency broadcast decisions.
- Stored results include title, URL, snippet, domain, query, and source type.

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
<summary>Civic Digital Twin And Incident Command</summary>

- The civic digital twin computes city and zone health from open complaints, severity, broadcasts, active incidents, and issue concentration.
- Admin dashboard cards show civic health score, stressed zones, active incidents, and the weakest zone recommendation in the City Health section.
- The Civic Risk Forecast computes a 72-hour ward-level risk score from recent complaint velocity, repeated issue type, open-case pressure, priority load, weather context, broadcasts, and active incident commands.
- Forecast cards show risk band, confidence label, likely issue, top drivers, and a practical operational recommendation.
- Forecasts are deterministic dashboard intelligence and never overwrite stored AI category, severity, routing, or broadcast decisions.
- High-risk, high-confidence complaints can automatically open an incident command record.
- Incident command records store incident code, severity, ward, assigned authority/unit, SLA deadline, checklist, timeline, broadcast link, and risk score.
- Complaint status changes are mirrored into linked incident command rooms so resolved complaints no longer count as active incidents.
- The frontend exposes active command rooms through a dedicated Active Response Rooms section and an Incidents dashboard metric.
- Complaint details and PDF reports include the incident command summary when a command room is opened.
- This is implemented as durable MongoDB data plus computed dashboard intelligence, so real-time sockets or SMS providers can be added later without replacing the workflow.

</details>

<details>
<summary>Core Data Models</summary>

- `User`: authenticated Citizen/Admin accounts, email, role, disabled state, and login metadata.
- `Complaint`: complaint details, AI metadata, routing decision, weather context, civic evidence, broadcast summary, alerts, status history, and map coordinates.
- `ExternalApiUsage`: monthly provider quota counters for Weatherstack and Zenserp.
- `DepartmentUnit`: configurable authority, department, unit, ward coverage, category coverage, workload capacity, contact email, and portal URL.
- `EmergencyBroadcast`: high-risk broadcast audit record with channels, recipients, delivery status, message, and linked complaint.
- `IncidentCommand`: high-risk response room with incident code, SLA, assigned unit, checklist, timeline, broadcast link, and risk score.
- `RegistrationOtp` and `PasswordResetOtp`: short-lived OTP records for account creation and password reset.
- `ChatSession`: stored chatbot conversation state.

</details>

<details>
<summary>Authentication Notes</summary>

- Captcha has been removed from the login page.
- Demo login has been removed.
- The login/register modal uses a single `Urban Pulse AI` heading and no unused back button.
- Registration uses email OTP verification.
- Forgot password uses email-only OTP reset. The reset request does not reveal whether an email is registered.
- Auth OTPs expire after 5 minutes.
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
|   |-- models/              # MongoDB models, department units, emergency broadcasts, incident commands, API usage counters
|   |-- routes/              # API routes
|   `-- services/            # AI, complaint, routing, broadcast, incident command, digital twin, risk prediction, weather, civic search, email, OTP, seed services
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
| Weather | Weatherstack | Adds current weather context to complaints, detail views, and PDF reports |
| Civic search | Zenserp | Adds official-source references and public incident context |

Use `render.yaml` as the deployment starting point. Configure production secrets in the Render dashboard instead of committing them.

## Production Checklist

| Item | Why It Matters |
| --- | --- |
| Strong `JWT_SECRET` | Protects session tokens |
| Production MongoDB URI | Keeps local and production data separate |
| Real SMTP credentials | Enables registration, password reset, and escalation emails |
| SMTP verification | Run `npm run verify:smtp` before deploy to confirm host, port, TLS, and credentials |
| Authority contact registry | Replace fallback department units with real ward, department, email, and portal metadata |
| Deepgram API key | Enables voice complaint transcription |
| Weatherstack API key | Enables weather-aware complaint context without exposing the key to the frontend |
| Zenserp API key | Enables official-source finder and public incident context without exposing the key to the frontend |
| Monthly API quotas | Prevents free Weatherstack and Zenserp keys from being overused |
| AI service URL | Connects Express to Flask in production |
| Vision model cache planning | Prevents slow cold starts for the local CLIP model |
| Evaluation in CI | Catches category regressions before deploy |
| Broadcast dry run | Confirm emergency broadcast records are created and email failures do not block complaint submission |
| Incident command dry run | Submit a high-risk test complaint and confirm command room, SLA, checklist, and dashboard incident count appear |
| Digital twin review | Confirm dashboard city health and stressed-zone cards render correctly for admin accounts |
| Risk forecast review | Confirm City Health shows 72-hour forecast cards with risk band, confidence, drivers, and recommendations |
| Seed credential cleanup | Prevents development credentials from reaching production |
