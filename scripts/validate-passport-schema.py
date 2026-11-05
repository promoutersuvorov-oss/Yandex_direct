import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "project-passport.schema.json"
DEFAULT_PASSPORT_PATH = ROOT / "examples" / "project-passport.example.json"
PASSPORT_PATH = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_PASSPORT_PATH

schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
passport = json.loads(PASSPORT_PATH.read_text(encoding="utf-8"))

Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema, format_checker=FormatChecker())
errors = sorted(
    validator.iter_errors(passport),
    key=lambda error: tuple(str(part) for part in error.absolute_path),
)

if errors:
    for error in errors:
        path = ".".join(str(part) for part in error.absolute_path) or "<root>"
        print(f"SCHEMA ERROR at {path}: {error.message}", file=sys.stderr)
    raise SystemExit(1)

print(
    f"PASS: {PASSPORT_PATH.relative_to(ROOT)} validates against "
    "JSON Schema Draft 2020-12, including URI and date-time formats."
)
