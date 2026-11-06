# KEY — матрица каталога модулей и фактической реализации

**Дата:** 2026-11-07  
**База сверки:** PR #20, branch `feature/universal-landing-runtime-v2`, HEAD на момент аудита `89906018912e05f57441325acbe9eaec1fb752b3`.  
**Источники:** `docs/architecture/MODULE_CATALOG_AND_COMPOSITION_RULES.md`, `src/landing-module-registry-v1.mjs`, `landing/runtime/app.js`, `landing/runtime/index.html`, `scripts/render-review-preview.mjs`, browser tests.

Матрица отвечает на конкретный вопрос: может ли система не только назвать модуль в каталоге, но и выбрать его, разрешить его зависимости и отобразить ожидаемое поведение. Простое упоминание слова или наличие HTML-секции не считается реализацией.

## 1. Сводка

- В каталоге описано **24 module ID**.
- В `LANDING_MODULE_REGISTRY_V1` зарегистрировано **10 ID**.
- Registry содержит строгие проверки неизвестных ID, неподдерживаемых вариантов, зависимостей и конфликтов секций.
- Некоторые сценарии существуют в основном runtime, но не имеют соответствующего ID/variant в Registry V1.
- Часть каталога — не самостоятельные секции, а UI-примитивы/навигационные элементы. Их нужно учитывать отдельным типом контракта, а не добавлять механически в список секций.

**Вывод:** Module Registry V1 — реальный, но узкий первый срез. Он не покрывает весь продуктовый каталог и пока не является универсальным композиционным движком.

## 2. Матрица соответствия

Статусы:
- **Registered** — ID и вариант явно объявлены в Registry V1. Это подтверждает только наличие mapping и проверок зависимостей.
- **Runtime behavior** — найдено конкретное поведение в основном UI и/или browser tests.
- **Partial / shared** — данные или часть UI существуют, но самостоятельный ожидаемый модуль/полное поведение не доказаны.
- **Not registered** — нет ID в Registry V1; нельзя считать поддерживаемым модулем композиции.
- **Primitive** — базовый UI-паттерн, которому нужен отдельный component/interaction contract, а не секция страницы.

| Catalog ID | Registry V1 | Runtime evidence | Реальная оценка |
|---|---|---|---|
| `hero` | Registered | Основной hero, CTA и responsive layout; тесты композиций | Implemented first slice |
| `key` | Registered | Данные преимуществ/характеристик отображаются через общий advantages UI; отдельный key section contract не доказан | Partial / shared |
| `gallery` | Registered | Gallery layout и approved media в основном runtime; тесты вариантов и mobile overflow | Implemented first slice |
| `about` | Registered | Registry направляет в `concept`; отдельный универсальный renderer и поведение не доказаны | Partial / shared |
| `territory` | Not registered | Самостоятельный renderer не найден | Not implemented |
| `security` | Registered | Registry направляет в общий `advantages` с evidence cards; самостоятельная security-секция не доказана | Partial / shared |
| `location` | Registered | Секция location и тест запрета декоративной карты как реальной | Implemented first slice; map limitations |
| `lifestyle` | Registered | Отдельная секция с approved stories/media capability gate | Implemented first slice; strict data gate |
| `quiz` | Not registered | Основной runtime имеет selection quiz с паспортными вопросами, ответами и CTA context; Registry V1 не регистрирует ID `quiz` | Runtime exists; composition gap |
| `gift` | Not registered | Самостоятельная выдача реального материала не подтверждена | Not implemented |
| `apartments` | Not registered | Основной runtime выводит проверенные планы, lightbox/dialog и контекст выбранного плана; Registry использует ID `floor-plans`, которого нет в каталоге под таким названием | Runtime exists; ID contract mismatch |
| `price` | Not registered | Есть ипотечный калькулятор, но отдельный актуальный price/price-list module не доказан | Partial; do not equate with calculator |
| `mortgage` | Registered | Visitor-input estimate calculator и свой следующий CTA; тест сценария | Implemented first slice; calculation assumptions must be explicit |
| `developer` | Not registered | Самостоятельный verified developer profile/documents module не найден | Not implemented |
| `progress` | Not registered | Хронология/датированные progress reports не найдены | Not implemented |
| `steps` | Not registered | Самостоятельный согласованный purchase journey module не найден | Not implemented |
| `faq` | Registered | Dedicated evidence-gated accordion in runtime; tests and approval capability | Implemented first slice |
| `contacts` | Registered | Registry maps to closing slot and requires approved KEY lead workflow; standalone contacts component not proven | Partial; CTA slot, not full contact module |
| `faq-legal` | Not registered | Legal FAQ/approved legal answer component not found | Not implemented |
| `footer-nav` | Not registered | No manifest-driven footer navigation contract found | Not implemented |
| `modal` | Not registered | Main runtime has lead dialog and plan preview dialog; not a general-purpose catalog module | Primitive / selected flows implemented |
| `lightbox` | Not registered | Plan preview dialog exists; gallery lightbox parity not established in current main runtime | Primitive / partial |
| `promo` | Not registered | No expiry-aware offer/promotion module found | Not implemented |
| `map` | Not registered | Location section exists, but browser test explicitly guards against treating decorative placeholder as a real map | Partial; no verified interactive map |

