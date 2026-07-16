import logging
import threading
import time

from app.config import MAX_NEW_TOKENS, MODEL_DISPLAY_NAME, MODEL_NAME, MODEL_REVISION, NUM_BEAMS

LOGGER = logging.getLogger("urban_pulse.florence")
CAPTION_TASK = "<MORE_DETAILED_CAPTION>"


class FlorenceRuntime:
    def __init__(self):
        self._load_lock = threading.Lock()
        self._inference_lock = threading.Lock()
        self._processor = None
        self._model = None
        self._status = "not_loaded"
        self._last_error = ""

    def load(self):
        if self._model is not None and self._processor is not None:
            return
        with self._load_lock:
            if self._model is not None and self._processor is not None:
                return
            self._status = "loading"
            try:
                import torch
                from transformers import AutoModelForCausalLM, AutoProcessor

                revision = None if MODEL_NAME.startswith("/") else MODEL_REVISION
                self._processor = AutoProcessor.from_pretrained(
                    MODEL_NAME,
                    revision=revision,
                    trust_remote_code=True,
                    local_files_only=MODEL_NAME.startswith("/"),
                )
                self._model = AutoModelForCausalLM.from_pretrained(
                    MODEL_NAME,
                    revision=revision,
                    trust_remote_code=True,
                    local_files_only=MODEL_NAME.startswith("/"),
                    torch_dtype=torch.float32,
                    low_cpu_mem_usage=True,
                    use_safetensors=True,
                ).to("cpu").eval()
                self._status = "ready"
                self._last_error = ""
                LOGGER.info("Florence model loaded")
            except Exception as error:
                self._processor = None
                self._model = None
                self._status = "failed"
                self._last_error = type(error).__name__
                LOGGER.exception("Florence model load failed")
                raise

    def analyze(self, image):
        self.load()
        started = time.monotonic()
        with self._inference_lock:
            import torch

            inputs = self._processor(text=CAPTION_TASK, images=image, return_tensors="pt")
            with torch.inference_mode():
                generated_ids = self._model.generate(
                    input_ids=inputs["input_ids"],
                    pixel_values=inputs["pixel_values"],
                    max_new_tokens=MAX_NEW_TOKENS,
                    num_beams=NUM_BEAMS,
                    do_sample=False,
                )
            generated_text = self._processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
            parsed = self._processor.post_process_generation(
                generated_text,
                task=CAPTION_TASK,
                image_size=(image.width, image.height),
            )
            caption = parsed.get(CAPTION_TASK, "") if isinstance(parsed, dict) else str(parsed)
            del inputs
            del generated_ids
        return caption, int((time.monotonic() - started) * 1000)

    def status_payload(self):
        return {
            "status": self._status,
            "ready": self._model is not None and self._processor is not None,
            "model": MODEL_DISPLAY_NAME,
            "lastError": self._last_error,
        }


florence_runtime = FlorenceRuntime()
