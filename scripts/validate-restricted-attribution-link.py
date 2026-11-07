import json
from datetime import datetime
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
schema = json.loads((ROOT / "schemas/restricted-attribution-link.schema.json").read_text(encoding="utf-8"))
example = json.loads((ROOT / "examples/restricted-attribution-link.example.json").read_text(encoding="utf-8"))
validator = Draft202012Validator(schema, format_checker=FormatChecker())

def errors_for(payload):
    return list(validator.iter_errors(payload))

def assert_invalid(payload, label):
    if not errors_for(payload):
        raise SystemExit(f"Privacy/contract regression: invalid case accepted: {label}")

def has_valid_retention_window(payload):
    try:
        captured = datetime.fromisoformat(payload["capturedAt"].replace("Z", "+00:00"))
        expires = datetime.fromisoformat(payload["expiresAt"].replace("Z", "+00:00"))
        return expires > captured
    except (KeyError, TypeError, ValueError):
        return False

if errors_for(example):
    raise SystemExit("\\n".join(f"{list(error.path)}: {error.message}" for error in errors_for(example)))
if not has_valid_retention_window(example):
    raise SystemExit("Valid example must expire after capture time")

invalid_pii = json.loads(json.dumps(example)); invalid_pii["phone"] = "+79990000000"
assert_invalid(invalid_pii, "top-level contact data")
invalid_nested = json.loads(json.dumps(example)); invalid_nested["identifiers"]["email"] = "person@example.com"
assert_invalid(invalid_nested, "contact data inside restricted identifiers")
invalid_client_consent = json.loads(json.dumps(example)); invalid_client_consent["consent"]["analytics"] = False
assert_invalid(invalid_client_consent, "Metrika ClientID without analytics consent")
invalid_yclid_consent = json.loads(json.dumps(example)); invalid_yclid_consent["consent"]["advertisingMeasurement"] = False
assert_invalid(invalid_yclid_consent, "yclid without advertising measurement consent")
invalid_empty = json.loads(json.dumps(example)); invalid_empty["identifiers"] = {}
assert_invalid(invalid_empty, "empty identifier mapping")
invalid_expiry = json.loads(json.dumps(example)); invalid_expiry["expiresAt"] = invalid_expiry["capturedAt"]
if has_valid_retention_window(invalid_expiry):
    raise SystemExit("Retention regression: non-future expiry accepted")

print("Restricted attribution-link schema and privacy negative cases: OK")
