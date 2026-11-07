# Аудит: квалификация фактов внутри модулей KEY

Дата: 2026-11-07  
Ветка: `feature/universal-landing-runtime-v2`  
Статус: архитектурный вывод; реализация не включена в этот коммит

## Вывод

Нельзя расширять текущий механизм `claimQualifications` простым добавлением qualified Claims в общий `publishableFactIds`. Это создаст межмодульную утечку разрешений: факт, допущенный с оговоркой для одного блока, сможет пройти проверку в другом блоке, где сама оговорка не показана.

Текущая реализация правильно ограничивает квалификацию конкретным ключом рекламного текста. Builder проверяет, что:
- факт присутствует в `claimFactIds[copyKey]`;
- Claim имеет `epistemicStatus=verified`, `publicUse=allowed_with_qualification` и непустые `limitations`;
- для факта передан непустой текст оговорки;
- один факт и один Claim не дублируются в пределах copy key.

Оговорка переносится в `marketingQualifications[copyKey]`, а browser runtime выводит её рядом с соответствующим текстовым узлом. Существующие тесты подтверждают, что оговорка для `headline` не разрешает тот же Claim в `conceptCopy`, FAQ или инфраструктуре.

## Почему недостаточно добавить module-level allowlist

Passport `requiredFactIds` проверяются Module Registry отдельно от содержимого, которое затем формирует секцию. Модули используют разные каналы публикации:

| Модуль | Публичный канал | Что требуется для безопасной квалификации |
|---|---|---|
| hero / about / concept | Поля marketing copy | Привязать оговорку к точному copy key, реально отображаемому внутри секции |
| lifestyle | Утверждённые lifestyle stories и evidence | Оговорка должна быть привязана к конкретной story и supporting fact и показана рядом с соответствующим evidence |
| FAQ | Ответы, собранные из Claims | Оговорка должна быть привязана к конкретному factId внутри конкретного FAQ item и отрисована в ответе |
| location | POI + отдельное доказательство маршрута | Квалификация не заменяет маршрут. Нужны корректный POI, источник и route evidence; оговорка должна отображаться у конкретной точки |
| advantages / security | Evidence-карточки | Нужна оговорка в карточке рядом с тем Claim, который она ограничивает |

Особенно важно для Galiley: факты о школах и детских садах говорят о перечне застройщика и не подтверждают точные расстояния или пешеходные маршруты. Их квалификация не должна создавать маршрут или превращать их в карточки с расстоянием. Аналогично, разрешение на публикацию текста не заменяет approved media, lifestyle story или FAQ answer.

## Контракт, который следует реализовать

1. Сохранить текущий copy-level контракт без изменений и без глобального расширения `publishableFactIds`.
2. Добавить отдельные квалификации, адресованные конкретному содержимому, а не только moduleId. Минимальная адресация: `moduleId`, `contentId`, `factId`, `text`.
3. Валидировать, что `contentId` действительно существует в выбранном модуле, ссылается на тот же `factId`, а Claim verified, имеет источники/evidence, не просрочен и требует qualification.
4. Разрешать Claim только в пределах этого content item. Не менять глобальный статус Claim и не переносить разрешение в другие модули, преимущества, FAQ, инфраструктуру или маркетинговые поля.
5. Передавать qualification в runtime рядом с тем объектом, который её обосновывает; browser renderer обязан вывести её видимым текстом. Одного успешного gate недостаточно.
6. Если модуль ещё не умеет отображать такие оговорки, он остаётся заблокированным для qualified Claim. Это fail-closed, а не ошибка данных.
7. Разделить два результата диагностики: `claim_not_publishable` и `qualification_not_renderable_for_module`, с moduleId, contentId и factId. Не маскировать отсутствие маршрута, ассета или approved content оговоркой.

## Обязательные тесты перед внедрением

