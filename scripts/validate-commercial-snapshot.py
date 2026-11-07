import copy
import json
import sys
from datetime import date, datetime
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "commercial-snapshot.schema.json"
EXAMPLE_PATH = ROOT / "examples" / "kd-905.commercial-snapshot.draft.json"
CANDIDATE_PATH = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else EXAMPLE_PATH

schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())


def validate_snapshot(candidate):
    errors = sorted(
        validator.iter_errors(candidate),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    if errors:
        details = []
        for error in errors:
            path = ".".join(str(part) for part in error.absolute_path) or "<root>"
            details.append(f"{path}: {error.message}")
        raise ValueError("Schema validation failed: " + "; ".join(details))

    checked_at = datetime.fromisoformat(candidate["checkedAt"].replace("Z", "+00:00")).date()
    unit_ids = [unit["id"] for unit in candidate["units"]]
    if len(unit_ids) != len(set(unit_ids)):
        raise ValueError("Duplicate commercial unit IDs")

    for offer in candidate["offers"]:
        if date.fromisoformat(offer["validUntil"]) < checked_at and offer["verificationStatus"] != "expired":
            raise ValueError(f"Expired offer {offer['id']} is not marked expired")
        missing = sorted(set(offer["linkedUnitIds"]) - set(unit_ids))
        if missing:
            raise ValueError(f"Offer {offer['id']} references unknown units: {', '.join(missing)}")
        if offer["verificationStatus"] != "verified" and offer["publicationAllowed"]:
            raise ValueError(f"Unverified offer {offer['id']} cannot be publication-allowed")
        if offer["verificationStatus"] == "conflicting" and not offer.get("conflictNote"):
            raise ValueError(f"Conflicting offer {offer['id']} needs conflictNote")

    for unit in candidate["units"]:
        if unit["availabilityStatus"] == "confirmed_available":
            if not unit.get("availabilityConfirmedAt") or not unit["publicationAllowed"]:
                raise ValueError(f"Unit {unit['id']} needs a confirmation timestamp and publicationAllowed=true")
        elif unit["publicationAllowed"]:
            raise ValueError(f"Unit {unit['id']} cannot be published without confirmed availability")
        if unit["availabilityStatus"] == "manual_review_required" and not unit["manualReviewReasons"]:
            raise ValueError(f"Unit {unit['id']} needs at least one manual review reason")


snapshot = json.loads(CANDIDATE_PATH.read_text(encoding="utf-8"))
validate_snapshot(snapshot)


def expect_rejected(mutator, description):
    invalid = copy.deepcopy(snapshot)
    mutator(invalid)
    try:
        validate_snapshot(invalid)
    except (ValueError, KeyError, TypeError):
        return
    raise SystemExit(f"Negative case unexpectedly accepted: {description}")


expect_rejected(
    lambda data: data["units"][0].update(publicationAllowed=True),
    "unconfirmed inventory made publishable",
)
expect_rejected(
    lambda data: data["offers"][0].update(publicationAllowed=True),
    "unverified offer made publishable",
)
expect_rejected(
    lambda data: data["offers"][0].update(linkedUnitIds=["missing-unit"]),
    "offer references an unknown unit",
)
expect_rejected(
    lambda data: data["offers"][0].update(validUntil="2026-11-01"),
    "expired offer is not marked expired",
)

print(
    f"PASS: {CANDIDATE_PATH.name} validates; {len(snapshot['offers'])} offers and "
    f"{len(snapshot['units'])} units checked. Negative publication-gate cases are rejected."
)
