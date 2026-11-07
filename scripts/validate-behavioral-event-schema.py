import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
schema = json.loads((ROOT / "schemas/behavioral-event.schema.json").read_text(encoding="utf-8"))
example = json.loads((ROOT / "examples/behavioral-event.example.json").read_text(encoding="utf-8"))
validator = Draft202012Validator(schema, format_checker=FormatChecker())
errors = sorted(validator.iter_errors(example), key=lambda error: list(error.path))
if errors:
    raise SystemExit("\n".join(f"{list(error.path)}: {error.message}" for error in errors))

for forbidden in ("name", "phone", "email", "yclid", "clientId", "client_id", "rawUrl", "fullUrl"):
    invalid = dict(example)
    invalid[forbidden] = "must-not-be-accepted"
    if not list(validator.iter_errors(invalid)):
        raise SystemExit(f"Privacy regression: forbidden top-level field accepted: {forbidden}")

invalid_nested = json.loads(json.dumps(example))
invalid_nested["context"]["phone"] = "+79991234567"
if not list(validator.iter_errors(invalid_nested)):
    raise SystemExit("Privacy regression: contact data accepted in context")

invalid_query = json.loads(json.dumps(example))
invalid_query["pagePath"] = "/?phone=79991234567"
if not list(validator.iter_errors(invalid_query)):
    raise SystemExit("Privacy regression: query string accepted in pagePath")


for valid_ref in ("attr_0123456789abcdef", "attr_AbCd_0123456789-XYZ"):
    candidate = dict(example)
    candidate["attributionRef"] = valid_ref
    if list(validator.iter_errors(candidate)):
        raise SystemExit(f"Valid attributionRef rejected: {valid_ref}")

for invalid_ref in ("", "attr_short", "raw-client-id-123456", "attr_" + "x" * 97):
    candidate = dict(example)
    candidate["attributionRef"] = invalid_ref
    if not list(validator.iter_errors(candidate)):
        raise SystemExit(f"Attribution contract regression: invalid reference accepted: {invalid_ref}")

print("Behavioral event schema, attribution reference, and privacy negative cases: OK")
