import os

from huggingface_hub import snapshot_download

snapshot_download(
    repo_id=os.getenv("FLORENCE_REPO_ID", "microsoft/Florence-2-base-ft"),
    revision=os.getenv("FLORENCE_MODEL_REVISION", "58c9f97c2a8448696851e2cc95eb1b6919493fe4"),
    local_dir=os.getenv("FLORENCE_MODEL_DIR", "/models/florence"),
)
