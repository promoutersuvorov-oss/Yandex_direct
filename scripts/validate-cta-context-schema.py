import json
from pathlib import Path
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
schema = json.loads((ROOT / "schemas" / "cta-context.schema.json").read_text(encoding="utf-8"))
Draft202012Validator.check_schema(schema)
validator = Draft202012Validator(schema)

base = {
    "schemaVersion": "key-cta-context/2.0",
    "state": "preview_only",
    "projectId": "sample-project",
    "conversion": {
        "scenarioId": "presentation-request",
        "offerId": "presentation",
        "moduleId": "hero",
        "entityContext": {}
    },
    "requirements": {
        "requiredFields": ["name", "phone"],
        "consentRequired": True
    },
    "delivery": {"status": "disabled_in_preview", "accepted": False}
}
valid_payloads = [
    base,
    {
        **base,
        "conversion": {
            **base["conversion"],
            "scenarioId": "guided-apartment-selection",
            "offerId": "selection",
            "moduleId": "floor-plans",
            "entityContext": {
                "plan": {
                    "id": "plan-54",
                    "rooms": 2,
                    "areaSqm": 54.2,
                    "floor": None,
                    "finishing": None,
                    "assetId": "plan-image"
                }
            }
        }
    },
    {
        **base,
        "conversion": {
            **base["conversion"],
            "scenarioId": "guided-apartment-selection",
            "offerId": "selection",
            "moduleId": "quiz",
            "entityContext": {
                "quizAnswers": [{"questionId": "rooms", "optionId": "two"}]
            }
        }
    }
]
for index, payload in enumerate(valid_payloads, start=1):
    errors = list(validator.iter_errors(payload))
    if errors:
        raise SystemExit(f"Valid CTA fixture {index} rejected: " + "; ".join(error.message for error in errors))

invalid_delivery = {**base, "delivery": {"status": "delivered", "accepted": True}}
invalid_pii = {**base, "contact": {"phone": "+70000000000"}}
invalid_field = {**base, "requirements": {"requiredFields": ["password"], "consentRequired": True}}
for label, payload in [("delivery claim", invalid_delivery), ("PII injection", invalid_pii), ("unknown required field", invalid_field)]:
    if not list(validator.iter_errors(payload)):
        raise SystemExit(f"Invalid CTA fixture unexpectedly accepted: {label}")

print("PASS: CTA context schema accepts general, plan and quiz previews; rejects delivery claims, PII injection and unknown required fields.")
