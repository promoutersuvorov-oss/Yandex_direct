# Agency: аудит реализации в ветках и решение о переносе кода

**Дата проверки:** 2026-11-05  
**Исходный репозиторий:** `nikitanecilli-bit/Agency`  
**Проверенный HEAD main:** `45cacd99dd0a828f17eb844e4aef92fd92e782c1`  
**Целевой репозиторий:** `promoutersuvorov-oss/Yandex_direct`

## 1. Важное уточнение к первому аудиту

В Agency нужно различать то, что реально находится в `main`, и то, что разработано в отдельных feature-ветках.

В `main` на момент проверки присутствуют K15 HTML, раздельные `project-config.k15.js` и `content-config.k15.js`, `PROJECT_CONFIG_TEMPLATE.js`, `scripts/build-project-config.py`, паспорт/схема и документация.

При этом следующие файлы **не находятся в main**, хотя перечислены в `docs/product/IMPLEMENTATION_AUDIT_2026-11-05.md` как существующие артефакты:
- `scripts/build-landing-bundle.py`;
- `scripts/package-landing-bundle.py`;
- `scripts/mortgage-calculator.js`;
- `scripts/ui-foundation.css`;
- `scripts/ui-foundation.js`;
- большая часть `tests/test_*.py`;
- workflow `key-landing-generator.yml`.

Они обнаружены в ветке `feat/illustrative-mortgage-calculator` и в зависимых ветках. Поэтому считать их готовой и интегрированной частью основного кода Agency нельзя.

## 2. Проверенная цепочка реализации Agency

| Ветка / PR | Что добавляет | Состояние на момент проверки |
|---|---|---|
| `feat/passport-adapter-v1-1` / PR #5 | Консервативный адаптер паспорта и его тесты | PR открыт, базовая ветка main |
| `feat/runtime-contract-qa` / PR #6 | Сборка review bundle, runtime contract tests, browser smoke tests | PR открыт, базируется на PR #5 |
| `feat/illustrative-mortgage-calculator` / PR #7 | Калькулятор, UI foundation, packaging, расширенные тесты и CI | PR открыт, базируется на PR #6 |
| `feat/interaction-contract-audit` / PR #31 | Дополнительный аудит контрактов ссылок и кнопок | Ветка построена поверх feature-цепочки |
| `test/cross-browser-ui-matrix` / PR #30 | Chromium / Firefox / WebKit coverage | Ветка построена поверх feature-цепочки |

PR #5 → #6 → #7 — зависимая последовательность, а не три независимых изменения. PR #5, #6 и #7 не слиты в main. Их нельзя считать готовым production-пайплайном только по наличию кода в feature-ветке.

## 3. Какие именно инженерные решения стоит перенести

### 3.1 Конвейер сборки — высокий приоритет

В feature-ветке реализован следующий сценарий:

`passport.json → schema validation → profile/content config → HTML bundle → asset checks → generation report → review ZIP`.

Ценно:
- сборка в отдельный каталог, не перезаписывая исходный шаблон;
- отдельные файлы профиля и контента;
- копирование только одобренных медиа;
- проверка путей медиа на traversal и выхода за каталог проекта;
- отчёт о пропущенных/неподдерживаемых данных;
- проверка соответствия включённых секций реальным `<section id>` в renderer;
- поиск маркеров эталонного ЖК в статическом тексте и исходнике;
- проверка локальных ссылок на существующие файлы;
- review bundle явно не объявляется production-ready.

**Решение:** перенести концепцию и требования в KLanding; новый адаптер писать под текущую схему KLanding. Не копировать legacy-скрипт целиком.

### 3.2 Publication readiness — высокий приоритет

Сборщик в feature-ветке создаёт machine-readable gates:
- schema validation;
- наличие project media;
- privacy notice;
- lead delivery endpoint;
- проверка claims и project copy;
- responsive visual QA.

Отдельно хранит blocked и pending gates и запрещает объявлять review bundle готовым к публикации.

**Решение:** принять этот подход как обязательный контракт generation report KLanding. Проверки должны иметь честные статусы `passed / failed / not_checked / not_applicable`; отсутствие проверки не должно трактоваться как успех.

### 3.3 Project profile и content separation — высокий приоритет

K15 HTML загружает `project-config.k15.js` и `content-config.k15.js`. Шаблон `PROJECT_CONFIG_TEMPLATE.js` разделяет:
- характеристики и позиционирование проекта;
- маркетинговые тексты;
- контентные массивы и медиа;
- интеграции и юридические URL.

