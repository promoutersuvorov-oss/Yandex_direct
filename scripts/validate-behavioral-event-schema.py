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

print("Behavioral event schema and privacy negative cases: OK")
