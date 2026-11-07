# KEY Landing Product Standard — аудит фактической реализации

**Дата:** 2026-11-07  
**Проверенная ветка:** `feature/universal-landing-runtime-v2`  
**Проверенный HEAD при первичном аудите:** `628460518f7f3e1c198e332d1d3184d88dd24688`  
**Последняя проверенная версия:** `47b4ca203193fc92e770ca7be3fd94d15e06ff92` (run #653)  
**Основание:** чтение исходников, продуктовых спецификаций, тестов и результатов GitHub Actions run #634.  
**Ограничение:** это аудит реализации и автоматизированных сценариев. Он не заменяет визуальную приёмку на реальных проектах, проверку внешних интеграций и коммерческое тестирование.

## 1. Итог

**KEY уже имеет значительную часть архитектуры и первый работающий интерактивный runtime, но пока не является законченным универсальным генератором production-ready лендингов.**

Главный риск текущего этапа — принять наличие схем, адаптеров, реестра модулей и review HTML за готовность конечного продукта. Это разные уровни готовности.

Целевой документ уже существует: [KEY Landing Product Standard](../product/KEY_LANDING_PRODUCT_STANDARD.md), версия 1.0-draft. Создавать параллельный «новый главный стандарт» не следует. Необходимо сохранить один нормативный документ, а реализацию сверять с ним через этот аудит и последующие acceptance criteria.

### Сводная оценка

| Область | Фактический статус | Что это означает |
|---|---|---|
| Продуктовая концепция и критерии качества | Специфицировано | Цель, аудитория, конверсионная логика, UX/UI и ограничения описаны; стандарт пока draft |
| Паспорт ЖК и доказательства | Реализован фундамент | Есть схемы, нормализация, источники, статусы, сроки актуальности и публикационные gates |
| LANDING BRIEF и Positioning Gate | Реализован контракт и проверки | Можно валидировать стратегические связи; это не доказывает качество маркетингового решения |
| Module Registry V1 | Частично реализован, canonical IDs синхронизированы для apartments/quiz | Добавлены entries, aliases и fail-closed capability tests; покрытие всего каталога остаётся неполным |
| Основной browser runtime | Работает как первый продуктовый срез | Есть интерактивные секции и формы; полнота композиции и визуальная уникальность ещё не доказаны |
| Review renderer | Работает как внутренний preview | Отдельный упрощённый renderer; не production и не эквивалент основного runtime |
| Лидовая доставка | Контракт и тестовые сценарии реализованы | Реальный CRM KEY API отсутствует; mock/webhook test не равен live delivery |
| Аналитика | Атрибуция и payload подготовлены | Live-счётчики/сквозная аналитика не подключены и не проверены |
| Responsive / browser QA | Автоматизированная база есть | Chromium, Firefox, WebKit проходят; это не проверка физических Android/iOS |
| Коммерческая эффективность | Не проверена | Нет доказательств стоимости квалифицированного лида, качества лидов и влияния на продажи |

## 2. Что действительно реализовано

### 2.1. Данные и достоверность

Подтверждено исходниками и тестами:

- Passport schema и нормализация Project Passport 1.0.0.
- Сохранение происхождения данных и связей с источниками.
- Claim gates: статус, public-use, источники/evidence и актуальность.
- Asset gates: подтверждение проекта, прав, evidence, срока действия и HTTPS URL.
- Отдельная проверка планировок и связанного медиа.
- Location evidence: расстояние по прямой не превращается в маршрутное время; устаревшие маршруты не публикуются.
- Запрет на молчаливую подмену отсутствующих данных демонстрационными фактами K15.

Это сильная основа достоверности. Она не означает, что паспорт конкретного ЖК полностью заполнен или готов к публикации.

### 2.2. Маркетинговая логика

Есть машинно-проверяемый LANDING BRIEF и валидатор связей между сегментами, hooks, offers, funnels и CTA. Для публичного runtime предусмотрены проверки approval status, project ID, operational readiness оффера и совместимости CTA с поддерживаемым сценарием.

Основные ограничения:

- Валидатор проверяет структуру и согласованность данных, но не способен сам доказать, что выбранный сегмент действительно покупает этот ЖК.
- Статус approved не является результатом A/B-теста или подтверждением коммерческой эффективности.
- Маркетинговая стратегия и арт-дирекшн — разные входы. LANDING BRIEF не создаёт сам по себе уникальный дизайн.

### 2.3. Основной browser runtime

Основной UI находится в `landing/runtime/` и использует `landing/runtime/app.js`, `index.html`, `styles.css` и конфигурацию проекта.

По исходникам и browser tests реализованы:

- динамическое заполнение контента проекта;
- вывод преимуществ с отдельным отображением факта, пользы и источника;
- hero fallback при отсутствии медиа;
- галерея и варианты композиции;
- lifestyle-сценарии при наличии одобренных данных и медиа;
- карточки планировок и полноразмерный просмотр;
- передача ID и характеристик выбранной планировки в CTA;
- инфраструктурный блок с ограничениями по доказательствам;
- FAQ accordion;
- калькулятор ориентировочного платежа по введённым пользователем параметрам;
- отдельный квиз/персональный подбор;
- разные CTA и lead-dialog с контекстом;
- canonical lead payload, consent, attribution и защита от ложного успеха;
- состояния ошибки доставки и повторной отправки с сохранением idempotency identifiers.

Это уже не статический макет. Однако наличие сценария в UI и тесте не означает, что он подключён к реальной CRM или готов к эксплуатации на конкретном объекте.

### 2.4. Публикационные ограничения

В builder предусмотрен отдельный production gate: утверждённая маркетинговая стратегия и Positioning Gate, HTTPS endpoint, HTTPS privacy URL, версии политики и текста согласия, API contract version, подтверждённая проверка доставки и активный presentation offer.

Это полезный fail-closed механизм. Поскольку CRM KEY пока не имеет API, production lead workflow остаётся закрытым. Нельзя обходить это ограничение фиктивным endpoint или считать тестовый webhook интеграцией.

## 3. Два пути рендеринга — не путать

### A. Основной runtime

`scripts/build-landing-runtime.mjs` / builder создаёт runtime profile из паспорта, маркетинговых данных и интеграционной конфигурации. Профиль отображается основным UI из `landing/runtime/`.

Это основной кандидат на дальнейшее развитие как пользовательского продукта. Он уже содержит больше прикладной интерактивности: планировки, калькулятор, квиз, lead form и контекст CTA.

### B. Review bundle renderer

`scripts/build-review-bundle.mjs` + `scripts/render-review-preview.mjs` создают внутренний preview из public profile, module manifest и generation report.

В нём реализованы специализированные preview-компоненты hero, gallery, plan cards, quiz, location/places, FAQ и CTA preview context. Данные synthetic fixtures используются для автоматических браузерных тестов.

Границы:

- preview не отправляет лиды и не собирает контактные данные;
- не подтверждает production delivery;
- часть модулей всё ещё имеет общий editorial layout, а registry alias не доказывает полноценную реализацию компонента;
- preview не следует называть готовым генератором production-лендингов.

**Решение:** не развивать два независимых пользовательских продукта. Следует определить, какие контракты и компоненты review renderer нужны основному runtime, затем сближать их через общие модули/данные либо оставить review renderer только инструментом проверки.

## 4. Главные разрывы относительно стандарта

### P0 — закрыть до заявления о полноценном универсальном генераторе

1. **Единый путь генерации.** Документировать и закрепить canonical pipeline: паспорт → маркетинговая стратегия/LANDING BRIEF → композиция и design direction → runtime profile → browser UI → QA → публикационный gate. Не допускать расхождения двух renderer paths.
2. **Полнота module registry.** Текущий Registry V1 ограничен поддерживаемыми ID/вариантами. Сопоставить весь продуктовый каталог с реальными runtime components и статусами `implemented / partial / placeholder / unsupported`. Неподдерживаемый модуль должен давать диагностическое решение, а не выглядеть реализованным.
3. **Динамическая композиция.** Частично закрыто: основной browser runtime теперь скрывает статические секции, исключённые composition, и тестирует навигационные ссылки. Отдельный `scripts/test-renderer-diversity.mjs` доказывает разные наборы модулей, варианты, темы и CSS-композиции на двух synthetic passports, но делает это через review-bundle renderer (`build-review-bundle.mjs` + `render-review-preview.mjs`), а не через основной `landing/runtime/`. Поэтому разнообразие review preview доказано; единый end-to-end pipeline основного runtime на двух ЖК — ещё нет.
4. **Визуальная уникальность.** Палитра и несколько layout variants — ещё не полноценная арт-дирекция. Нужны разные визуальные концепции, ритм, типографика, кадрирование и композиция, соответствующие характеру конкретного ЖК и сегменту.
5. **Один end-to-end проектный сценарий.** Пройти полный конвейер на реальном паспорте без выдумывания фактов. Для KD 905 текущие ограничения по media, inventory, срокам и lifestyle должны оставаться блокерами там, где это требуется.

### P1 — закрыть перед production-пилотом

6. **CRM delivery.** Получить реальный API contract KEY, владельца endpoint, политику повторов/idempotency, подтверждение приёма и проверку полного пути до CRM. До этого не показывать delivery success.
7. **Consent и legal.** Утвердить реальные тексты согласия, политику обработки, версионирование и сценарии отказа.
8. **Analytics.** Подключить согласованные счётчики и схему событий; проверить путь от UTM/click IDs и CTA до квалификации, консультации, показа и сделки. Сейчас analytics выключена.
9. **Ссылки и внешние материалы.** Проверять все публичные URL, документы, маршруты и социальные ссылки конкретного проекта; не использовать заглушки.
10. **Визуальная приёмка.** Нужны скриншоты ключевых состояний, оценка типографики, визуальной иерархии, изображений, пустых/ошибочных состояний и мобильного поведения. Прохождение тестов на overflow не заменяет визуальную оценку.

### P2 — после рабочего пилота

11. Физические устройства Android и iOS/Safari, включая экранную клавиатуру, safe areas, динамический viewport и реальные touch-сценарии.
12. Эксперименты по hooks, офферам, CTA и квалификации на достаточной выборке.
13. Обратная связь из CRM и отдела продаж: причины дисквалификации, консультации, показы, сделки.
14. Обучающийся контур: переносить выводы между проектами только с указанием контекста и уровня уверенности.

## 5. Что уже проверено автоматизированно

GitHub Actions run #634 на HEAD `628460518f7f3e1c198e332d1d3184d88dd24688` и run #653 на HEAD `47b4ca203193fc92e770ca7be3fd94d15e06ff92` завершились успешно. Последний run включает новые registry/composition fixes:

- source-integrity: success;
- Chromium: 33/33;
- Firefox: 33/33;
- WebKit: 33/33;
- всего 99 успешных browser test executions в run #653.

Это подтверждает прохождение реализованных автоматических сценариев на трёх движках. Не подтверждает:

- реальную доставку заявок в CRM KEY;
- включённую live-аналитику;
- качество конверсии и стоимость квалифицированного лида;
- визуальную уникальность двух реальных ЖК;
- проверку физических устройств Android/iOS;
- production readiness.

K15 audit также остаётся ограниченным: автоматизировано проверены навигация, галерея, планировки, apartment carousel, инфраструктурные controls, FAQ, lightbox и about dialog. В ходе run #647 выявлена и исправлена ошибка переключения вкладок планировки (обработчик был привязан не ко всем кнопкам); после исправления сценарий прошёл во всех трёх движках в run #653. Это не полный аудит всех исходных ссылок, модальных сценариев, внешних сервисов и визуального качества.

## 6. Что делать дальше — без расширения инфраструктуры ради инфраструктуры

Приоритетный следующий результат — **один законченный vertical slice на двух разных профилях проекта**, а не очередной большой набор абстрактных компонентов.

Последовательность:

1. Зафиксировать canonical runtime path и выбрать основной renderer.
2. Составить таблицу `moduleId → component → behavior → data requirements → evidence gate → test → status` для модулей из Product Standard и Module Catalog.
3. Устранить расхождения Registry V1, runtime builder и фактического DOM.
4. Выбрать два проекта с достаточным количеством разрешённых данных и медиа. KD 905 использовать только с текущими blockers и caveats; не снимать их ради демонстрации.
5. Сгенерировать два разных preview одним pipeline. Сначала решить, является ли review renderer целевым генератором или только QA preview; затем доказать, что тот же canonical pipeline передаёт выбранную композицию и design direction в основной browser runtime. Не считать текущий diversity test доказательством разнообразия основного runtime.
6. Проверить ключевой пользовательский путь: рекламное обещание → релевантный блок → контекстный CTA → квиз/форма → canonical payload → тестовый endpoint → подтверждённое состояние.
7. После этого провести визуальную приёмку и решить, что действительно требуется для production pilot.

### Критерий завершения следующего этапа

- один canonical pipeline без дублирующих независимых генераторов;
- два проекта дают заметно разные и обоснованные композиции;
- все опубликованные claims/media проходят gates;
- каждый видимый CTA ведёт в работающий сценарий с контекстом;
- тестовая доставка подтверждает payload и ошибочные состояния;
- все ограничения и production blockers показаны явно;
- есть визуальная приёмка desktop/mobile;
- ни один тест не ослаблен ради зелёного CI.

## 7. Решение по нормативной документации

- `KEY_LANDING_PRODUCT_STANDARD.md` остаётся единственным главным продуктовым стандартом.
- `PRODUCTION_UI_FOUNDATION.md` остаётся инженерным стандартом.
- `MODULE_CATALOG_AND_COMPOSITION_RULES.md` остаётся каталогом/правилами модулей, но должен быть синхронизирован с фактическим Registry.
- Этот документ — аудит разрыва «стандарт → реализация», а не второй стандарт.
- Статусы меняются только после проверки соответствующего поведения или интеграции.

**Главный вывод:** фундамент уже достаточно силён, чтобы перестать наращивать его вслепую. Следующая работа должна быть направлена на доказательство полного пользовательского сценария и визуально качественного результата, а не на количество новых тестов, схем и файлов.


## Дополнение: покрытие каталога модулей

Подробная сверка 24 модулей продуктового каталога с Registry V1, основным runtime и review renderer вынесена в [KEY Module Implementation Matrix](KEY_MODULE_IMPLEMENTATION_MATRIX_2026-11-07.md). В ней зафиксированы несовпадения canonical IDs (`apartments` / `floor-plans`, `quiz` / `selection`), shared renderers и отдельные UI-примитивы. До синхронизации этих контрактов нельзя считать весь каталог доступным генератору.


## Дополнение: сквозная интеграция canonical builder → primary browser runtime (2026-11-07)

На stacked PR #24 добавлен явный CLI target `--target-runtime`, который пишет профиль в `landing/runtime/project.config.js` — файл, подключённый основным `landing/runtime/index.html`. Для CI используется изолированный `--out`, чтобы не изменять demo-конфиг репозитория.

Проверка GitHub Actions [run #692](https://github.com/promoutersuvorov-oss/Yandex_direct/actions/runs/42357341810) завершилась успешно:
- source-integrity — success; отдельный контрактный тест CLI — 1/1;
- Chromium — 36/36;
- Firefox — 36/36;
- WebKit — 36/36.

Новый browser integration test действительно запускает основной runtime, подменяя загружаемый `project.config.js` сгенерированным профилем. Проверяются project identity, marketing headline, hero metadata, состав и порядок видимых секций, отсутствие невыбранных секций, CTA → lead dialog и fail-closed demo submit. Тестовый паспорт «Галилея» сужен до минимальной безопасной композиции; остальные draft modules не публикуются и не получают фиктивные подтверждения.

**Граница доказательства:** теперь подтверждён путь canonical builder → основной browser runtime на одном контролируемом профиле. Это не доказывает разнообразие двух проектов, визуальную премиальность, mobile device QA, CRM delivery, production consent/privacy, live analytics или коммерческую конверсию. PR #24 остаётся Draft и зависит от PR #20; изменения ещё не вошли в основную ветку продукта.

Следующая продуктовая задача вынесена в [issue #25](https://github.com/promoutersuvorov-oss/Yandex_direct/issues/25): доказать, что два разных паспорта формируют заметно разные композиции и art direction именно в primary runtime, а не только в review renderer.


## Дополнение: два проекта в primary runtime (2026-11-07)

[PR #26](https://github.com/promoutersuvorov-oss/Yandex_direct/pull/26) и [GitHub Actions run #694](https://github.com/promoutersuvorov-oss/Yandex_direct/actions/runs/42357689874) подтвердили structural diversity двух разных паспортов в основном runtime:
- ЖК «Галилей»: композиция `concept → location`, hero `fullscreen`, palette `garden-modern`;
- КД «905»: композиция `advantages → location`, hero `split`, palette `warm-editorial`.

Оба профиля собраны одним canonical CLI и отрисованы основным browser runtime. На desktop 1440×900 и mobile 390×844 проверены порядок и видимость секций, hero layout, CSS palette token, отсутствие горизонтального overflow, видимость CTA и fail-closed demo submit. Во всех движках:
- source-integrity — success;
- Chromium — 37/37;
- Firefox — 37/37;
- WebKit — 37/37.

В KD 905 fixture сохранены реальные статусы паспорта: факты со статусом `allowed_with_qualification` не продвигаются в публичные claims без утверждённой квалификации; gallery скрыта без одобренных media rights; в блоке преимуществ показано явное empty-state сообщение. Это не визуальная приёмка качества и не подтверждение production readiness. Human design review, реальная CRM delivery, privacy/consent, analytics и performance остаются следующими этапами.

## Дополнение: LANDING BRIEF → lead intent (2026-11-07)

[PR #30](https://github.com/promoutersuvorov-oss/Yandex_direct/pull/30), [run #707](https://github.com/promoutersuvorov-oss/Yandex_direct/actions/runs/42359174864): source-integrity passed (40/40 steps), and the primary runtime browser matrix passed 38/38 in Chromium, 38/38 in Firefox, and 38/38 in WebKit.

Proven in the main browser runtime:
- canonical CLI consumes an approved test-only LANDING BRIEF and maps two separate CTA placements (hero, closing) to the passport's real active presentation offer;
- CTA IDs, intent, offer/scenario, module, funnel, hook, segment and qualification-question references reach a PII-free conversion-intent event;
- event contains no contact fields; demo form does not POST or persist contact data;
- unsupported conversion intent and malformed qualification-question references are rejected by the lead-payload contract;
- the tests run desktop/mobile viewports in all three browser engines.

Limitations: all brief approval/research is synthetic test-only data. No real positioning approval, CRM delivery, legal/privacy acceptance, production analytics or conversion lift is established. This is functional intent wiring, not production readiness or visual sign-off.
