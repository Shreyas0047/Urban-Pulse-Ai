# Urban Pulse Florence Vision Service

Independent Florence-2 visual-perception service for Urban Pulse AI. It accepts a sanitized incident image and returns structured observations. It does **not** receive user identity or complaint context and cannot decide category, severity, ward, department, routing, acceptance, or escalation.

## API contract

- `GET /health`: process and model-load status.
- `GET /ready`: `200` only after Florence is loaded; otherwise `503`.
- `POST /v1/analyze`: multipart upload with the `image` field.
- Authentication: `X-Urban-Pulse-Vision-Token` must match `FLORENCE_SERVICE_TOKEN`.
- Response schema: version `1.0`, containing scene description, visible issues and evidence, hazards, infrastructure damage, environmental conditions, image quality, uncertainty, and human-review recommendation.

The service never logs image bytes, authentication tokens, or user information.

## Local verification

```bash
python -m venv .venv
source .venv/bin/activate
pip install --extra-index-url https://download.pytorch.org/whl/cpu torch==2.4.1+cpu torchvision==0.19.1+cpu
pip install -r requirements-test.txt
FLORENCE_WARMUP=false FLORENCE_SERVICE_TOKEN=test-service-token python -m unittest discover -s tests -v
docker build -t urban-pulse-florence .
docker run --rm -p 8080:8080 -e FLORENCE_SERVICE_TOKEN="$(openssl rand -hex 32)" urban-pulse-florence
```

## Google Cloud Run deployment

The initial production profile is deliberately single-concurrency because model inference is memory intensive:

- Region: `asia-south1`
- CPU: `2`
- Memory: `4Gi`
- Concurrency: `1`
- Request timeout: `120s`
- Minimum instances: `0`
- Maximum instances: `2`

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com
gcloud artifacts repositories create urban-pulse --repository-format=docker --location=asia-south1
gcloud builds submit --tag asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/urban-pulse/florence-vision:prod
gcloud run deploy urban-pulse-florence \
  --image asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/urban-pulse/florence-vision:prod \
  --region asia-south1 \
  --platform managed \
  --cpu 2 \
  --memory 4Gi \
  --concurrency 1 \
  --timeout 120 \
  --min-instances 0 \
  --max-instances 2 \
  --allow-unauthenticated \
  --set-env-vars FLORENCE_SERVICE_TOKEN=REPLACE_WITH_THE_SAME_LONG_RANDOM_SECRET,FLORENCE_WARMUP=true,REQUIRE_SERVICE_TOKEN=true
```

`--allow-unauthenticated` makes the HTTPS route reachable from Render, but `/v1/analyze` remains protected by the application token. Keep the token in Cloud Run and Render environment variables only. Health endpoints contain no secret or image data.

After deployment, verify:

```bash
curl -s https://YOUR_CLOUD_RUN_URL/health
curl -s https://YOUR_CLOUD_RUN_URL/ready
curl -s -X POST https://YOUR_CLOUD_RUN_URL/v1/analyze \
  -H "X-Urban-Pulse-Vision-Token: YOUR_SECRET" \
  -F "image=@test-incident.jpg"
```

Do not connect Render until `/ready` returns `200` and the authenticated smoke test returns `schemaVersion: "1.0"`.
