#!/usr/bin/env python3
"""Smoke tests for Phase 1 benchmark validation and leakage-safe splitting."""

import copy
import json
import shutil
import tempfile
from pathlib import Path

from manageBenchmarkDataset import generate_splits, sha256_file, validate_manifest


ROOT = Path(__file__).resolve().parent.parent
SOURCE_IMAGES = [
    ROOT / "dataset" / "electrical" / "electrical_1.jpg",
    ROOT / "dataset" / "sanitation" / "sanitation_1.jpg",
]


def record(record_id, image_name, digest, group_id, category_id="utility_fault", status="adjudicated"):
    accepted = status == "adjudicated"
    return {
        "id": record_id,
        "media": {
            "path": f"images/{image_name}",
            "sha256": digest,
            "mimeType": "image/jpeg",
            "groupId": group_id,
            "capturedAt": None,
        },
        "provenance": {
            "sourceType": "open_data",
            "sourceReference": "fixture-source-reference",
            "license": "test-only",
            "permissionConfirmed": accepted,
        },
        "location": {"city": "Bengaluru", "area": "Test Ward", "precision": "ward_only"},
        "privacy": {
            "piiReviewed": accepted,
            "faces": "none",
            "vehiclePlates": "none",
            "privatePropertyIdentifiers": "none",
            "reviewer": "reviewer-1" if accepted else "",
        },
        "labels": {
            "categoryId": category_id,
            "secondaryCategoryIds": [],
            "severity": "High" if accepted else "Needs Review",
            "incidentPresent": True,
            "hazards": [],
            "sensitiveContext": [],
            "visibleEvidence": "Test fixture.",
        },
        "annotation": {
            "status": status,
            "annotators": ["annotator-a", "annotator-b"] if accepted else [],
            "agreement": 1.0 if accepted else None,
            "adjudicator": "annotator-c" if accepted else None,
            "annotatedAt": "2026-07-13T00:00:00Z",
            "notes": "",
        },
    }


def manifest(records):
    return {
        "schemaVersion": "1.0.0",
        "datasetVersion": "test-1.0.0",
        "title": "Benchmark verification fixture",
        "description": "",
        "createdAt": "2026-07-13T00:00:00Z",
        "records": records,
    }


def write_manifest(path, value):
    path.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")


def main():
    with tempfile.TemporaryDirectory(prefix="urban-pulse-benchmark-") as temp_dir:
        benchmark_dir = Path(temp_dir)
        image_dir = benchmark_dir / "images"
        image_dir.mkdir()
        for source in SOURCE_IMAGES:
            shutil.copy2(source, image_dir / source.name)

        first_hash = sha256_file(image_dir / SOURCE_IMAGES[0].name)
        second_hash = sha256_file(image_dir / SOURCE_IMAGES[1].name)
        valid_record = record("UPB-TEST-000001", SOURCE_IMAGES[0].name, first_hash, "scene-a")
        manifest_path = benchmark_dir / "manifest.json"
        write_manifest(manifest_path, manifest([valid_record]))

        _value, errors, warnings = validate_manifest(manifest_path, strict=True)
        assert not errors, errors
        assert not warnings, warnings

        negative = record("UPB-TEST-NEG001", SOURCE_IMAGES[1].name, second_hash, "scene-negative", "general")
        negative["labels"]["incidentPresent"] = False
        negative["labels"]["severity"] = "Needs Review"
        write_manifest(manifest_path, manifest([negative]))
        _value, errors, warnings = validate_manifest(manifest_path, strict=True)
        assert not errors, errors
        assert not warnings, warnings

        draft = record("UPB-TEST-000002", SOURCE_IMAGES[1].name, second_hash, "scene-b", "garbage", "draft")
        write_manifest(manifest_path, manifest([valid_record, draft]))
        _value, errors, warnings = validate_manifest(manifest_path)
        assert not errors, errors
        assert any("privacy" in warning for warning in warnings)
        assert any("permissionConfirmed" in warning for warning in warnings)

        invalid_accepted = copy.deepcopy(valid_record)
        invalid_accepted["privacy"]["piiReviewed"] = False
        invalid_accepted["privacy"]["reviewer"] = ""
        write_manifest(manifest_path, manifest([invalid_accepted]))
        _value, errors, _warnings = validate_manifest(manifest_path, strict=True)
        assert any("privacy" in error for error in errors)

        duplicate = copy.deepcopy(valid_record)
        duplicate["id"] = "UPB-TEST-000003"
        duplicate["media"]["path"] = "images/electrical-copy.jpg"
        shutil.copy2(image_dir / SOURCE_IMAGES[0].name, image_dir / "electrical-copy.jpg")
        write_manifest(manifest_path, manifest([valid_record, duplicate]))
        _value, errors, _warnings = validate_manifest(manifest_path, strict=True)
        assert any("Exact duplicate image hash" in error for error in errors)

        split_records = []
        for index in range(12):
            category_id = "utility_fault" if index < 6 else "garbage"
            scene_group = f"scene-{index // 2}"
            split_records.append(
                record(
                    f"UPB-SPLIT-{index:06d}",
                    SOURCE_IMAGES[index % 2].name,
                    first_hash if index % 2 == 0 else second_hash,
                    scene_group,
                    category_id,
                )
            )
        split_manifest = manifest(split_records)
        write_manifest(manifest_path, split_manifest)
        first_output = benchmark_dir / "splits-a.json"
        second_output = benchmark_dir / "splits-b.json"
        first = generate_splits(split_manifest, manifest_path, first_output, "fixed-seed")
        second = generate_splits(split_manifest, manifest_path, second_output, "fixed-seed")
        assert first["splits"] == second["splits"]

        split_by_id = {
            record_id: split_name
            for split_name, record_ids in first["splits"].items()
            for record_id in record_ids
        }
        groups = {}
        for item in split_records:
            group_id = item["media"]["groupId"]
            groups.setdefault(group_id, set()).add(split_by_id[item["id"]])
        assert all(len(split_names) == 1 for split_names in groups.values())

    print(
        json.dumps(
            {
                "passed": True,
                "validManifest": True,
                "negativeClass": True,
                "draftQuarantine": True,
                "privacyGate": True,
                "duplicateGate": True,
                "deterministicSplits": True,
                "sceneLeakagePrevented": True,
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
