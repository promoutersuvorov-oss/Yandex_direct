# KEY Landing Module Registry V1

Статус: первый явный адаптер между стратегическими модулями паспорта и секциями существующего browser runtime. Не является универсальным конструктором произвольных секций.

## Принцип

Passport module ID описывает смысл и задачу блока. Runtime section ID описывает существующий UI-компонент. Они не считаются эквивалентными автоматически.

Registry обязан фиксировать:
- поддерживаемый исходный module ID;
- допустимый вариант модуля;
- целевой runtime section либо фиксированный slot;
- необходимые runtime capabilities;
- правила объединения нескольких модулей;
- ограничения и диагностику.

Неизвестный ID, неподдерживаемый variant или отсутствие обязательной возможности не должны исчезать молча.

## Mapping V1

| Passport module | Variant | Runtime target | Rule |
|---|---|---|---|
| hero | editorial-split | fixed hero slot | Hero всегда первый, не входит в composition |
| key | feature-led | fixed hero slot | Смысловой фокус hero; факты должны пройти claim gate |
| about | feature-led | concept | Одна редакционная секция |
| gallery | immersive | visual-story | Conditional: нужны одобренные фото/render assets |
| lifestyle | image-led | visual-story | Нужны одобренные assets; без них обязательный include блокирует сборку |
| security | proof-led | advantages | Только доказательные карточки с claim/source evidence |
| location | location-led | location | Не разрешает выводить неподтверждённые маршруты |
| floor-plans | plan-selector | apartments | Conditional: актуальный inventory и rights-cleared plan assets |
| mortgage | conversion-led | calculator | Требуются подтверждённые mortgage terms; generic user-input estimate не подменяет банковские условия |
| faq | faq-accordion | unsupported | В текущем runtime нет структурированного FAQ |
| contacts | conversion-led | fixed closing slot | Conditional: утверждённый реальный lead workflow |

## Merge rules

- Hero и Key могут сосуществовать в фиксированном hero slot; оба набора requiredFactIds проходят проверку.
- Gallery и Lifestyle могут использовать visual-story совместно только при наличии одобренных материалов.
- Security использует evidence-card renderer секции Advantages.
- Другие коллизии одной runtime section запрещены, если Registry явно не разрешает append.
- Closing — фиксированный элемент runtime; он не входит в переставляемую composition.

## Capability gates

- `approved-project-media`: минимум один опубликованный asset render/photo, с подтверждёнными правами и связью с текущим projectId.
- `current-inventory`: минимум одна прошедшая публикационные проверки планировка.
- `rights-cleared-plan-assets`: все используемые plan assets прошли asset gate.
- `verified-mortgage-terms`: актуальные подтверждённые финансовые условия. Пользовательский калькулятор с введённой ставкой не является доказательством этих условий.
- `approved-key-lead-workflow`: явно утверждённый рабочий процесс приёма и доставки лида, согласие и production integration. Наличие произвольного URL само по себе не доказывает готовность.

Для conditional-модуля недоступная capability приводит к warning и пропуску. Для обязательного include — к ошибке сборки. Это не позволяет silently downgrade выбранную стратегию.

## Реальное состояние паспорта КД «905»

- hero: допустим как фиксированный первый экран, но required claims должны быть publishable.
- key: допустим как смысловой фокус hero при подтверждении двух требуемых фактов.
- about: допустим как concept.
- gallery: conditional, сейчас пропускается до подтверждения прав на визуалы.
- lifestyle: обязательный image-led модуль. Без approved media сборка должна остановиться; нельзя подменять его текстовыми карточками без изменения стратегии.
- security: может использовать evidence-card renderer при подтверждённом факте о паркинге.
- location: допустим; неподтверждённые walking times не создаются.
- floor-plans: conditional, пропускается до актуальных планировок и прав.
- mortgage и FAQ: исключены стратегией.
- contacts: conditional и не production-ready до утверждения реального lead workflow.

## Runtime limitations

Registry V1 описывает только компоненты, реально существующие в `landing/runtime/index.html` и `app.js`. Он не добавляет новые UI-секции. Для полноценного Lifestyle, FAQ, contacts workflow или иных новых сценариев потребуется отдельная реализация компонентной библиотеки, а не переименование module ID.

## Tests

`tests/landing-module-registry-v1.test.mjs` проверяет mapping, variants, capability gates, collisions и fail-closed поведение.
