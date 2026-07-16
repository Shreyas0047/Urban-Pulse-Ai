from PIL import ImageFilter, ImageStat


def assess_image_quality(image):
    grayscale = image.convert("L")
    try:
        stats = ImageStat.Stat(grayscale)
        brightness = stats.mean[0]
        contrast = stats.stddev[0]
        edge_stats = ImageStat.Stat(grayscale.filter(ImageFilter.FIND_EDGES))
        edge_strength = edge_stats.mean[0]
    finally:
        grayscale.close()

    limitations = []
    status = "usable"
    if brightness < 35:
        status = "dark"
        limitations.append("The scene is very dark.")
    elif brightness > 230:
        status = "overexposed"
        limitations.append("The scene is heavily overexposed.")
    elif contrast < 12 or edge_strength < 4:
        status = "blurry"
        limitations.append("Fine visual detail is limited.")
    if min(image.size) < 240 and status == "usable":
        status = "limited"
        limitations.append("The image resolution is low.")
    return {"status": status, "limitations": limitations}
