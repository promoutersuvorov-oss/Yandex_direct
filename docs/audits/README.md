# KEY — индекс аудитов

Аудиты фиксируют фактическое состояние реализации и не заменяют нормативные документы. Если вывод аудита расходится с Product Standard, стандарт определяет целевое поведение, а аудит — текущий разрыв.

## Текущий продуктовый статус

- [KEY Landing Product Implementation Audit — 2026-11-07](KEY_LANDING_PRODUCT_IMPLEMENTATION_AUDIT_2026-11-07.md) — общий разрыв между Product Standard, архитектурой и реально работающим продуктом.
- [KEY Module Registry Coverage — 2026-11-07](KEY_MODULE_REGISTRY_COVERAGE_2026-11-07.md) — соответствие каталога модулей, Registry V1, builder и browser runtime.
- [Review Renderer Gap Audit](REVIEW_RENDERER_GAP_AUDIT.md) — ограничения внутреннего preview renderer и отличие от production runtime.

## K15 — эталонный исходник и UX-аудит

- [K15 Product & UX Gap Audit — 2026-11-05](K15_PRODUCT_AND_UX_GAP_AUDIT_2026-11-05.md) — исходный функциональный и UX-инвентарь K15, покрытие тестами и пробелы.
- [K15 Product Standard Gap Audit](K15_PRODUCT_STANDARD_GAP_AUDIT.md) — сопоставление K15 с продуктовыми требованиями.
- [K15 Runtime Module Mapping — 2026-11-05](K15_RUNTIME_MODULE_MAPPING_2026-11-05.md) — соответствие элементов K15 текущим runtime-модулям.

## KD 905 — проектные данные и маркетинг

- [KD 905 Passport Field Audit — 2026-11-06](PROJECT_PASSPORT_FIELD_AUDIT_KD_905_2026-11-06.md) — полнота и доказательность полей паспорта.
- [KD 905 Marketing Strategy Draft — 2026-11-06](KD_905_MARKETING_STRATEGY_DRAFT_2026-11-06.md) — черновые сегменты, hooks, offers и ограничения; не утверждённая публичная стратегия.

## Архитектура и повторное использование

- [KLanding Reuse and Rebuild Decision — 2026-11-05](KLANDING_REUSE_AND_REBUILD_DECISION_2026-11-05.md) — решения по использованию наработок Agency.
- [Agency Repository Reuse Review — 2026-11-05](AGENCY_REPOSITORY_REUSE_REVIEW_2026-11-05.md) — аудит повторного использования материалов.
- [Agency Branch Implementation Review — 2026-11-05](AGENCY_BRANCH_IMPLEMENTATION_REVIEW_2026-11-05.md) — проверка реализации перенесённых решений.
- [Agency Branch Deep Review — 2026-11-05](AGENCY_BRANCH_DEEP_REVIEW_2026-11-05.md) — углублённая проверка архитектуры и качества переноса.

## Правило обновления

При существенном изменении runtime, Registry, K15 audit или паспорта проекта обновлять соответствующий аудит. Не создавать новый документ, если достаточно дополнить существующий. Даты и commit SHA в аудите должны соответствовать реально проверенному состоянию.