Это правильное направление, но текущая структура KLanding уже богаче и имеет собственную схему паспорта. Нужно определить новый runtime contract, а не повторять старые ключи `KEY_PROJECT_PROFILE` и `KEY_PROJECT_CONTENT) без необходимости.

**Решение:** перенести принцип разделения слоёв; конкретный runtime JSON/JS contract спроектировать после аудита текущего renderer.

### 3.4 UI foundation — средний/высокий приоритет

В feature-ветке есть небольшой framework-free слой:
- общие motion tokens и safe-area CSS;
- pressed feedback для pointer/keyboard;
- reduced-motion awareness;
- обработка native dialog, Escape и возврата фокуса;
- базовая диагностика пустых ссылок.

**Ограничение:** этот слой не является полной системой доступности и не гарантирует корректность всех существующих модалок. Его нужно интегрировать после проверки совместимости с реальным KLanding renderer, не подключать механически.

**Решение:** использовать как исходный материал для общих UI primitives и тестов; не переносить как «готовое решение доступности».

### 3.5 Ипотечный калькулятор — средний приоритет

В feature-ветке есть изолированный калькулятор с редактируемой стоимостью, первоначальным взносом, ставкой и сроком. Если цена проекта не подтверждена, калькулятор просит пользователя ввести стоимость, а не подставляет вымышленное значение. Результат маркируется как предварительный, не банковское предложение.

**Решение:** сохранить этот паттерн. Перед переносом проверить UX, доступность, граничные значения и правила расчёта. Не делать калькулятор обязательной секцией для каждого ЖК.

### 3.6 Тесты и CI — высокий приоритет

Feature-ветка включает unit/contract tests для адаптера, bundle, publication readiness и UI foundation, а также Playwright smoke tests и матрицу Chromium/Firefox/WebKit.

**Решение:** перенести стратегию тестирования и независимые сценарии, но тестировать текущий renderer и его реальный контракт. Не копировать тесты, завязанные на legacy HTML/DOM IDs, как есть.

## 4. Почему прямой cherry-pick / копирование сейчас не выполняется

1. Legacy passport schema Agency не совпадает с текущей `schemas/project-passport.schema.json` KLanding.
2. Legacy adapter пишет старые profile/content config с иными полями и статусами.
3. Bundle builder ожидает старый K15 HTML, его ID секций и набор runtime ключей.
4. UI foundation опирается на native `<dialog>`, а текущие модалки K15 могут иметь собственную реализацию и жизненный цикл.
5. Калькулятор привязан к старому `#mortgage .wrap` и `KEY_PROJECT_PROFILE.vars.PRICE_FROM`.
6. В feature-цепочке есть незавершённые PR и разные уровни интеграции; перенос всей цепочки добавит legacy-контракты, а не готовый универсальный движок.

Это не отказ от полезного кода. Это защита от ложного ускорения, которое позже потребует переписывания адаптера и renderer.

## 5. Решение для KLanding

| Материал | Решение |
|---|---|
| Разделение passport / strategy / profile / content / integrations / runtime | Принять как архитектурный принцип |
| Сборка review bundle + generation report | Спроектировать под текущую схему и внедрить после runtime mapping |
| Media safety / project match / rights / expiry | Перенести правила и тест-кейсы |
| Section renderer contract | Перенести как обязательный build gate |
| Reference-project marker audit | Перенести и расширить для K15 и будущих эталонов |
| Publication readiness gates | Принять |
| UI foundation CSS/JS | Адаптировать после аудита существующего DOM и модалок |
| Mortgage calculator | Сохранить как необязательный модуль, перепроверить формулы/UX |
| Legacy schema, adapter, HTML selectors | Не переносить напрямую |

## 6. Следующая безопасная последовательность

1. Зафиксировать текущий runtime contract KLanding по фактическому HTML/JS.
2. Сопоставить паспорт KLanding с этим runtime и каталогом модулей.
3. Спроектировать минимальный profile/content/module manifest, не дублируя паспорт.
4. Реализовать адаптер, который выдаёт review-only bundle и generation report.
5. Добавить проверки медиа, секций, claims, K15 markers, ссылок и публикационных gates.
6. Проверить один синтетический второй ЖК, не содержащий K15-данных.
7. Только после этого решать, какие UI primitives и интерактивные модули переносить в runtime.

## 7. Проверенные ссылки на исходники

- [Agency main](https://github.com/nikitanecilli-bit/Agency/tree/main)
- [PR #5 — passport adapter](https://github.com/nikitanecilli-bit/Agency/pull/5)
- [PR #6 — runtime contract QA / bundle](https://github.com/nikitanecilli-bit/Agency/pull/6)
- [PR #7 — mortgage calculator / UI foundation](https://github.com/nikitanecilli-bit/Agency/pull/7)
- [Feature branch: illustrative mortgage calculator](https://github.com/nikitanecilli-bit/Agency/tree/feat/illustrative-mortgage-calculator)
