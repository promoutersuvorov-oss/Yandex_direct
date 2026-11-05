# KLanding — аудит повторного использования и решение по архитектуре

**Дата:** 2026-11-05  
**Статус:** инженерное решение по результатам чтения текущего репозитория, K15 HTML baseline и аудита Agency. Это не заявление о production-ready системе.

## 1. Решение

Не объединять старые реализации механическим merge и не переписывать продукт целиком с нуля.

Выбран путь **selective rebuild**:
- сохранять подтверждённые бизнес-сценарии, требования, данные, тестовые случаи и зрелые UI-паттерны;
- переносить только изолированные механизмы с понятным контрактом;
- переписывать runtime-ядро там, где старые контракты конфликтуют с канонической моделью KLanding;
- сохранять K15 как функциональный эталон и регрессионный baseline, а не превращать его DOM в универсальный шаблон;
- не поддерживать две параллельные конкурирующие реализации.

Критерий переноса — не возраст и не объём кода, а стоимость владения, безопасность, совместимость и доказанная полезность.

## 2. Инвентаризация источников

| Источник | Что подтверждено | Статус | Решение |
|---|---|---|---|
| K15 `landing/reference/K15_landing_edited.html` | Полный HTML baseline, 2 498 строк; отдельные конфигурационные массивы; карусели, галерея, интерактивные места, планировки, формы, квиз, диалоги, lightbox | Импортирован; исходный HTML читается в GitHub | Сохранить как эталон и извлекать сценарии/поведение по одному |
| K15 lead runtime | Валидация имени/телефона/consent, honeypot, payload, таймаут отправки, retry при ошибке, отсутствие ложного success при пустом endpoint/сетевой ошибке | Подтверждено чтением исходного HTML | Перенести поведенческие требования и тесты; реализацию перепроектировать под новый контракт |
| K15 attribution/analytics | UTM, yclid/ysclid/gclid/erid/rb_clickid, first-touch session storage, referrer, ym_uid, dataLayer, Метрика/VK goals, события формы/мессенджера | Подтверждено чтением исходного HTML | Сохранить словарь и полезные параметры; сделать единый provider-neutral analytics adapter |
| K15 modal/offer library | Сценарии viewing, request, plans, prices, terms, promotions, mortgageApproval, newbuildings, presentation, installment, ask, parking; сценарный payload для комнат | Подтверждено чтением исходного HTML | Сохранить каталог как исходную библиотеку сценариев; не считать все сценарии автоматически активными |
| K15 quiz | Вопросы rooms/area/pay, состояние в sessionStorage, привязка к lead и bot handoff | Подтверждено чтением исходного HTML | Сохранить как reference flow; нормализовать quiz schema и consent |
| Agency PR/ветки | Passport adapter, media safety, section manifest, renderer contract, publication readiness, project isolation, no-false-lead-success, cross-browser UI foundation | Описаны в deep review; отдельные CI runs на точных SHA были успешны | Переносить идеи/тесты; не сливать ветки целиком |
| Agency scripts | `build-project-config.py`, `build-landing-bundle.py`, `package-landing-bundle.py` упомянуты в прежнем аудите как существовавшие прототипы | Исходники не импортированы в текущий репозиторий и совместимость не подтверждена | Не копировать вслепую; повторно открыть исходник только при доступности и сравнить с новым контрактом |
| KEY Project Config Adapter ZIP | Архив найден в Library, но бинарное содержимое не импортировано | Источник недоступен как исходный ZIP | Не реконструировать по имени; если появится исходник — сравнить контракт, не переносить автоматически |
| KEY Landing Generator Data Model ZIP | Архив найден, но бинарное содержимое не импортировано | Источник недоступен как исходный ZIP | Сверить с текущей schema при получении; не создавать дублирующую schema |
| KEY master prompt + 3 prompts | Полный master prompt и Intelligence/Strategist/Builder тексты импортированы | Подтверждено | Сохранить как продуктовые/агентные требования; устранить дублирующие инструкции после единого workflow |
| Canonical passport schema | `schemas/project-passport.schema.json` и example; DATA_MODEL_SPEC описывает факты, доказательства, маркетинговые решения, assets и коммерческий слой | В текущем проекте | Считать единственным canonical data contract до отдельного обоснованного versioned migration |
| Current review bundle | Profile, manifest, generation report; evidence/rights/publication blockers; project isolation tests | Реализовано частично | Сохранить как preflight/review pipeline, расширить capabilities contract |
| Current review renderer | HTML preview из bundle, базовый responsive, reduced motion, блокировка при review gates | Реализован как proof-of-pipeline | Не называть production renderer; заменить/расширить после runtime contract |
| Yandex Direct | В текущем проекте есть сквозная бизнес-модель и маркетинговые prompts; отдельный подтверждённый исполняемый генератор кампаний не найден в импортированных файлах | Docs/strategy, implementation not verified | Не заявлять о готовом генераторе; проектировать Direct как отдельный модуль общего acquisition loop |
| CRM delivery | В K15 есть старый endpoint mechanism; выбранная production CRM и юридические тексты/consent ещё не определены | Частично / decision pending | Оставить integration boundary; не подключать реальные данные до определения CRM и consent |

