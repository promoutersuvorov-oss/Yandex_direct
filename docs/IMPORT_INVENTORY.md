# KLanding source import inventory

Updated: 2026-11-05

## Imported and verified in this repository

| Source artifact | Repository path | Import status |
|---|---|---|
| `master lending.md` (full text, 1,135 lines) | `prompts/master-lending.md` | Imported; final section included |
| `KEY_LANDING_SYSTEM_FOUNDATION_v1.md` | `docs/architecture/KEY_LANDING_SYSTEM_FOUNDATION_v1.md` | Imported |
| `DATA_MODEL_SPEC.md` | `docs/architecture/DATA_MODEL_SPEC.md` | Imported |
| `PROMPT_1_5_PROJECT_PASSPORT.md` | `prompts/PROMPT_1_5_PROJECT_PASSPORT.md` | Imported |
| `project-passport.schema.json` | `schemas/project-passport.schema.json` | Imported |
| `project-passport.example.json` | `examples/project-passport.example.json` | Imported |
| `KEY_research_3_prompts.md` | `prompts/KEY_research_3_prompts.md` | Imported |
| `KEY_Landing_System_01_Intelligence.docx` | `prompts/01_INTELLIGENCE.md` | Text extracted and imported |
| `KEY_Landing_System_02_Strategist.docx` | `prompts/02_STRATEGIST.md` | Text extracted and imported |
| `KEY_Landing_System_03_Builder.docx` | `prompts/03_BUILDER.md` | Text extracted and imported |
| `K15_landing_edited.html` | `landing/reference/K15_landing_edited.html` | Full 2,498-line HTML imported and read back from GitHub |

## Source artifacts found but not yet imported as binary

The Library contains these source archives:
- `K15_landing_edited.zip` (54,108 bytes)
- `K15_лендинг_v27.1.zip` (9,940,871 bytes)
- `K15_лендинг_v12_без_размытых_CTA.zip` (11,106,093 bytes)
- `K15.zip` (45,739,300 bytes)
- `KEY_Project_Config_Adapter_v1.zip` (6,369 bytes)
- `KEY_Landing_Generator_04_Data_Model.zip` (9,839 bytes)

The Library exposes extracted document text, but the original binary bytes for these archives are not currently available through the file export path. They have not been reconstructed or replaced with guessed content. The HTML baseline above is the exact text extracted from the available K15 HTML file; it is not represented as a substitute for the ZIP archives.

## Still to locate or derive from source

- `MODULE_LIBRARY.md` and detailed component contracts.
- Actual K15 project/page config files (e.g. `project-config.k15.js`, `content-config.k15.js`) and their asset references.
- Separate final versions of Component Library, Marketing Schema, Claim Verification, Lead Schema, Analytics Schema and QA Engine, if they exist as standalone source files.
- Exact original binary asset bundle and archive manifest.

## Import rules

1. Preserve source artifacts before refactoring.
2. Do not infer that a text extraction is a complete binary archive.
3. Keep the K15 facts separate from reusable engine behavior.
4. Record provenance and verification status for every imported artifact.
5. Build new schemas and components only after reconciling the imported source specifications; do not create duplicate competing standards.
