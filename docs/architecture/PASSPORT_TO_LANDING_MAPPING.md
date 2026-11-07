# Mapping паспорта ЖК, стратегии и маркетингового текста → runtime KEY

Версия: 3.0.0  
Статус: соответствует canonical CLI и normalized runtime builder на ветке `feat/kd905-runtime-evidence-flow`.

## Канонические входы

CLI `scripts/build-landing-runtime.mjs` собирает runtime из четырёх независимых входов:

1. **Project Passport** — `schemas/project-passport.schema.json`: идентичность ЖК, факты, источники, доказательства, ассеты, планировки, инфраструктура, предложения и исходные сведения для нормализации.
2. **Marketing Copy** — `schemas/marketing-copy.schema.json`: `projectId`, человеческий `approvalStatus`, 15 обязательных текстовых полей, `claimFactIds` и при необходимости точечные `claimQualifications`.
3. **LANDING BRIEF** — `schemas/landing-brief.schema.json`: стратегия, позиционирование, сегмент, hooks, offers, funnels, CTA и квалификация. Для demo/review CLI допускает отсутствие Brief; для production он обязателен и проходит `validateLandingBriefReferences(..., { requirePositioningGate: true })`.
4. **Public Integration Config** — отдельный конфиг endpoint, privacy policy и проверенного lead workflow. Передаётся через `--integration`; production требует утверждённый workflow, подтверждённый API-контракт и тест доставки, версию текста согласия, HTTPS endpoint и HTTPS privacy URL. Секреты не передаются и не публикуются.

Passport нормализуется через `normalizePassportV1` в Normalized Project Knowledge и через `normalizeLandingInputsV1` в Landing Inputs. Это внутренние производные модели, отдельные JSON-файлы для них не требуются. Явный `legacyReferences.factIdToClaimId` bridge сохраняет связь исходных fact IDs с нормализованными claims. Runtime builder получает Knowledge + Landing Inputs + bridge + Marketing Copy + Integration Config; публичный профиль содержит только разрешённую проекцию.

## Контракт Marketing Copy

Файл должен соответствовать `schemas/marketing-copy.schema.json`. Обязательные поля copy:

`heroKicker`, `headline`, `lead`, `conceptTitle`, `conceptCopy`, `advantagesTitle`, `advantagesIntro`, `visualTitle`, `visualCopy`, `apartmentsTitle`, `apartmentsIntro`, `locationTitle`, `locationCopy`, `closingTitle`, `closingCopy`.

AI/Builder формирует документ со статусом `draft`; статус `approved` выставляет только ответственный человек после проверки. Каждое конкретное утверждение в тексте должно иметь точные legacy fact IDs в `claimFactIds[copyKey]`. Для `allowed_with_qualification` используется `claimQualifications[copyKey]` с тем же fact ID и утверждённой оговоркой. Qualification действует только в одном поле copy.

Проверка формата:

```bash
python scripts/validate-marketing-copy-schema.py marketing-copy.json
```

JSON Schema проверяет структуру и обязательные поля; она не заменяет runtime-проверку статусов фактов, источников, актуальности, соответствия projectId и фактического human approval.

## Запуск canonical CLI

Demo/review:

```bash
node scripts/build-landing-runtime.mjs --passport passport.json --marketing marketing-copy.approved.json --brief landing-brief.approved.json --out landing/runtime/project.config.js
```

Production:

```bash
node scripts/build-landing-runtime.mjs --passport passport.json --marketing marketing-copy.approved.json --brief landing-brief.approved.json --integration public-integration.json --out landing/runtime/project.config.js --production
```

Для production обязательны approved Marketing Copy, approved Brief с Positioning Gate и проверенная интеграция. Если проект пока не имеет утверждённой стратегии или интеграции, остаёмся в demo/review и не выдаём это за готовность к публикации.

## Границы публикации

- В публичный профиль не переносятся коммерческие и внутренние поля, research notes, исходные источники и служебные данные.
- Факты и преимущества публикуются только при прохождении publication gate; qualification не становится глобальным разрешением.
- Медиа требуют подтверждённых принадлежности проекту, прав, HTTPS URL и актуальности.
- Планировки требуют отдельного проверенного факта и связанного одобренного plan asset.
- Инфраструктура требует подтверждения самого POI; расстояние и время — отдельного актуального evidence маршрута. Прямая дистанция не превращается во время пешком.
- Модули разрешаются через `LANDING_MODULE_REGISTRY_V1`; неизвестный или неготовый обязательный модуль не должен молча исчезать.
- Integration secrets никогда не включаются в паспорт, Marketing Copy или публичный runtime.

## Ограничения и миграция

Passport 1.0.0 остаётся входным контрактом. Normalized Project Knowledge и Landing Inputs — внутренние модели builder-а, не новые пользовательские артефакты. Не создавай вручную дополнительные промежуточные файлы, если CLI их не требует.