## 3. Contract mismatches requiring a decision

### 3.1. ID mismatch: apartments vs floor-plans

Каталог использует `apartments`, Registry V1 — `floor-plans`. Основной runtime умеет отображать планы, но генератор не должен требовать от стратегии неочевидный alias.

Решение: выбрать один canonical ID (предпочтительно `apartments`, поскольку он уже закреплён в продуктовой терминологии) и описать временный alias `floor-plans → apartments` с тестом совместимости и deprecation policy. Не переименовывать поля паспорта или runtime profile без миграционного плана.

### 3.2. ID mismatch: quiz vs selection

Каталог описывает `quiz`, основной runtime использует `selection` как секцию/offer context, а builder содержит alias mapping. Registry V1 не регистрирует `quiz` или `selection`.

Решение: зафиксировать canonical module ID `quiz`; внутренний runtime section ID `selection` оставить implementation detail. Добавить явный registry mapping и contract test.

### 3.3. Секции и примитивы смешаны в одном каталоге

`modal`, `lightbox` и `footer-nav` не эквивалентны секциям типа `gallery` или `location`. Им нужны component/interaction contracts, состояния, accessibility requirements и точки привязки, а не обычный section slot.

Решение: в каталоге ввести поле `kind: section | component | navigation | conversion` и соответствующие реестры/контракты. Не добавлять их в секционный Registry только ради совпадения числа ID.

### 3.4. Общий mapping не доказывает семантическое поведение

`key` и `security` используют общий advantages UI; `about` направляется в concept. Это может быть валидным решением композиции, но должно быть явно отражено в контракте: какие данные отображаются, какие UX-паттерны доступны, чем различается визуальная подача и как тестируется отсутствие дублирования.

Решение: для каждого alias/shared renderer описать `data contract`, `render contract`, `interaction contract` и правило merge. В тестах проверять не только composition ID, но и содержимое/поведение итогового DOM.

## 4. Приоритет реализации

### P0 — синхронизировать контракты до расширения каталога

1. Утвердить canonical IDs для `apartments` и `quiz`; добавить совместимые aliases.
2. Добавить machine-readable registry manifest и проверку покрытия: каждый catalog ID классифицирован как section/component/navigation/conversion и имеет явный статус.
3. Registry должен возвращать не только section IDs, но и полный composition plan: module ID, variant, slot/section, order, data requirements, capabilities, renderer component, CTA anchors.
4. Запретить молчаливый fallback на shared editorial renderer для модуля, чья семантика не реализована.
5. Добавить integration tests: manifest → registry → builder → DOM. Проверять видимое содержимое и ожидаемые действия, а не только массив composition.

### P1 — реализовать продуктовые пробелы в порядке бизнес-ценности

1. `territory` — если у объекта есть подтверждённая информация о дворе/благоустройстве.
2. `developer` и `progress` — если документы и датированные официальные материалы полезны для доверия.
3. `steps` — только после согласования реального процесса KEY.
4. `gift` — после появления реально доступного материала и механизма выдачи.
5. `price` и `promo` — только с актуальными данными, сроками и источниками.
6. `map` — после отдельного UI/data contract для проверенных координат/маршрутов.
7. `faq-legal` — после юридически утверждённых ответов.

Порядок не означает, что все эти модули обязательны каждому ЖК. Генератор должен включать их только при наличии пользовательской ценности, доказательств и работающего следующего действия.

## 5. Обязательные acceptance tests для следующего шага

- Для каждого catalog ID существует ровно одна явная классификация и статус реализации.
- Неизвестный ID/variant блокирует генерацию с понятной диагностикой.
- Alias ID разрешается в canonical ID без потери CTA/module context.
- Условный модуль с отсутствующими данными исключается с диагностикой; обязательный — блокирует генерацию.
- Для shared renderer проверяется, что два разных модуля не создают один и тот же дублирующий блок без причины.
- Для каждого включённого модуля проверяются фактическая секция/компонент в DOM, видимость, данные, CTA и мобильное поведение.
- Все ссылки CTA ведут в поддерживаемый сценарий; никакой CTA не маскируется под действие, которого нет.
- Review renderer и основной runtime используют одинаковые canonical IDs либо документированное преобразование.
- Каталог не объявляет модуль реализованным только потому, что для него существует schema/registry entry.

## 6. Ограничения доказательств

Эта матрица — source-level inventory на указанном commit. Упоминания в JS/HTML использовались только как ориентир для проверки; они не являются доказательством готового компонента. Для статуса Implemented требуется соответствующий тест поведения и/или ручная визуальная приёмка.

Связанный аудит: [KEY Landing Product Implementation Audit](KEY_LANDING_PRODUCT_IMPLEMENTATION_AUDIT_2026-11-07.md).  
Нормативные документы остаются: [KEY Landing Product Standard](../product/KEY_LANDING_PRODUCT_STANDARD.md) и [Module Catalog](../architecture/MODULE_CATALOG_AND_COMPOSITION_RULES.md).
