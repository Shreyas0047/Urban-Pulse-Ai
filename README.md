# Urban Pulse AI

<p align="center">
  <img src="public/urban-pulse-logo-transparent.png" alt="Urban Pulse AI" width="360" />
</p>

<p align="center">
  <strong>AI-powered civic complaint reporting, threat detection, smart routing, and response intelligence for modern cities.</strong>
</p>

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img alt="Flask" src="https://img.shields.io/badge/Flask-AI_Service-000000?style=for-the-badge&logo=flask&logoColor=white" />
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img alt="Vision" src="https://img.shields.io/badge/Vision-CLIP_Ready-5B5FC7?style=for-the-badge" />
  <img alt="License" src="https://img.shields.io/badge/License-MIT-111827?style=for-the-badge" />
</p>

Urban Pulse AI is a full-stack civic intelligence platform where citizens can report local issues with text, images, voice, and location, while administrators receive AI-assisted classification, threat assessment, routing, public context, operational dashboards, and formal PDF reports.

The project is built around a simple idea: civic complaint systems should not stop at storing reports. They should understand the incident, estimate risk, route it to the right team, preserve evidence, and help authorities act faster.

## Table Of Contents

- [Highlights](#highlights)
- [Why This Project Exists](#why-this-project-exists)
- [Feature Overview](#feature-overview)
- [Architecture](#architecture)
- [AI Pipeline](#ai-pipeline)
- [Threat Detection](#threat-detection)
- [User Workflows](#user-workflows)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Locally](#running-locally)
- [Scripts](#scripts)
- [API Reference](#api-reference)
- [Data Models](#data-models)
- [Evaluation And Testing](#evaluation-and-testing)
- [Deployment](#deployment)
- [Production Checklist](#production-checklist)
- [Troubleshooting](#troubleshooting)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

## Highlights

- AI complaint intake with text, image, voice, and location evidence.
- Image-first incident guessing, including image-only complaint handling.
- Structured threat assessment with risk score, hazards, safety gate, duplicate signal, and image integrity snapshot.
- Smart routing to department units based on category, severity, ward inference, and active workload.
- Emergency broadcast records for high-risk complaints.
- Incident command rooms with SLA, checklist, timeline, assigned unit, and risk score.
- Weatherstack context for weather-sensitive civic issues.
- Zenserp civic evidence search for official references and public incident context.
- Monthly quota guard for free external API keys.
- MongoDB-backed OTP registration and forgot-password flow.
- PDF complaint reports suitable for escalation and record keeping.
- Admin dashboard with analytics, operations map, civic digital twin, and 72-hour civic risk forecast.
- Express fallback AI path when the Flask AI service is unavailable.
- Deterministic AI evaluation scripts for regression checking.
- Versioned real-world benchmark foundation with provenance, privacy review, independent annotation, and leakage-safe splits.

## Why This Project Exists

Most civic complaint platforms behave like ticket forms. They accept a description, store a record, and wait for manual review. Urban Pulse AI tries to move the system closer to a civic response layer.

The platform focuses on four questions:

1. What is the issue?
2. How risky is it?
3. Who should handle it?
4. What evidence helps authorities act confidently?

A fallen tree on a road, a live wire near water, sewage near a school, or a damaged road at a junction should not all be treated like generic text tickets. The system is designed to preserve normal complaint flow while adding intelligence where it matters.

## Feature Overview

| Area | Capability | Status |
| --- | --- | --- |
| Authentication | Email/password login, role selection, email OTP registration, forgot-password OTP reset | Integrated |
| Citizen reporting | Text complaint, voice transcript, image upload, location, map preview | Integrated |
| Image analysis | Browser-side image features, resized image upload, Flask vision analysis, local fallback | Integrated |
| Threat intelligence | Threat level, risk score, hazards, relationships, confidence, safety gate, duplicate signal | Integrated |
| Smart routing | Department/unit selection by category, severity, ward, and active workload | Integrated |
| Weather context | Weatherstack current conditions for weather-sensitive complaints | Integrated |
| Civic evidence | Zenserp official-source links and public incident context | Integrated |
| Quota guard | MongoDB-backed monthly usage limits for Weatherstack and Zenserp | Integrated |
| Emergency broadcast | In-app/email-ready broadcast records for high-risk complaints | Integrated |
| Local area alerts | Users can opt in to area-based email alerts for serious nearby complaints | Integrated |
| Community proof | Citizens discover sanitized matching incidents in saved areas and submit corroborated, cleared, or worsening signals | Integrated |
| Resolution loop | Reporter follow-up notes/photos and conservative AI comparison after authority resolution | Integrated |
| Human AI review | Admin confirmation, correction, and insufficient-evidence workflow with mandatory reasoning and stale-write protection | Integrated |
| AI area understanding | Extracts likely area, landmarks, ward hints, and matching terms from messy complaint locations | Integrated |
| AI complaint clustering | Groups likely duplicate reports into durable incident clusters without deleting individual complaints | Integrated |
| Auto follow-up scheduler | Creates due/overdue follow-up notes for unresolved complaints based on priority | Integrated |
| Citizen verification voting | Lets users confirm whether an issue is still present, resolved, or getting worse | Integrated |
| Incident command | SLA, checklist, timeline, command status, risk score | Integrated |
| Admin dashboard | Metrics, filters, complaint review, alerts, user management | Integrated |
| Operations map | Complaint markers, hotspot summary, focused complaint preview | Integrated |
| Civic digital twin | City health, stressed zones, active incidents, operational focus | Integrated |
| Civic risk forecast | 72-hour ward-level risk prediction from complaint pressure and weather | Integrated |
| Reports | PDF generation, authority forwarding, close-contact notification | Integrated |
| Chatbot | FAQ, navigation help, complaint status, guided complaint creation | Integrated |
| Evaluation | Node AI evaluation, Flask decision evaluation, optional vision evaluation | Integrated |

## Architecture

```mermaid
flowchart LR
    Citizen[Citizen Browser] --> Frontend[Liquid Glass Frontend]
    Admin[Admin Browser] --> Frontend
    Frontend --> Express[Express API]
    Express --> Mongo[(MongoDB Atlas)]
    Express --> Flask[Flask AI Service]
    Flask --> Catalog[Shared Category Catalog]
    Flask --> TextAI[Semantic Text Classifier]
    Flask --> VisionAI[CLIP Vision Model]
    Flask --> VisionFallback[Feature Fallback]
    Flask --> ThreatAI[Threat Intelligence]
    Express --> Deepgram[Deepgram STT]
    Express --> SMTP[SMTP Email]
    Express --> Geo[Nominatim Geocoding]
    Express --> Weather[Weatherstack]
    Express --> Zenserp[Zenserp Search]
    Express --> Routing[Routing Engine]
    Express --> Risk[Risk Forecast]
```

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant API as Express API
    participant AI as Flask AI
    participant DB as MongoDB
    participant EXT as External Providers

    U->>FE: Submit complaint with text, image, voice, or location
    FE->>FE: Extract image features and prepare payload
    FE->>API: POST /api/analyze-complaint
    API->>API: Validate auth, image size, MIME type, and location
    API->>AI: Analyze complaint
    AI->>AI: Classify text, vision, context, severity, and threat
    AI-->>API: Category, confidence, threatAssessment, explanation
    API->>API: Calibrate confidence and geocode location
    API->>EXT: Weatherstack and Zenserp when configured and quota allows
    API->>API: Route complaint to department/unit
    API->>DB: Store complaint, AI metadata, routing, evidence, weather, history
    API->>DB: Create broadcast and incident command if high-risk
    API-->>FE: Return complaint result and operational metadata
```

## AI Pipeline

Urban Pulse AI uses a hybrid AI pipeline with two execution paths.

| Path | When It Runs | Purpose |
| --- | --- | --- |
| Flask AI service | Preferred path when `AI_SERVICE_URL` is reachable | Semantic text classification, optional CLIP vision, feature fallback, structured decision engine, threat assessment |
| Express fallback | When Flask AI is unavailable or times out | Deterministic keyword/feature fusion so complaint submission continues |

The AI output includes:

- `category` and category labels.
- `confidence` and confidence label.
- `priority` with level and score.
- `nlp` classification details.
- `cv` visual detection details.
- `decision` with text prediction, image prediction, conflict flag, reasoning, and quality signals.
- `threatAssessment` with structured risk intelligence.
- `aiMeta` with provider, engine, model, fallback state, category ID, vision provider, evaluation version, and image fingerprint.

### Shared Category Catalog

The category catalog lives in [shared/aiCategories.json](shared/aiCategories.json). Both Flask and Express use this file so the AI service and fallback path do not drift apart.

Current category coverage includes:

- Gas leak / fire risk
- Road damage
- Tree / obstruction on road
- Garbage overflow
- Sewage / manhole overflow
- Drainage / waterlogging
- Wall / building damage
- Security concern
- Utility fault
- Water leakage / pipe burst
- Stray animal / animal menace
- Vehicle obstruction / illegal parking

## Threat Detection

## Civic Intelligence Layer

Urban Pulse also turns stored complaint evidence into an explainable civic operations view:

- **Urban Pulse Radar:** animated risk waves over active mapped zones, based on open-case severity and threat signals.
- **Civic Time Machine:** a chronological account of reporting, status changes, community proof, and resolution evidence.
- **Consequence Scenario:** a constrained planning scenario for an unresolved case, clearly labeled as a non-predictive decision aid.
- **Community Proof Network:** citizens with matching saved local-alert areas can corroborate, clear, or flag an active issue as worsening; one signal per user is retained.
- **Incident DNA:** a visual breakdown of report text, image checks, location, risk, context, and community signals.

Threat detection is one of the most important AI sections of the project. It is designed to make the platform stronger than a plain classifier.

The `threatAssessment` object can include:

| Field | Meaning |
| --- | --- |
| `status` | `confirmed`, `probable`, `uncertain`, or `no_image` |
| `incident` | Human-readable incident label |
| `incidentCategoryId` | Shared category ID |
| `threatLevel` | `Critical`, `High`, `Medium`, `Low`, or `Needs Review` |
| `riskScore` | Numeric threat score from `0` to `1` |
| `confidence` | Threat confidence from visual/text/context evidence |
| `hazards` | Specific hazards inferred from the complaint |
| `relationships` | Risk relationships such as tree plus road or water plus electrical asset |
| `visualEvidence` | Short evidence statements for admins and reports |
| `counterEvidence` | Reasons the model may be uncertain |
| `missingEvidence` | Missing inputs that would improve certainty |
| `followUpQuestions` | Questions for high-risk or uncertain cases |
| `consensus` | Vision-pass agreement and candidate margin |
| `integrity` | Image hash, size, metadata state, and quality notes |
| `duplicateCorrelation` | Exact/near/related recent complaint correlation |
| `safetyGate` | `auto_route`, `needs_review`, or `request_more_evidence` |

Examples of relationship rules:

- Fallen tree plus road wording means access obstruction risk.
- Fallen tree plus live wire wording means critical electrical risk.
- Water or leakage plus electrical wording means shock/fire risk.
- Open manhole or sewage near sensitive areas means fall or contamination risk.
- Structural damage plus collapse wording means critical structural risk.
- Vehicle obstruction plus ambulance/hospital/fire-lane context means emergency access risk.

Important design rule: public search context and weather context support the case, but they do not override AI classification, routing, or broadcast decisions by themselves.

## User Workflows

### Citizen Flow

1. Register or log in with email and password.
2. Verify registration or password reset through email OTP when needed.
3. Enter location and complaint description.
4. Optionally attach an image or record voice.
5. Submit the complaint for AI analysis.
6. Review generated issue type, severity, authority, routing, and alerts.
7. Download a PDF report or send escalation emails.
8. Track complaint status later from the complaints view or chatbot.
9. After an authority marks a case resolved, submit a follow-up confirmation with an optional photo. The resolution loop records citizen evidence and returns `citizen_confirmed`, `needs_rework`, or `needs_admin_review` without treating a weak image as proof of completed work.
10. Enable local alerts to view privacy-safe nearby incidents and contribute a community proof signal without accessing another reporter's case file.

### Admin Flow

1. Log in as Admin.
2. Review dashboard metrics, alerts, complaint load, and risk forecast.
3. Open a complaint case file.
4. Inspect AI reasoning, threat assessment, image evidence, routing, official sources, public context, weather, timeline, and alerts.
5. Update complaint status or acknowledge alerts.
6. Monitor emergency broadcasts and incident command rooms.
7. Use map and city health views for operational awareness.
8. Manage user accounts if permissions allow.
9. When marking a complaint resolved, review incoming citizen follow-up evidence before closing high-risk cases.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript, liquid-glass visual assets |
| API | Node.js, Express |
| Database | MongoDB Atlas, Mongoose |
| AI service | Python, Flask |
| Text AI | Sentence Transformers when available, deterministic fallback |
| Vision AI | CLIP via `sentence-transformers/clip-ViT-B-32` when available, feature fallback |
| Voice | Deepgram STT, transcript cleanup through AI service |
| Email | Nodemailer SMTP |
| Weather | Weatherstack current weather API |
| Civic search | Zenserp search API |
| Geocoding | Nominatim |
| Reports | jsPDF in browser |
| Deployment | Render blueprint plus MongoDB Atlas |

## Project Structure

```text
Urban-Pulse-Ai/
|-- ai_service/                 # Flask AI service
|   |-- app.py                  # AI HTTP endpoints
|   |-- pipeline.py             # Main hybrid complaint analysis pipeline
|   |-- decision_engine.py      # Confidence calibration and structured reasoning
|   |-- threat_intelligence.py  # Threat level, relationships, image integrity, duplicates
|   |-- vision_analysis.py      # CLIP vision and feature fallback
|   |-- text_processing.py      # Text classification utilities
|   |-- category_catalog.py     # Shared category loader
|   `-- requirements.txt
|-- public/                     # Browser frontend
|   |-- index.html              # App shell
|   |-- styles.css              # UI, layout, liquid glass styling
|   |-- app.js                  # Dashboard, auth, complaints, reports
|   |-- chatbot.js              # Floating assistant UI
|   |-- audio-transcriber.js    # Optional browser speech fallback helper, not loaded by default
|   |-- videos/                 # About-page video assets
|   `-- vendor/                 # Local visual/vendor assets
|-- scripts/                    # Evaluation, benchmark, seed, SMTP verification
|-- shared/
|   `-- aiCategories.json       # Shared AI category catalog
|-- src/
|   |-- app.js                  # Express app bootstrap
|   |-- server.js               # Server entrypoint
|   |-- config/                 # Environment, DB, roles
|   |-- controllers/            # Route handlers
|   |-- middleware/             # Auth/security middleware
|   |-- models/                 # Mongoose models
|   |-- routes/                 # API routes
|   `-- services/               # AI, threat, routing, email, weather, search, risk, command
|-- stt_service/                # Optional local Whisper/faster-whisper service
|-- dataset/                    # Legacy regression fixtures and real benchmark workspace
|   `-- benchmark/              # Phase 1 schema, collection protocol, manifest, and targets
|-- render.yaml                 # Render deployment blueprint
|-- package.json
`-- README.md
```

## Getting Started

### Prerequisites

- Node.js 18 or newer.
- npm.
- Python 3.11 recommended for the full AI model stack.
- MongoDB Atlas database or local MongoDB connection string.
- SMTP credentials for OTP and email flows.
- Optional API keys for Deepgram, Weatherstack, and Zenserp.

Python 3.11 is recommended because the production AI dependencies are pinned for that runtime. Newer Python versions can still run deterministic fallback paths, but may skip `torch` and `sentence-transformers` packages depending on wheel availability.

### Clone And Install

```bash
git clone <your-repo-url>
cd Urban-Pulse-Ai
npm install
pip install -r ai_service/requirements.txt
```

Optional local STT dependencies:

```bash
pip install -r stt_service/requirements.txt
```

## Environment Variables

Create a `.env` file in the project root.

### Core App

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | `3000` | Express server port |
| `MONGODB_URI` | Yes | `mongodb+srv://...` | MongoDB connection |
| `JWT_SECRET` | Yes | `replace-with-a-strong-secret` | JWT signing secret |
| `CORS_ORIGIN` | Production | `https://your-web.onrender.com` | Allowed frontend origin |
| `ALLOW_ROLE_TOKEN_ISSUE` | No | `false` | Keeps direct role-token issuing disabled |

### AI And Speech

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `AI_SERVICE_URL` | Yes | `http://127.0.0.1:5000` | Flask AI service URL |
| `DEEPGRAM_API_KEY` | Voice feature | `your_key` | Deepgram speech-to-text |
| `DEEPGRAM_MODEL` | No | `nova-3` | Deepgram model name |
| `EMBEDDING_MODEL_NAME` | No | `sentence-transformers/all-MiniLM-L6-v2` | Text embedding model |
| `VISION_MODEL_NAME` | No | `sentence-transformers/clip-ViT-B-32` | Optional CLIP vision model |
| `VISION_CONFIDENCE_THRESHOLD` | No | `0.24` | Visual detection threshold |
| `VISION_MAX_IMAGE_BYTES` | No | `2097152` | AI image payload limit |
| `VISION_IMAGE_WEIGHT` | No | `0.38` | Image influence in fusion |
| `TEXT_CONFIDENCE_THRESHOLD` | No | `0.26` | Text confidence floor |
| `CONTEXT_REPEAT_HIGH` | No | `5` | Repeat-count high threshold |
| `CONTEXT_REPEAT_MEDIUM` | No | `3` | Repeat-count medium threshold |

### Email And OTP

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `SMTP_HOST` | Yes | `smtp.gmail.com` | SMTP host |
| `SMTP_PORT` | Yes | `587` | SMTP port |
| `SMTP_SECURE` | Yes | `false` | `true` for implicit TLS, usually `false` for Gmail 587 |
| `SMTP_FAMILY` | Recommended | `4` | Forces IPv4 for Gmail when IPv6 is unreachable |
| `SMTP_USER` | Yes | `your_email@gmail.com` | SMTP username |
| `SMTP_PASS` | Yes | `app_password` | SMTP app password |
| `SMTP_FROM` | Yes | `your_email@gmail.com` | Sender address |
| `BBMP_EMAIL_TO` | No | `comm@bbmp.gov.in` | Authority email target |

### External Context Providers

| Variable | Required | Example | Purpose |
| --- | --- | --- | --- |
| `WEATHERSTACK_API_KEY` | Optional | `your_key` | Weather context |
| `WEATHERSTACK_BASE_URL` | Optional | `http://api.weatherstack.com` | Weatherstack endpoint |
| `WEATHERSTACK_ENABLED` | Optional | `true` | Enable/disable weather fetches |
| `WEATHERSTACK_MONTHLY_LIMIT` | Optional | `90` | Monthly Weatherstack quota |
| `ZENSERP_API_KEY` | Optional | `your_key` | Civic search context |
| `ZENSERP_BASE_URL` | Optional | `https://app.zenserp.com/api/v2/search` | Zenserp endpoint |
| `ZENSERP_ENABLED` | Optional | `true` | Enable/disable Zenserp |
| `ZENSERP_MONTHLY_LIMIT` | Optional | `48` | Monthly Zenserp quota |

### Example `.env`

```bash
PORT=3000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/urban-pulse
JWT_SECRET=replace-with-a-strong-secret
AI_SERVICE_URL=http://127.0.0.1:5000
CORS_ORIGIN=http://localhost:3000
ALLOW_ROLE_TOKEN_ISSUE=false

DEEPGRAM_API_KEY=your_deepgram_key
DEEPGRAM_MODEL=nova-3

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_FAMILY=4
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=your_email@gmail.com
BBMP_EMAIL_TO=comm@bbmp.gov.in

WEATHERSTACK_API_KEY=your_weatherstack_key
WEATHERSTACK_BASE_URL=http://api.weatherstack.com
WEATHERSTACK_ENABLED=true
WEATHERSTACK_MONTHLY_LIMIT=90

ZENSERP_API_KEY=your_zenserp_key
ZENSERP_BASE_URL=https://app.zenserp.com/api/v2/search
ZENSERP_ENABLED=true
ZENSERP_MONTHLY_LIMIT=48
```

Never commit real `.env` secrets.

## Running Locally

Start the Flask AI service in one terminal:

```bash
npm run start:ai
```

Start the Express app in another terminal:

```bash
npm start
```

Open:

```text
http://localhost:3000
```

Optional seed data:

```bash
npm run seed
```

Fresh seed:

```bash
npm run seed:fresh
```

The first CLIP model run may take longer because the model may need to download or load. If the model cannot load, the AI service still returns deterministic feature-fallback image candidates.

## Scripts

| Command | Description |
| --- | --- |
| `npm start` | Start Express app |
| `npm run start:ai` | Start Flask AI service |
| `npm run start:stt` | Start optional local STT service |
| `npm run seed` | Seed local/demo database data |
| `npm run seed:fresh` | Clear and reseed local/demo data |
| `npm run verify:smtp` | Verify SMTP connection without sending an email |
| `npm run verify:smtp -- --send-test=email@example.com` | Send one test OTP email through registration email path |
| `npm run evaluate:ai` | Run deterministic Node AI evaluation |
| `AI_EVAL_WITH_VISION=true npm run evaluate:ai` | Include optional vision image evaluation |
| `python scripts/evaluateAiService.py` | Run Flask AI decision-engine evaluation |
| `python scripts/evaluateVision.py` | Run optional image evaluation |
| `npm run dataset:validate` | Validate benchmark files, hashes, labels, privacy, and provenance |
| `npm run dataset:stats` | Show accepted records and category/source coverage |
| `npm run dataset:split` | Generate deterministic scene-group-safe train/validation/test splits |
| `npm run verify:dataset` | Test duplicate, privacy, draft quarantine, and leakage gates |
| `npm run evaluate:benchmark:readiness` | Report whether the real benchmark is ready without failing on an empty collection |
| `npm run evaluate:benchmark` | Run release-gated image-only evaluation on the immutable test split |
| `npm run verify:metrics` | Verify formulas, policy gates, readiness behavior, and image-only execution |
| `npm run verify:human-review` | Verify review outcomes, validation, synchronization, and stale-write rejection |

## API Reference

All protected endpoints require a bearer token from login or registration.

### Public/Auth Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/roles` | List available roles and permissions |
| `POST` | `/api/auth/register/request-otp` | Send registration OTP to email |
| `POST` | `/api/auth/register` | Register account with OTP |
| `POST` | `/api/auth/login` | Login with email, password, and role |
| `POST` | `/api/auth/password-reset/request-otp` | Send password reset OTP |
| `POST` | `/api/auth/password-reset` | Reset password with OTP |
| `POST` | `/api/auth/token` | Direct token issue, disabled unless explicitly enabled |

### Complaint And Dashboard Endpoints

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/dashboard` | `submit_complaint` | Load dashboard, complaints, analytics, risk forecast |
| `POST` | `/api/analyze-complaint` | `submit_complaint` | Create complaint and run AI workflow |
| `GET` | `/api/complaints/:id` | `submit_complaint` | Load complaint detail |
| `PATCH` | `/api/complaints/:id/status` | `update_complaint_status` | Update complaint status or priority |
| `POST` | `/api/complaints/:id/human-review` | `update_complaint_status` | Confirm, correct, or request better evidence for an AI decision |
| `POST` | `/api/complaints/:id/alerts/acknowledge` | `manage_alerts` | Acknowledge complaint alert |
| `POST` | `/api/reset-dashboard` | `reset_dashboard` | Clear dashboard operational records |

### Voice, Chat, And Email Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/transcribe-audio` | Transcribe uploaded audio through Deepgram |
| `GET` | `/api/chatbot/history` | Load chatbot conversation state |
| `POST` | `/api/chatbot/message` | Send chatbot message |
| `DELETE` | `/api/chatbot/history` | Clear chatbot history |
| `POST` | `/api/email-bbmp` | Send complaint PDF to configured authority email |
| `POST` | `/api/inform-close-contacts` | Email close contacts about a complaint |
| `GET` | `/api/local-alert-preferences` | Load the signed-in user's local alert areas |
| `PATCH` | `/api/local-alert-preferences` | Save opt-in local alert areas and severity threshold |
| `POST` | `/api/complaints/:id/verification` | Record a citizen verification vote for a complaint |

### AI Service Endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | AI service health and model capability info |
| `POST` | `/analyze` | Hybrid complaint analysis |
| `POST` | `/transcript/process` | Transcript cleanup and summary |
| `POST` | `/chat` | Chatbot intent resolution |

## Data Models

| Model | Purpose |
| --- | --- |
| `User` | Citizen/Admin accounts, role, disabled state, login metadata |
| `RegistrationOtp` | Mongo-backed registration OTP records with TTL |
| `PasswordResetOtp` | Mongo-backed password reset OTP records with TTL |
| `Complaint` | Main complaint record with AI, human review, routing, weather, civic evidence, threat, map, alerts, follow-ups, verification votes, and history |
| `DepartmentUnit` | Configurable department routing unit registry |
| `EmergencyBroadcast` | High-risk broadcast audit and delivery status |
| `IncidentCommand` | Command-room record with SLA, checklist, timeline, assigned unit |
| `IncidentCluster` | Similar complaint cluster with merged report count, confidence, match reason, and linked complaints |
| `ExternalApiUsage` | Monthly quota counters for Weatherstack and Zenserp |
| `ChatSession` | Chatbot messages and pending complaint draft state |

## External API Quotas

Weatherstack and Zenserp are free/limited APIs in this project, so usage is guarded globally per deployed application.

| Provider | Default Limit | Month Key | Behavior When Exhausted |
| --- | --- | --- | --- |
| Weatherstack | `90` attempted external calls/month | UTC `YYYY-MM` | Weather snapshot is stored as unavailable and complaint still submits |
| Zenserp | `48` attempted external calls/month | UTC `YYYY-MM` | Civic evidence is stored as quota-limited and complaint still submits |

The API keys are never sent to the frontend. Provider failure, disabled keys, missing keys, or quota exhaustion should never block complaint submission.

## Professional Validation Program

Further development is organized into eight depth-focused phases. These phases validate and operationalize existing capabilities instead of adding unrelated surface features.

| Phase | Professional implementation | Status |
| --- | --- | --- |
| 1 | Real-World Benchmark Dataset Foundation | Infrastructure complete; ethical data collection and adjudication in progress |
| 2 | Independent AI Metrics And Error Analysis | Infrastructure complete; awaiting adjudicated Phase 1 test records |
| 3 | Human Review And Correction Interface | Complete |
| 4 | Prediction-Correction Audit Store | Planned |
| 5 | AI Observability And Drift Dashboard | Planned |
| 6 | Baseline And Model Benchmarking | Planned |
| 7 | Authority Ticket Integration Adapter | Planned |
| 8 | Usability, Accessibility, Load, And Resilience Validation | Planned |

### Phase 1: Benchmark Dataset Foundation

Phase 1 introduces `dataset/benchmark` as the only location intended for defensible real-world evaluation. The existing `dataset/dataset.json` remains a legacy regression fixture and must not be described as an independent accuracy benchmark because it contains transformed variants of a small number of source images.

The Phase 1 implementation provides:

- A versioned manifest and machine-readable JSON Schema.
- Canonical category validation against `shared/aiCategories.json`.
- A `general` negative class for images with no supported visible incident.
- SHA-256 integrity and exact-duplicate rejection.
- Scene-group isolation to keep crops or edits of one source out of different splits.
- Provenance, licence, permission, broad-location, and independent privacy-review gates.
- Two-annotator adjudication requirements and an evidence-based severity rubric.
- Deterministic category-stratified train, validation, and test generation.
- Machine-readable collection targets and automated positive/negative workflow tests.

See [the annotation and collection guide](dataset/benchmark/ANNOTATION_GUIDE.md) before adding records. Software infrastructure being complete does not mean that a real dataset has already been collected; benchmark claims become valid only after licensed, independently adjudicated records meet the release targets.

### Phase 2: Independent Metrics And Error Analysis

Phase 2 adds a leak-free image-only evaluator tied to immutable manifest and split hashes. It reports per-class precision, recall, F1, confusion matrix, top-k accuracy, coverage, selective accuracy, abstention behavior, negative recall, Critical recall, false-Critical escalation, dangerous under-triage, severity error, confidence calibration, Wilson intervals, runtime fallback usage, and latency. A versioned evaluation policy turns academic quality targets into explicit pass/fail gates.

The evaluator currently returns `not_ready` because Phase 1 contains no adjudicated real-world records. Controlled fixtures verify the formulas and execution path but are not reported as model accuracy. See [the Phase 2 evaluation guide](dataset/benchmark/EVALUATION_GUIDE.md).

### Phase 3: Human Review And Correction

Phase 3 adds an Admin-only review form inside each complaint case file. Reviewers can confirm the AI decision, apply a justified category/severity/department correction, or request better evidence. Corrections synchronize operational complaint and routing fields while retaining the original machine decision, explanation, candidates, confidence, and threat evidence. Mandatory reasoning and document-version checks prevent unaccountable or stale edits.

Phase 3 intentionally stores only the original and latest reviewed state. The append-only event history and correction dataset belong to Phase 4. See [the Phase 3 human-review specification](docs/PHASE_3_HUMAN_REVIEW.md).

## Evaluation And Testing

Run the full local checks before production deployment:

```bash
node -e "require('./src/app'); console.log('app-load ok')"
npm run evaluate:ai
npm run verify:resolution
npm run verify:civic-intelligence
npm run verify:dataset
npm run dataset:validate
npm run verify:metrics
npm run verify:human-review
npm run evaluate:benchmark:readiness
python3 scripts/evaluateAiService.py
python3 -m compileall ai_service stt_service scripts
```

Optional JavaScript syntax sweep:

```bash
node --check src/app.js
node --check public/app.js
```

Recommended evaluator scenarios:

| Scenario | Expected Result |
| --- | --- |
| Register with email OTP | OTP email sent, account created after correct OTP |
| Forgot password | OTP sent only to registered email, reset success message shown |
| Image-only fallen tree | AI guesses tree/obstruction from image evidence |
| Fallen tree plus live wire text | Threat becomes Critical, routing escalates, broadcast/incident can trigger |
| Drainage complaint in rainy weather | Weather note appears in complaint detail and PDF |
| High-risk complaint | Incident command room, SLA, checklist, and dashboard count appear |
| Complaint detail | Shows AI decision, threat evidence, routing, official sources, public context, weather, alerts, timeline |
| PDF export | Includes complaint narrative, image, map link, AI assessment, threat evidence, weather, sources |

## Deployment

The recommended production layout uses two Render services plus MongoDB Atlas.

| Service | Runtime | Responsibility |
| --- | --- | --- |
| Main app | Node.js | Express API, frontend, auth, complaints, email, routing, dashboards |
| AI service | Python | Flask AI endpoints, text/vision/threat analysis |
| Database | MongoDB Atlas | Persistent users, complaints, OTPs, API usage, broadcasts, incidents |

Use [render.yaml](render.yaml) as the deployment starting point. Configure production secrets in the Render dashboard, not in Git.

### Render Environment Checklist

For the main web service:

```bash
AI_SERVICE_URL=https://your-ai-service.onrender.com
ALLOW_ROLE_TOKEN_ISSUE=false
BBMP_EMAIL_TO=comm@bbmp.gov.in
CORS_ORIGIN=https://your-web-service.onrender.com
DEEPGRAM_API_KEY=your_key
DEEPGRAM_MODEL=nova-3
JWT_SECRET=strong_secret
MONGODB_URI=your_mongodb_uri
SMTP_FAMILY=4
SMTP_FROM=your_email@gmail.com
SMTP_HOST=smtp.gmail.com
SMTP_PASS=your_app_password
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
WEATHERSTACK_API_KEY=your_key
WEATHERSTACK_BASE_URL=http://api.weatherstack.com
WEATHERSTACK_ENABLED=true
WEATHERSTACK_MONTHLY_LIMIT=90
ZENSERP_API_KEY=your_key
ZENSERP_BASE_URL=https://app.zenserp.com/api/v2/search
ZENSERP_ENABLED=true
ZENSERP_MONTHLY_LIMIT=48
```

For the AI service:

```bash
PYTHON_VERSION=3.11.11
EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
VISION_MODEL_NAME=sentence-transformers/clip-ViT-B-32
VISION_CONFIDENCE_THRESHOLD=0.24
VISION_MAX_IMAGE_BYTES=2097152
```

## Production Checklist

Before pushing live:

- Use a strong `JWT_SECRET`.
- Confirm `ALLOW_ROLE_TOKEN_ISSUE=false`.
- Verify MongoDB Atlas IP/network access.
- Run `npm run verify:smtp`.
- Send one SMTP test email with `npm run verify:smtp -- --send-test=email@example.com`.
- Confirm `SMTP_FAMILY=4` if Gmail IPv6 fails with `ENETUNREACH`.
- Confirm `CORS_ORIGIN` matches the production frontend URL exactly.
- Confirm `AI_SERVICE_URL` points to the deployed Flask service.
- Run `npm run evaluate:ai`, `npm run verify:dataset`, and `python3 scripts/evaluateAiService.py`.
- Submit a high-risk test complaint and verify routing, broadcast, incident command, and PDF.
- Confirm Weatherstack and Zenserp quota behavior with limited/free keys.
- Replace fallback department unit metadata with real authority contacts when available.
- Remove or rotate any seed/demo credentials before final deployment.

## Troubleshooting

### OTP Email Not Received

Check:

- `SMTP_HOST=smtp.gmail.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=false`
- `SMTP_FAMILY=4`
- `SMTP_USER` matches the Gmail account.
- `SMTP_PASS` is a Gmail App Password, not the normal Gmail password.
- Render environment variables do not include extra quotes or hidden newline characters.

Run:

```bash
npm run verify:smtp
npm run verify:smtp -- --send-test=your_email@example.com
```

### Gmail `ENETUNREACH` Or `ESOCKET`

Use IPv4:

```bash
SMTP_FAMILY=4
```

This prevents Node/Nodemailer from trying an unreachable IPv6 Gmail SMTP address.

### AI Service Is Down

Complaint creation still works through the Express deterministic fallback. Check:

```bash
curl https://your-ai-service.onrender.com/health
```

Then confirm `AI_SERVICE_URL` in the main service.

### CLIP Model Is Slow Or Unavailable

The first CLIP load can be slow. If `sentence-transformers` or `torch` cannot load, the AI service falls back to deterministic image features. This is expected and should not block complaint submission.

### Weather Or Zenserp Is Unavailable

The system stores provider status as unavailable or quota-limited and continues complaint submission. Check monthly quota counters in `ExternalApiUsage`.

### Dashboard Reset Still Shows Old Operational Data

The reset endpoint clears complaints, incident command records, and emergency broadcast records together. If old records remain in production, confirm the latest backend is deployed.

## Security Notes

- API keys and SMTP credentials must stay server-side.
- JWT secret must be unique and strong in production.
- Production startup refuses the local demo JWT secret when `NODE_ENV=production`.
- OTPs are hashed before storage and expire after 5 minutes.
- Password reset responses do not reveal whether an email is registered.
- Complaint image payloads are size-limited and MIME-validated before AI analysis.
- Complaint text, location, voice transcript, and audio uploads are length/size-limited server-side.
- Authority and close-contact email endpoints verify complaint ownership before sending.
- User-management actions preserve at least one active admin account.
- Password resets, role changes, account disabling, and account deletion invalidate stale registered-user sessions.
- Nearby community-proof feeds expose only sanitized incident summaries, not reporter identities, descriptions, or evidence.
- Local area email alerts are opt-in and use saved area names instead of continuous background tracking.
- External provider failures do not expose API keys to the frontend, PDFs, stored complaints, or logs.

## Roadmap

Strong future directions:

- Real authority contact registry for wards, departments, escalation emails, and portals.
- Twilio or local SMS provider integration for emergency broadcasts.
- Push notifications for nearby users.
- Admin-configurable department routing rules.
- Human-in-the-loop AI correction feedback to improve future classifications.
- Advanced vector/perceptual-hash clustering for larger production datasets.
- Geo-fenced incident broadcasts based on real coordinates.
- Public status page for selected resolved complaints.
- CI workflow for syntax checks and AI regression tests.
- Docker Compose setup for local development.

### Local Alert Intelligence

The current local-alert system is intentionally privacy-safe: users manually opt in to saved area names, and the platform emails them only when a serious matching complaint triggers a broadcast. AI area understanding now turns messy complaint locations into structured signals such as likely area, landmark hints, ward hints, normalized location text, and matching terms. These signals improve local alert matching without continuous background tracking.

| Extension | What It Adds | Why It Matters |
| --- | --- | --- |
| Radius-based saved areas | Let users save an area with an approximate radius, such as 2 km around Whitefield | More accurate than plain text matching while staying opt-in |
| Category preferences | Users choose alert categories like road safety, water/sewage, electricity, garbage, security, or tree obstruction | Reduces irrelevant emails |
| Alert digest mode | Send daily or weekly summaries for Medium/High issues while keeping Critical alerts immediate | Prevents notification fatigue |
| AI urgency gate | AI decides whether nearby users should be notified based on severity, confidence, weather, and threat assessment | Avoids sending alerts for low-risk complaints |
| Alert history dashboard | Show which complaint triggered local alerts, matched areas, recipient count, and email delivery status | Gives admins auditability |
| Unsubscribe controls | Add a one-click disable link or clear preference-management action in every local alert email | Improves trust and production readiness |

### Major Extension Ideas

| Extension | Description |
| --- | --- |
| Authority response portal | Give department users their own portal to update assigned complaints, add response notes, and upload resolution proof |
| Resolution proof system | Require resolver note, after-photo, timestamp, and optional citizen confirmation before marking sensitive complaints resolved |
| Public civic transparency page | Show selected resolved complaints, current public alerts, and area-wise civic trends without login |
| AI feedback learning loop | Allow admins to correct category, severity, routing, and threat decisions, then use those corrections in future evaluation datasets |
| SLA escalation engine | Track response deadlines by issue type and department, then escalate overdue cases automatically |
| Complaint conversation thread | Give every complaint a citizen-admin follow-up thread with AI summaries of updates |
| Ward intelligence profile | Build a profile for each ward with repeated issue types, risk trends, department load, and monthly improvement score |

## Contributing

Contributions are welcome. A good contribution should keep the project practical, explainable, and safe for civic workflows.

Suggested workflow:

1. Create a feature branch.
2. Keep secrets out of commits.
3. Run syntax and AI evaluation checks.
4. Add or update README notes when behavior changes.
5. Open a pull request with a clear summary and test notes.

Recommended checks before a pull request:

```bash
node -e "require('./src/app'); console.log('app-load ok')"
npm run evaluate:ai
python scripts/evaluateAiService.py
python -m compileall ai_service stt_service scripts
```

## License

This project is released under the MIT License. If you use it for a civic deployment, review local data protection, email, emergency notification, and public authority integration requirements before going live.