- qualified Claim заблокирован в модуле без module/content-scoped qualification;
- валидная qualification разрешает только один точный content item;
- qualification другого moduleId/contentId не даёт доступа;
- квалификация видимо присутствует в HTML/runtime-данных именно рядом с соответствующим утверждением;
- отсутствие asset/story/FAQ/route capability продолжает блокировать модуль независимо от qualification;
- истёкший, неподтверждённый, внутренний или конфликтующий Claim не проходит;
- для location qualification не создаёт distance/duration и не ослабляет требования к route evidence;
- существующие copy-level тесты остаются зелёными.

## Применение к Galiley

Текущий паспорт Galiley остаётся корректно заблокированным:
- hero и about содержат qualified required facts, для которых пока нет отдельной привязки к module content;
- lifestyle не имеет approved stories и project-matched rights-cleared assets;
- location не имеет точных route evidence, поэтому нельзя показывать расстояния/время;
- FAQ не имеет approved FAQ answers;
- конфликтующие сроки строительства и draft positioning остаются вне публикации.

Следующий кодовый шаг — не ослаблять gate, а ввести content-scoped qualification contract и renderer для конкретных модулей. До этого текущая диагностика и блокировка являются ожидаемым безопасным результатом.

## Проверенные точки реализации

- `src/landing-runtime-builder-v1.mjs`: copy-level qualification validation, generation of `marketingQualifications`, and module resolution.
- `src/landing-module-registry-v1.mjs`: required fact and capability gates.
- `landing/runtime/app.js`: visible rendering of copy-level qualifications; separate renderers for lifestyle, FAQ and infrastructure.
- `tests/landing-runtime-builder-v1.test.mjs`: negative tests preventing qualification leakage between copy keys, FAQ and infrastructure.
- `tests/landing-runtime-adapter.test.mjs`: canonical Galiley integration test verifies that unsupported variants are resolved but evidence/capability gaps still block the selected strategy.


## Implementation update (2026-11-07)

Implemented a first content-scoped qualification slice for `security` evidence cards and `lifestyle` stories:

- Passport schema and Landing Inputs normalizer preserve `contentStrategy.contentQualifications` entries (`moduleId`, `contentId`, `factId`, `text`).
- Builder requires the exact module to be selected, the exact content item to exist and be approved, and the fact to be one of that item's supporting facts.
- Only current, evidenced, verified Claims with `publicUse=allowed_with_qualification` and non-empty limitations can pass.
- The qualification is attached to the corresponding evidence item and rendered beside it; it is not added to global `publishableFactIds`.
- Duplicate fact/Claim qualifications and cross-item reuse are rejected by scope.
- FAQ retains its existing answer-item qualification path. Location/infrastructure remain deliberately unsupported for this contract: a qualifier cannot replace a verified route, distance method, or POI evidence.

Automated builder and normalizer tests were added. Full source-integrity and browser-matrix validation is still pending; this update is not a production-readiness claim.

## KD 905 primary-runtime follow-up

The primary runtime now treats a listed place and a route metric as separate publication outputs:

- A POI name is emitted only when its own `poi.listed_by_source` Claim is verified and has linked source/evidence. The runtime shows the source title and an explicit note that distance/route are not confirmed when no current project-scoped route exists.
- A distance or walking-time label is still emitted only from a separately validated route with current, linked source/evidence. A marketing-copy qualification cannot create or authorize a route metric.
- If a route is absent, stale, malformed or tied to another project, the place name may remain while its metric is omitted. The builder emits `POI_METRIC_NOT_PUBLISHED` with the POI ID.
- Blocked marketing candidates now emit `MARKETING_CANDIDATE_BLOCKED` with the candidate ID, legacy fact IDs, normalized Claim IDs and a reason. A POI whose existence proof is not publishable emits `POI_NOT_PUBLISHED` with its POI and Claim IDs.
- KD 905's parking fact has a qualification scoped to the exact `security/parking-functionality/underground-parking` evidence card. It does not make that Claim globally publishable or authorize it in hero, FAQ, location, or another card.

The primary-runtime browser fixture selects only the supported identity, qualified parking, and location modules; it preserves the original research passport's review composition. Chromium, Firefox and WebKit checks passed on run #725 before the follow-up source-note visual polish; the current branch's subsequent changes require a fresh full CI run. This is not a production-readiness or human design-approval statement.

