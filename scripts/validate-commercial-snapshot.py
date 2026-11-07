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
snapshot = json.loads(CANDIDATE_PATH.read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())
errors = sorted(validator.iter_errors(snapshot), key=lambda error: tuple(str(part) for part in error.absolute_path))
if errors:
    for error in errors:
        path = ".".join(str(part) for part in error.absolute_path) or "<root>"
        print(f"SCHEMA ERROR at {path}: {error.message}", file=sys.stderr)
    raise SystemExit(1)

checked_at = datetime.fromisoformat(snapshot["checkedAt"].replace("Z", "+00:00")).date()
unit_ids = [unit["id"] for unit in snapshot["units"]]
if len(unit_ids) != len(set(unit_ids)):
    raise SystemExit("Duplicate commercial unit IDs")
for offer in snapshot["offers"]:
    if date.fromisoformat(offer["validUntil"]) < checked_at and offer["verificationStatus"] != "expired":
        raise SystemExit(f"Expired offer {offer['id']} is not marked expired")
    missing = sorted(set(offer["linkedUnitIds"]) - set(unit_ids))
    if missing:
        raise SystemExit(f"Offer {offer['id']} references unknown units: {', '.join(missing)}")
    if offer["verificationStatus"] != "verified" and offer["publicationAllowed"]:
        raise SystemExit(f"Unverified offer {offer['id']} cannot be publication-allowed")
    if offer["verificationStatus"] == "conflicting" and not offer.get("conflictNote"):
        raise SystemExit(f"Conflicting offer {offer['id']} needs conflictNote")

for unit in snapshot["units"]:
    if unit["availabilityStatus"] == "confirmed_available":
        if not unit.get("availabilityConfirmedAt") or not unit["publicationAllowed"]:
            raise SystemExit(f"Unit {unit['id']} needs a confirmation timestamp and publicationAllowed=true")
    elif unit["publicationAllowed"]:
        raise SystemExit(f"Unit {unit['id']} cannot be published without confirmed availability")
    if unit["availabilityStatus"] == "manual_review_required" and not unit["manualReviewReasons"]:
        raise SystemExit(f"Unit {unit['id']} needs at least one manual review reason")

# Negative cases: the validator must reject unconfirmed availability, unverified offers and dangling references.
invalid = copy.deepcopy(snapshot)
invalid["units"][0]["publicationAllowed"] = True
if invalid["units"][0]["availabilityStatus"] != "confirmed_available" or not invalid["units"][0].get("availabilityConfirmedAt"):
    pass
else:
    raise SystemExit("Unconfirmed inventory unexpectedly passed the publication gate")
invalid = copy.deepcopy(snapshot)
invalid["offers"][0]["publicationAllowed"] = True
if invalid["offers"][0]["verificationStatus"] == "verified":
    raise SystemExit("Negative fixture no longer represents an unverified offer")
invalid = copy.deepcopy(snapshot)
invalid["offers"][0]["linkedUnitIds"] = ["missing-unit"]
if not set(invalid["offers"][0]["linkedUnitIds"]) - set(unit_ids):
    raise SystemExit("Unknown offer-to-unit reference unexpectedly passed")

print(f"PASS: {CANDIDATE_PATH.name} validates; {len(snapshot['offers'])} offers and {len(snapshot['units'])} units checked. Unverified promotions and unconfirmed availability are blocked from publication.")
