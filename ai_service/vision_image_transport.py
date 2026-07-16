import io


def prepare_jpeg(image, max_dimension, quality, max_bytes):
    """Strip metadata and constrain an image before sending it to a provider."""
    prepared = image.copy()
    try:
        prepared.thumbnail((max_dimension, max_dimension))
        if prepared.mode != "RGB":
            converted = prepared.convert("RGB")
            prepared.close()
            prepared = converted
        for candidate_quality in (quality, max(55, quality - 14), 48):
            buffer = io.BytesIO()
            prepared.save(buffer, format="JPEG", quality=candidate_quality, optimize=True)
            encoded = buffer.getvalue()
            if len(encoded) <= max_bytes:
                return encoded
        raise ValueError("Prepared image exceeds the provider transmission limit")
    finally:
        prepared.close()
