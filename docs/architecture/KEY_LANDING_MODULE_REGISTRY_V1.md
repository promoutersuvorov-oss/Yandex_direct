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
| lifestyle | image-led | lifestyle | Нужны отдельные утверждённые сценарии, подтверждённые claims и визуалы с правами для контекста lifestyle |
| security | proof-led | advantages | Только доказательные карточки с claim/source evidence |
| location | location-led | location | Не разрешает выводить неподтверждённые маршруты |
| floor-plans | plan-selector | apartments | Conditional: актуальный inventory и rights-cleared plan assets |
| mortgage | conversion-led | calculator | Требуются подтверждённые mortgage terms; generic user-input estimate не подменяет банковские условия |
| faq | faq-accordion | faq | Только вопросы с ответами из publishable claims и source evidence |
| contacts | conversion-led | fixed closing slot | Conditional: утверждённый реальный lead workflow |

## FAQ component

FAQ — самостоятельный accordion-компонент. Паспорт задаёт вопрос, `requiredFactIds` и `publicationStatus`. Без явного `approved` вопрос остаётся черновиком и не публикуется; свободный текст ответа не принимается. Builder публикует вопрос только когда все обязательные legacy fact IDs разрешаются в publishable Claims, а для каждого Claim найден источник с названием. Ответ состоит из точных значений Claims с указанием источников. `faq` требует capability `approved-faq-answers`; обязательный модуль без пригодных ответов блокирует сборку, conditional пропускается с warning.

## Lifestyle component

Lifestyle — самостоятельная редакционная секция, не галерея. Она состоит из карточек сценариев повседневной жизни. Каждая карточка задаётся в `contentStrategy.lifestyleStories` и содержит title, description, sceneLabel, assetId, supportingFactIds и publicationStatus. В runtime попадает только approved-сценарий, если каждый supportingFactId разрешается в publishable Claim, а изображение — в approved asset текущего проекта с подтверждёнными правами и `allowedContexts` содержащим `lifestyle`. Фактическое основание показывается в карточке. Builder не генерирует сценарии из голых характеристик.

## Merge rules

- Hero и Key могут сосуществовать в фиксированном hero slot; оба набора requiredFactIds проходят проверку.
- Gallery остаётся visual-story. Lifestyle рендерится отдельной секцией и не объединяется с галереей.
- Security использует evidence-card renderer секции Advantages.
- Другие коллизии одной runtime section запрещены, если Registry явно не разрешает append.
- Closing — фиксированный элемент runtime; он не входит в переставляемую composition.

## Capability gates

- `approved-faq-answers`: минимум один FAQ-вопрос, для которого все обязательные факты являются publishable Claims и имеют именованные источники.

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


## Module/content-scoped claim qualifications

The passport field contentStrategy.contentQualifications may attach a qualification to exactly one selected module, one content item and one supporting fact:

- moduleId: currently security or lifestyle;
- contentId: exact ID of a marketing candidate or approved lifestyle story;
- factId: must occur in that item's supportingFactIds;
- text: visible qualification rendered beside the corresponding evidence.

The builder accepts only current, evidenced, verified Claims with publicUse=allowed_with_qualification and non-empty limitations. The module must be explicitly selected with decision=include; the referenced content must exist and meet its own approval/media requirements. Duplicate fact or Claim qualifications within one content item are rejected.

The permission is not added to global publishableFactIds. It cannot authorize another card, another module, marketing copy, FAQ, location or infrastructure. FAQ retains its separate answer-item qualification contract. A module without a renderer for visible qualifications remains fail-closed.


## Content-scoped claim qualifications

`contentStrategy.contentQualifications` may qualify a claim only for one exact selected module, content item and supporting fact:
- `moduleId` is restricted to `security` or `lifestyle`;
- `contentId` must resolve to the corresponding marketing candidate or approved lifestyle story;
- `factId` must occur in that item's `supportingFactIds`;
- the claim must be current, verified, evidenced and marked `allowed_with_qualification`;
- qualification text must exactly match one of that claim's verified `limitations` entries.

The builder attaches the wording to the exact evidence item and the browser renderer displays it beside the claim/source. These IDs are passed to the registry as module-scoped publishable facts only; they are never added to global publication rights. Duplicate facts/claims in one content item, unselected modules, unrelated content and unapproved wording fail closed. This mechanism does not qualify arbitrary marketing prose or relax media-rights checks.
