import json
from datetime import datetime
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
schema = json.loads((ROOT / "schemas/restricted-attribution-link.schema.json").read_text(encoding="utf-8"))
example = json.loads((ROOT / "examples/restricted-attribution-link.example.json").read_text(encoding="utf-8"))
validator = Draft202012Validator(schema, format_checker=FormatChecker())

def assert_invalid(payload, label):
    if not list(validator.iter_errors(payload)):
        raise SystemExit(f"Privacy/contract regression: invalid case accepted: {label}")

errors = list(validator.iter_errors(example))
if errors:
    raise SystemExit("\n".join(f"{list(error.path)}: {error.message}" for error in errors))

captured = datetime.fromisoformat(example["capturedAt"].replace("Z", "+00:00"))
expires = datetime.fromisoformat(example["expiresAt"].replace("Z", "+00:00"))
if expires <= captured:
    raise SystemExit("Attribution link expiry must be later than capture time")

invalid_pii = json.loads(json.dumps(example))
invalid_pii["phone"] = "+79990000000"
assert_invalid(invalid_pii, "top-level contact data")

invalid_nested = json.loads(json.dumps(example))
invalid_nested["identifiers"]["email"] = "person@example.com"
assert_invalid(invalid_nested, "contact data inside restricted identifiers")

invalid_client_consent = json.loads(json.dumps(example))
invalid_client_consent["consent"]["analytics"] = False
assert_invalid(invalid_client_consent, "Metrika ClientID without analytics consent")

invalid_yclid_consent = json.loads(json.dumps(example))
invalid_yclid_consent["consent"]["advertisingMeasurement"] = False
assert_invalid(invalid_yclid_consent, "yclid without advertising measurement consent")

invalid_empty = json.loads(json.dumps(example))
invalid_empty["identifiers"] = {}
assert_invalid(invalid_empty, "empty identifier mapping")

invalid_expiry = json.loads(json.dumps(example))
invalid_expiry["expiresAt"] = invalid_expiry["capturedAt"]
captured_bad = datetime.fromisoformat(invalid_expiry["capturedAt"].replace("Z", "+00:00"))
expires_bad = datetime.fromisoformat(invalid_expiry["expiresAt"].replace("Z", "+00:00"))
if expires_bad > captured_bad:
    raise SystemExit("Expiry negative case fixture is invalid")
if expires_bad <= captured_bad:
    pass

print("Restricted attribution-link schema and privacy negative cases: OK")
