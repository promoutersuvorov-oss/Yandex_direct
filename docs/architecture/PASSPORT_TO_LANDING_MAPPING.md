# Mapping паспорта ЖК → runtime-конфигурация KEY

Версия: 2.0.0  
Статус: реализован первый проверяемый адаптер для runtime v2.

## Источники и границы

Адаптер `scripts/build-landing-runtime.mjs` преобразует три независимых входа:
1. Паспорт ЖК по `schemas/project-passport.schema.json`.
2. Маркетинговый JSON: `{ projectId, approvalStatus: "approved", copy, claimFactIds? }`.
3. Публичную конфигурацию интеграции: `{ leadEndpoint, privacyPolicyUrl, privacyPolicyVersion }`.

Паспорт не является клиентской конфигурацией. `commercial`, `marketContext`, исходные факты, внутренние заметки, источники и служебные поля не копируются в публичный профиль. Рыночный контекст хранится для аналитических задач генератора и не становится публичным содержимым лендинга автоматически.

## Контракт маркетингового слоя

`copy` содержит все текстовые ключи runtime: `heroKicker`, `headline`, `lead`, `conceptTitle`, `conceptCopy`, `advantagesTitle`, `advantagesIntro`, `visualTitle`, `visualCopy`, `apartmentsTitle`, `apartmentsIntro`, `locationTitle`, `locationCopy`, `closingTitle`, `closingCopy`.

Маркетинговый документ допускается только при `approvalStatus="approved"` и совпадении `projectId` с паспортом. Для фактических формулировок `claimFactIds` связывает ключ копирайта с ID фактов. Все ID должны указывать на факты со статусом `verified`, публичным использованием `allowed` или `allowed_with_qualification`, источниками и неистёкшим сроком актуальности. Неподтверждённая формулировка блокирует сборку.

## Правила данных

- Идентичность ЖК берётся из паспорта; район и адрес публикуются только при статусе `verified`.
- Преимущества выводятся только при наличии непустого списка supportingFactIds, каждый из которых publishable. Runtime сохраняет связку «особенность → польза» и передаёт в карточку названия источников подтверждающих фактов (evidence); если хотя бы один supporting fact не publishable, преимущество целиком исключается.
- hook — маркетинговая формулировка, а не доказательство. Его нельзя подписывать как proof или показывать вместо источника. В публичной карточке источник обозначается отдельно как «Фактическое основание»; URL источника не раскрывается автоматически.
- Медиа требуют approved, projectMatch=confirmed, rightsStatus=confirmed, HTTPS URL и неистёкший validUntil. В runtime статусы нормализуются в его контракт `approved`.
- Планировки требуют verified + publicUse=allowed + источники + действующий срок + связанный одобренный asset типа plan. Сам asset должен быть отдельно разрешён для контекста `floor-plans`; разрешение на использование в галерее или другом блоке не переносится автоматически.
- Инфраструктура требует verified и источник; дистанция/время — отдельное доказательство маршрута с действующим validUntil. Прямая дистанция не превращается во время пешком.
- Модули включаются по решениям include/conditional и requiredFactIds; порядок задаётся order. Неизвестные модульные ID игнорируются, дубликаты удаляются.
- Палитра выбирается из проверенного набора по visualDirection.theme; произвольный CSS из паспорта не исполняется.
- Коммерческие поля паспорта никогда не попадают в публичный JS.
- Production режим требует HTTPS webhook, HTTPS privacy URL и версию политики. Секреты и ключи CRM не принимаются и не генерируются этим адаптером.

## Запуск

```bash
node scripts/build-landing-runtime.mjs --passport passport.json --marketing marketing.json --out landing/runtime/project.config.js
node scripts/build-landing-runtime.mjs --passport passport.json --marketing marketing.json --integration public-integration.json --out landing/runtime/project.config.js --production
```

По умолчанию сборка создаёт demo-профиль без отправки персональных данных. Production-флаг разрешён только при полном наборе публичных настроек интеграции.

## Проверки

`node --test tests/landing-runtime-adapter.test.mjs` проверяет утверждения, статусы и сроки фактов, привязку маркетингового слоя к проекту, права и принадлежность ассетов, состав модулей, квиз, изоляцию внутренних полей и production gates.

Это первый адаптерный срез. Он не заменяет JSON Schema validation и не объявляет весь генератор production-ready.


## Статус legacy-контракта и Passport vNext

Текущий adapter принимает Project Passport schema 1.0.0. Passport vNext пока является архитектурным proposal и не является прямым входом builder. До переключения требуется normalized Project Knowledge contract, legacy adapter и parity tests. Нельзя менять или переименовывать поля паспорта, считая, что runtime уже поддерживает vNext. См. [PASSPORT_VNEXT_RUNTIME_CONSUMER_AUDIT.md](PASSPORT_VNEXT_RUNTIME_CONSUMER_AUDIT.md).
