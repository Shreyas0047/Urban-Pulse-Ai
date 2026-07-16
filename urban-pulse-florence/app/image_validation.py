import io

from PIL import Image, ImageFile, ImageOps

from app.config import MAX_IMAGE_BYTES, MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS

Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
ImageFile.LOAD_TRUNCATED_IMAGES = False
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}


def decode_image(payload):
    if not payload or len(payload) > MAX_IMAGE_BYTES:
        raise ValueError("Image is empty or exceeds the upload limit")
    try:
        with Image.open(io.BytesIO(payload)) as source:
            source.verify()
        with Image.open(io.BytesIO(payload)) as source:
            if source.format not in ALLOWED_FORMATS:
                raise ValueError("Unsupported image format")
            image = ImageOps.exif_transpose(source).convert("RGB")
    except (OSError, Image.DecompressionBombError) as error:
        raise ValueError("Image could not be decoded safely") from error
    if image.width * image.height > MAX_IMAGE_PIXELS:
        image.close()
        raise ValueError("Image dimensions exceed the safe pixel limit")
    image.thumbnail((MAX_IMAGE_DIMENSION, MAX_IMAGE_DIMENSION))
    return image
