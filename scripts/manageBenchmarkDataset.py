#!/usr/bin/env python3
"""Validate, summarize, import, and split the Phase 1 civic benchmark dataset."""

import argparse
import hashlib
import json
import mimetypes
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
BENCHMARK_DIR = ROOT / "dataset" / "benchmark"
DEFAULT_MANIFEST = BENCHMARK_DIR / "manifest.json"
CATEGORY_PATH = ROOT / "shared" / "aiCategories.json"
ALLOWED_SCHEMA_VERSION = "1.0.0"
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_SEVERITIES = {"Low", "Medium", "High", "Critical", "Needs Review"}
ALLOWED_STATUSES = {"draft", "double_annotated", "adjudicated", "rejected"}
ACCEPTED_STATUS = "adjudicated"
NO_INCIDENT_CATEGORY = "general"


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def write_json(path, value):
    Path(path).write_text(json.dumps(value, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")


def sha256_file(path):
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_categories():
    return {item["id"] for item in load_json(CATEGORY_PATH)}


def text(value):
    return str(value or "").strip()


def validate_timestamp(value):
    try:
        datetime.fromisoformat(text(value).replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def validate_manifest(manifest_path, strict=False):
    manifest_path = Path(manifest_path).resolve()
    benchmark_dir = manifest_path.parent
    errors = []
    warnings = []
    try:
        manifest = load_json(manifest_path)
    except (OSError, json.JSONDecodeError) as error:
        return None, [f"Manifest could not be read: {error}"], []

    if manifest.get("schemaVersion") != ALLOWED_SCHEMA_VERSION:
        errors.append(f"schemaVersion must be {ALLOWED_SCHEMA_VERSION}.")
    if not text(manifest.get("datasetVersion")):
        errors.append("datasetVersion is required.")
    if not validate_timestamp(manifest.get("createdAt")):
        errors.append("createdAt must be an ISO-8601 timestamp.")
    records = manifest.get("records")
    if not isinstance(records, list):
        return manifest, errors + ["records must be a list."], warnings
    if strict and not records:
        errors.append("Strict validation requires at least one benchmark record.")

    categories = canonical_categories()
    ids = set()
    paths = set()
    hashes = defaultdict(list)
    for index, record in enumerate(records):
        prefix = f"records[{index}]"
        if not isinstance(record, dict):
            errors.append(f"{prefix} must be an object.")
            continue

        record_id = text(record.get("id"))
        if not record_id.startswith("UPB-"):
            errors.append(f"{prefix}.id must start with UPB-.")
        if record_id in ids:
            errors.append(f"Duplicate record id: {record_id}.")
        ids.add(record_id)

        media = record.get("media") or {}
        relative_path = text(media.get("path"))
        if not relative_path.startswith("images/") or Path(relative_path).is_absolute() or ".." in Path(relative_path).parts:
            errors.append(f"{prefix}.media.path must remain inside images/.")
        if relative_path in paths:
            errors.append(f"Duplicate media path: {relative_path}.")
        paths.add(relative_path)
        image_path = (benchmark_dir / relative_path).resolve()
        if benchmark_dir not in image_path.parents:
            errors.append(f"{prefix}.media.path escapes the benchmark directory.")
        elif not image_path.is_file():
            errors.append(f"Missing image for {record_id}: {relative_path}.")
        else:
            actual_hash = sha256_file(image_path)
            expected_hash = text(media.get("sha256")).lower()
            if actual_hash != expected_hash:
                errors.append(f"SHA-256 mismatch for {record_id}.")
            hashes[actual_hash].append(record_id)
        if media.get("mimeType") not in ALLOWED_MIME_TYPES:
            errors.append(f"{prefix}.media.mimeType is unsupported.")
        if len(text(media.get("groupId"))) < 3:
            errors.append(f"{prefix}.media.groupId is required for leakage-safe splitting.")

        provenance = record.get("provenance") or {}
        if not text(provenance.get("sourceReference")) or not text(provenance.get("license")):
            errors.append(f"{prefix}.provenance requires sourceReference and license.")
        annotation = record.get("annotation") or {}
        status = annotation.get("status")
        accepted = status == ACCEPTED_STATUS
        if provenance.get("permissionConfirmed") is not True:
            message = f"{prefix}.provenance.permissionConfirmed must be true before benchmark acceptance."
            (errors if accepted else warnings).append(message)

        location = record.get("location") or {}
        if text(location.get("city")).lower() not in {"bengaluru", "bangalore"}:
            warnings.append(f"{record_id}: city is outside the declared Bengaluru benchmark scope.")
        if not text(location.get("area")):
            errors.append(f"{prefix}.location.area is required.")
        if location.get("precision") not in {"area_only", "ward_only", "city_only"}:
            errors.append(f"{prefix}.location.precision must not expose an exact address.")

        privacy = record.get("privacy") or {}
        if privacy.get("piiReviewed") is not True or not text(privacy.get("reviewer")):
            message = f"{prefix}.privacy requires a completed independent review before benchmark acceptance."
            (errors if accepted else warnings).append(message)
        for field in ("faces", "vehiclePlates", "privatePropertyIdentifiers"):
            if privacy.get(field) not in {"none", "redacted"}:
                errors.append(f"{prefix}.privacy.{field} must be none or redacted.")

        labels = record.get("labels") or {}
        category_id = text(labels.get("categoryId"))
        incident_present = labels.get("incidentPresent")
        valid_negative = incident_present is False and category_id == NO_INCIDENT_CATEGORY
        if category_id not in categories and not valid_negative:
            errors.append(f"{prefix}.labels.categoryId is not in shared/aiCategories.json: {category_id}.")
        if incident_present is True and category_id == NO_INCIDENT_CATEGORY:
            errors.append(f"{prefix}.labels.categoryId cannot be general when an incident is present.")
        if incident_present is False and category_id != NO_INCIDENT_CATEGORY:
            errors.append(f"{prefix}.labels.categoryId must be general when no incident is present.")
        secondary = labels.get("secondaryCategoryIds") or []
        invalid_secondary = [item for item in secondary if item not in categories or item == category_id]
        if invalid_secondary:
            errors.append(f"{prefix}.labels.secondaryCategoryIds contains invalid values: {invalid_secondary}.")
        if labels.get("severity") not in ALLOWED_SEVERITIES:
            errors.append(f"{prefix}.labels.severity is invalid.")
        if not isinstance(incident_present, bool):
            errors.append(f"{prefix}.labels.incidentPresent must be boolean.")
        if not isinstance(labels.get("hazards"), list) or not isinstance(labels.get("sensitiveContext"), list):
            errors.append(f"{prefix}.labels hazards and sensitiveContext must be lists.")

        annotators = annotation.get("annotators") or []
        if status not in ALLOWED_STATUSES:
            errors.append(f"{prefix}.annotation.status is invalid.")
        if status == ACCEPTED_STATUS:
            if len(set(annotators)) < 2:
                errors.append(f"{record_id}: adjudicated records require at least two independent annotators.")
            if not text(annotation.get("adjudicator")):
                errors.append(f"{record_id}: adjudicated records require an adjudicator.")
            agreement = annotation.get("agreement")
            if not isinstance(agreement, (int, float)) or not 0 <= agreement <= 1:
                errors.append(f"{record_id}: adjudicated records require agreement between 0 and 1.")
        if not validate_timestamp(annotation.get("annotatedAt")):
            errors.append(f"{prefix}.annotation.annotatedAt must be ISO-8601.")

    for digest, record_ids in hashes.items():
        if len(record_ids) > 1:
            errors.append(f"Exact duplicate image hash {digest[:12]} is used by: {', '.join(record_ids)}.")

    return manifest, errors, warnings


def deterministic_order(values, seed):
    return sorted(values, key=lambda value: hashlib.sha256(f"{seed}:{value}".encode("utf-8")).hexdigest())


def split_counts(size):
    if size < 3:
        return size, 0, 0
    test = max(1, round(size * 0.15))
    validation = max(1, round(size * 0.15))
    train = size - validation - test
    if train < 1:
        train, validation, test = 1, max(0, size - 2), 1
    return train, validation, test


def generate_splits(manifest, manifest_path, output_path, seed):
    accepted = [record for record in manifest["records"] if record.get("annotation", {}).get("status") == ACCEPTED_STATUS]
    grouped = defaultdict(list)
    for record in accepted:
        grouped[text(record["media"]["groupId"])].append(record)

    category_groups = defaultdict(list)
    for group_id, records in grouped.items():
        category_groups[records[0]["labels"]["categoryId"]].append(group_id)

    assignments = {}
    for category_id, group_ids in sorted(category_groups.items()):
        ordered = deterministic_order(group_ids, f"{seed}:{category_id}")
        train_count, validation_count, _test_count = split_counts(len(ordered))
        for group_id in ordered[:train_count]:
            assignments[group_id] = "train"
        for group_id in ordered[train_count:train_count + validation_count]:
            assignments[group_id] = "validation"
        for group_id in ordered[train_count + validation_count:]:
            assignments[group_id] = "test"

    splits = {"train": [], "validation": [], "test": []}
    for group_id, records in grouped.items():
        split_name = assignments[group_id]
        splits[split_name].extend(record["id"] for record in records)
    for name in splits:
        splits[name].sort()

    manifest_hash = hashlib.sha256(Path(manifest_path).read_bytes()).hexdigest()
    result = {
        "schemaVersion": "1.0.0",
        "datasetVersion": manifest["datasetVersion"],
        "manifestSha256": manifest_hash,
        "seed": seed,
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "policy": "category-stratified group split; all derivatives from one scene remain in one split",
        "splits": splits,
        "counts": {name: len(record_ids) for name, record_ids in splits.items()},
    }
    write_json(output_path, result)
    return result


def dataset_stats(manifest):
    records = manifest.get("records") or []
    accepted = [record for record in records if record.get("annotation", {}).get("status") == ACCEPTED_STATUS]
    return {
        "datasetVersion": manifest.get("datasetVersion"),
        "records": len(records),
        "acceptedForBenchmark": len(accepted),
        "annotationStatus": dict(sorted(Counter(record.get("annotation", {}).get("status", "missing") for record in records).items())),
        "categories": dict(sorted(Counter(record.get("labels", {}).get("categoryId", "missing") for record in accepted).items())),
        "severity": dict(sorted(Counter(record.get("labels", {}).get("severity", "missing") for record in accepted).items())),
        "sourceTypes": dict(sorted(Counter(record.get("provenance", {}).get("sourceType", "missing") for record in records).items())),
        "uniqueSceneGroups": len({record.get("media", {}).get("groupId") for record in accepted}),
    }


def import_image(args):
    manifest_path = Path(args.manifest).resolve()
    manifest = load_json(manifest_path)
    source = Path(args.image).resolve()
    if not source.is_file():
        raise ValueError(f"Image does not exist: {source}")
    mime_type = mimetypes.guess_type(source.name)[0]
    if mime_type not in ALLOWED_MIME_TYPES:
        raise ValueError("Only JPEG, PNG, and WebP images are accepted.")
    if any(record.get("id") == args.id for record in manifest.get("records", [])):
        raise ValueError(f"Record id already exists: {args.id}")

    suffix = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}[mime_type]
    relative_path = Path("images") / f"{args.id}{suffix}"
    destination = manifest_path.parent / relative_path
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        raise ValueError(f"Destination already exists: {destination}")
    shutil.copy2(source, destination)
    digest = sha256_file(destination)
    duplicate = next((record for record in manifest.get("records", []) if record.get("media", {}).get("sha256") == digest), None)
    if duplicate:
        destination.unlink()
        raise ValueError(f"Exact duplicate of existing record {duplicate.get('id')}.")

    record = {
        "id": args.id,
        "media": {"path": relative_path.as_posix(), "sha256": digest, "mimeType": mime_type, "groupId": args.group_id, "capturedAt": None},
        "provenance": {"sourceType": args.source_type, "sourceReference": args.source_reference, "license": args.license, "permissionConfirmed": False},
        "location": {"city": "Bengaluru", "area": args.area, "precision": "area_only"},
        "privacy": {"piiReviewed": False, "faces": "none", "vehiclePlates": "none", "privatePropertyIdentifiers": "none", "reviewer": ""},
        "labels": {"categoryId": args.category, "secondaryCategoryIds": [], "severity": "Needs Review", "incidentPresent": True, "hazards": [], "sensitiveContext": [], "visibleEvidence": ""},
        "annotation": {"status": "draft", "annotators": [], "agreement": None, "adjudicator": None, "annotatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"), "notes": "Complete privacy and independent annotation review."},
    }
    manifest["records"].append(record)
    write_json(manifest_path, manifest)
    print(json.dumps({"imported": args.id, "path": relative_path.as_posix(), "sha256": digest, "status": "draft"}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="Path to the benchmark manifest.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate_parser = subparsers.add_parser("validate", help="Validate structure, files, labels, provenance, privacy, and hashes.")
    validate_parser.add_argument("--strict", action="store_true", help="Require at least one record.")
    subparsers.add_parser("stats", help="Print benchmark collection statistics.")
    split_parser = subparsers.add_parser("split", help="Generate deterministic leakage-safe splits from adjudicated records.")
    split_parser.add_argument("--seed", default="urban-pulse-benchmark-v1")
    split_parser.add_argument("--output", default=str(BENCHMARK_DIR / "splits.json"))

    import_parser = subparsers.add_parser("import", help="Copy one image into the benchmark and create a draft record.")
    import_parser.add_argument("--image", required=True)
    import_parser.add_argument("--id", required=True)
    import_parser.add_argument("--group-id", required=True)
    import_parser.add_argument("--category", required=True, choices=sorted(canonical_categories() | {NO_INCIDENT_CATEGORY}))
    import_parser.add_argument("--area", required=True)
    import_parser.add_argument("--source-type", required=True, choices=["field_capture", "open_data", "licensed_contribution", "authority_archive"])
    import_parser.add_argument("--source-reference", required=True)
    import_parser.add_argument("--license", required=True)

    args = parser.parse_args()
    if args.command == "import":
        try:
            import_image(args)
        except (OSError, ValueError, json.JSONDecodeError) as error:
            print(f"Import failed: {error}", file=sys.stderr)
            return 1
        return 0

    manifest, errors, warnings = validate_manifest(args.manifest, strict=getattr(args, "strict", False))
    report = {"valid": not errors, "errors": errors, "warnings": warnings, "stats": dataset_stats(manifest or {})}
    if args.command == "validate":
        print(json.dumps(report, indent=2))
        return 1 if errors else 0
    if errors:
        print(json.dumps(report, indent=2), file=sys.stderr)
        return 1
    if args.command == "stats":
        print(json.dumps(report["stats"], indent=2))
        return 0
    result = generate_splits(manifest, args.manifest, args.output, args.seed)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