## 3. Что нельзя потерять из K15

Ниже перечислены не просто визуальные детали, а поведенческие контракты, которые нужно сохранить в тестах и целевой архитектуре:

1. Разные CTA открывают разные контекстные сценарии, а не одну универсальную форму.
2. CTA конкретной планировки передаёт контекст комнат/варианта.
3. Формы валидируют имя, телефон и согласие, имеют понятные ошибки.
4. Ошибка endpoint или сети не отображается как успешная заявка.
5. Повторная отправка доступна после ошибки.
6. Honeypot не пропускает очевидный автоматический спам.
7. В лид попадают сценарий, URL, время, устройство, UTM/click IDs и ответы квиза, если они реально собраны.
8. События аналитики отделяют открытие формы, ошибку, успешную доставку и клики по мессенджерам.
9. Квиз имеет прогресс/состояние и связывает ответы с конкретным сценарием обращения.
10. Галереи, карусели, lightbox, интерактивные точки и планировки имеют самостоятельное поведение и мобильное управление.

При этом старые K15 значения, endpoint, счётчики, контакты, юридические URL, цены, availability и бот-ссылки нельзя автоматически переносить в новый ЖК.

## 4. Архитектурное решение

Единый pipeline:

`Sources → Evidence Ledger → Canonical Project Passport → Marketing Strategy → Page Composition → Runtime Renderer → Lead/Analytics Adapters → QA & Learning`

Границы:
- **Project Passport** — факты, источники, статусы, активы и внутренние сведения; не является HTML.
- **Marketing Strategy** — сегменты, обещание, hooks, sequence, offer/CTA и аргументация; не может повышать статус факта.
- **Composition** — выбирает и упорядочивает модули и варианты для конкретного ЖК.
- **Renderer** — отображает только capabilities, которые реально реализованы и прошли тесты.
- **Lead adapter** — принимает унифицированный payload и отправляет его в подключённый канал; не сообщает success до подтверждения доставки.
- **Analytics adapter** — единый словарь событий, подключаемые провайдеры.
- **QA/release gates** — source checked, browser checked, device checked, integration checked, launch ready — отдельные статусы.

Один runtime и одна schema; несколько качественно различных композиционных вариантов и визуальных систем. Это не означает одинаковый лендинг с заменёнными фотографиями.

## 5. Migration backlog с приоритетами

### P0 — защита существующего опыта
- Зафиксировать K15 baseline и тестовые сценарии, не менять его без regression coverage.
- Извлечь полный список конфигурационных сущностей K15 и проверить все текущие runtime dependencies.
- Создать таблицу `legacy K15 field/event → canonical contract → transform → test`.
- Создать CTA/lead/analytics behavior contract на базе реального K15.
- Добавить capability states: `implemented`, `partial`, `placeholder`, `unsupported`.
- Сохранять provenance и project isolation.

### P1 — вертикальный production slice
- Один project passport → strategy → композиция → реальный renderer.
- Реальные Hero + Gallery, project features/story, Apartment plans и Personal selection/quiz.
- Модальные сценарии и формы с тестируемым lead adapter, пока на mock endpoint.
- Контекст CTA и полный payload contract.
- Mobile/desktop visual QA для двух разных ЖК.

### P2 — интеграции и масштабирование
- Выбор CRM, consent/legal requirements, production webhook.
- UTM/click ID end-to-end и проверка аналитических событий.
- Yandex Direct campaign planner/generator, semantic core, negatives, creatives, campaign structure, policy checks и feedback по CPQL.
- Сбор данных о квалификации, показах и сделках для обучения.

## 6. Release status на дату аудита

GitHub Actions run [42037794506](https://github.com/promoutersuvorov-oss/Yandex_direct/actions/runs/42037794506) завершён успешно:
- source-integrity — success;
- browser-smoke Chromium — success;
- browser-smoke Firefox — success;
- browser-smoke WebKit — success.

Это подтверждает прохождение текущих CI checks и smoke tests для review preview/K15 baseline. Не подтверждает:
- production-ready renderer;
- физические Android/iOS устройства;
- реальную CRM/webhook доставку;
- production analytics/UTM;
- готовность к публикации.

## 7. Правило против повторной разработки

Перед созданием любого нового механизма разработчик обязан:
1. найти аналог в K15, Agency, prompt/spec/library;
2. определить, что именно уже доказано (код, тест, документация или только идея);
3. сравнить контракт, а не только название функции;
4. выбрать reuse/adapt/rewrite/drop и записать причину;
5. добавить регрессионный тест на сохранённое поведение.

Нельзя создавать новую schema, CTA system, lead payload, analytics event dictionary, module catalog или QA gate, пока не проверен существующий аналог.

## 8. Итог

KLanding развивается не как слияние двух кодовых баз и не как повторная разработка с нуля. Это контролируемое восстановление лучших решений, с новым единым runtime там, где старые реализации несовместимы.

Старый код — источник поведения и проверенных решений. Canonical passport и новый runtime — источник истины для будущего продукта. K15 — эталон для регрессии. Agency — источник инженерных проверок и идей. Маркетинг и Яндекс Директ — части одной системы привлечения и качества продаж.
