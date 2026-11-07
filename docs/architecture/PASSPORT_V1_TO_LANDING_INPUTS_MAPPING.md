# Passport 1.0 → Landing Inputs 1.0

Статус: первый независимый адаптер; legacy builder не переключён.

## Зачем

Project Knowledge отвечает на вопрос «что известно об объекте и чем это подтверждено». Landing Inputs отвечает на другой вопрос: «какую историю, композицию и сценарии взаимодействия мы хотим проверить на конкретной кампании». Маркетинговые решения не должны становиться фактами об объекте.

## Контракт

`normalizeLandingInputsV1(passport)` возвращает:

- `landingInputs` — публично-ориентированные, но ещё не production-approved входы лендинга;
- `internal` — защищённые данные и диагностический контекст;
- `warnings`, `errors` — замечания и ошибки адаптации.

Адаптер принимает Passport 1.0.0 и является pure function: исходный объект не мутируется, повторный вызов даёт идентичный результат.

## Границы переноса

| Passport field | Landing Inputs destination | Rule |
|---|---|---|
| `contentStrategy.coreIdea/primaryCta/secondaryCtas/audiencePriority/informationGaps` | `strategy` | Сохраняются как стратегия кампании, не как факты |
| `contentStrategy.modules` | `strategy.modules` | Сохраняются решения, причины, порядок, зависимости, ссылки на facts/assets/CTAs |
| `contentStrategy.visualDirection` | `design` | Исполняемые tokens ограничены schema allowlist; palette — только descriptive brief |
| `project.positioning/audiences` | `positioning` | Сохраняются отдельно; positioning не становится claim и не публикуется автоматически |
| `advantages[]` | `marketingCandidates[]` | Сохраняются как кандидаты с supportingFactIds; не становятся claims |
| `offers[]` | `conversionCatalog[]` | Тип, статус, сценарий и минимальные публичные поля сохраняются; active — только предварительный eligibility |
| `selectionQuiz` | `selectionFlow` | Публикация возможна только для approved quiz с существующим result offer |
| `faq[]` | `faqDrafts[]` | Вопросы и requiredFactIds сохраняются; ответы не генерируются адаптером |
| `project.inventory.layoutsAvailable` | `readiness` | Readiness flag, не утверждение о доступных планировках |
| `commercial` | `internal.commercial` | Protected; не попадает в Landing Inputs |
| `marketContext` | `internal.marketContext` | Только внутренний аналитический контекст |
| `verification` | `internal.verification` | Снимок QA, не самостоятельный источник истины |

## Важные ограничения

- Наличие `supportingFactIds` не доказывает, что факт актуален и разрешён к публикации. Это проверяется отдельным Claim Verification / QA Engine.
- `publicEligible` у offer означает только `status=active`; оно не заменяет проверку юридических требований, согласия, backend и готовности сценария.
- Для quiz дополнительно проверяется существование `resultOfferId`; это не доказывает корректность UX или обработчика.
- FAQ содержит только вопросы и ссылки на факты. Генерация ответа должна отдельно проверить каждый referenced fact.
- Значения palette/mood/interactions не исполняются как CSS/JS. Новые design tokens вводятся через schema, компонентную библиотеку и тесты.
- `internal` нельзя сериализовать в клиентский runtime bundle.

## Следующий этап

Сопоставить Project Knowledge и Landing Inputs с реальными входами `buildLandingProfile`, затем спроектировать отдельный builder и parity tests. До этого legacy builder остаётся неизменным.
