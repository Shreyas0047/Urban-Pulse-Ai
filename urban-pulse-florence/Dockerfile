FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8080 \
    HF_HOME=/models/cache \
    TRANSFORMERS_OFFLINE=1 \
    HF_HUB_OFFLINE=1

RUN addgroup --system app && adduser --system --ingroup app app \
    && mkdir -p /service /models/florence /models/cache \
    && chown -R app:app /service /models

WORKDIR /service
COPY requirements.txt ./
RUN pip install --extra-index-url https://download.pytorch.org/whl/cpu torch==2.4.1+cpu torchvision==0.19.1+cpu \
    && pip install -r requirements.txt

COPY scripts/download_model.py /tmp/download_model.py
ARG FLORENCE_MODEL_REVISION=58c9f97c2a8448696851e2cc95eb1b6919493fe4
RUN TRANSFORMERS_OFFLINE=0 HF_HUB_OFFLINE=0 FLORENCE_MODEL_REVISION=${FLORENCE_MODEL_REVISION} python /tmp/download_model.py \
    && rm /tmp/download_model.py \
    && chown -R app:app /models

COPY --chown=app:app app ./app
USER app

CMD ["sh", "-c", "exec gunicorn --bind 0.0.0.0:${PORT} --workers 1 --threads 2 --timeout 180 --graceful-timeout 30 app.main:app"]
