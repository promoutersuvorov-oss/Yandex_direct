import copy
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = ROOT / "schemas" / "marketing-copy.schema.json"
EXAMPLE_PATH = ROOT / "examples" / "marketing-copy.example.json"
CANDIDATE_PATH = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else EXAMPLE_PATH

schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
example = json.loads(CANDIDATE_PATH.read_text(encoding="utf-8"))

Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)
errors = sorted(validator.iter_errors(example), key=lambda error: tuple(str(part) for part in error.absolute_path))
if errors:
    for error in errors:
        path = ".".join(str(part) for part in error.absolute_path) or "<root>"
        print(f"SCHEMA ERROR at {path}: {error.message}", file=sys.stderr)
    raise SystemExit(1)

invalid = copy.deepcopy(example)
del invalid["copy"]["headline"]
if not list(validator.iter_errors(invalid)):
    raise SystemExit("Marketing copy without headline unexpectedly accepted")

invalid = copy.deepcopy(example)
invalid["claimFactIds"]["unknownCopyKey"] = ["fact-1"]
if not list(validator.iter_errors(invalid)):
    raise SystemExit("Unknown marketing copy key unexpectedly accepted")

invalid = copy.deepcopy(example)
invalid["claimQualifications"]["headline"] = [{"factId": "fact-1", "text": ""}]
if not list(validator.iter_errors(invalid)):
    raise SystemExit("Empty claim qualification unexpectedly accepted")

print(f"PASS: {CANDIDATE_PATH.relative_to(ROOT) if CANDIDATE_PATH.is_relative_to(ROOT) else CANDIDATE_PATH.name} validates against JSON Schema Draft 2020-12; missing copy, unknown keys and empty qualifications are rejected.")
