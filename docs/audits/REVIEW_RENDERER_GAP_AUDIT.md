# Review Renderer: технический аудит и границы MVP

**Дата:** 2026-11-05  
**Статус:** проверка исходного кода; не является визуальным приёмочным тестированием production-лендинга.

## Вывод

Текущий `scripts/render-review-preview.mjs` доказывает, что паспорт и манифест могут быть преобразованы в HTML, а не только в JSON. Это полезный вертикальный срез конвейера. Но называть его полноценным генератором лендингов пока нельзя: сейчас это общий review-renderer с ограниченным набором данных и единым стилем.

## Что уже работает

- Читает `project-profile.json`, `module-manifest.json` и `generation-report.json`.
- Блокирует генерацию preview для заблокированного или production-ready отчёта.
- Собирает выбранные модули в последовательности манифеста.
- Выводит доступные подтверждённые факты, связанные преимущества, инфраструктуру и выбранные CTA.
- Выводит изображение, связанное с модулем через `assetIds`.
- Генерирует адаптивную HTML-страницу с базовым mobile breakpoint и `prefers-reduced-motion`.
- Не отправляет заявки и прямо сообщает об этом посетителю preview.
- CI генерирует страницу и проверяет её в Chromium, WebKit и Firefox (Firefox job в текущем запуске ещё устанавливает движок).

## Ограничения, подтверждённые чтением кода

1. **Модули визуально почти одинаковы.** `variant` выводится в подписи, но не управляет отдельной композицией. Визуальная уникальность ЖК пока не реализована.
2. **Рендерится только один первый asset на модуль.** Галереи, планировки как коллекция и разные типы медиа не получают собственного поведения.
3. **Специализированные инструменты отсутствуют.** Для `quiz`, `mortgage`, `apartments`, `faq` и `location` нет полноценных специализированных интерактивных компонентов; часть из них отображается как общий текстовый раздел.
4. **CTA не имеет сценария передачи контекста.** Preview показывает заголовок и модальное уведомление, но не собирает данные, не создаёт lead payload и не передаёт идентификаторы объекта/планировки/сценария.
5. **Hero использует позиционирование как заголовок и одновременно как вводный текст.** Это может приводить к дублированию; иерархия должна быть разделена на название/заголовок и позиционирование.
6. **Медиа-URL выводится в `src` после HTML-экранирования, но без отдельной проверки схемы URL в самом renderer.** Следующий hardening-шаг — разрешать только `https:` (и при обоснованной необходимости `http:`), а остальные схемы исключать.
7. **Нет отдельного визуального QA для каждого ЖК.** Проверка overflow и поведения диалога полезна, но не оценивает композицию, кадрирование, контраст, качество изображений, соответствие арт-дирекции и содержательную полноту.
8. **Публичный профиль включает активные offers из паспорта.** Перед production потребуется явная allowlist публичных полей offer, чтобы исключить случайный перенос внутренних полей.

## Что не следует делать сейчас

- Не подключать CRM и реальные персональные данные к review-preview.
- Не объявлять любой выбранный модуль реализованным только потому, что он прошёл renderer alias check.
- Не переносить композицию K15 целиком в универсальный renderer.
- Не добавлять десятки компонентов до определения контрактов данных и поведения для основных сценариев.

## Следующая последовательность работ

### P0 — исправить основу renderer

- Разделить hero title и positioning; исключить повтор текста.
- Валидировать media URL и безопасно исключать неподдерживаемые схемы.
- Публично сериализовать offers через allowlist полей.
- Добавить явный capability contract: `rendered`, `placeholder`, `unsupported`; не считать alias достаточным доказательством функциональности.

### P1 — три полноценных вертикальных сценария

1. **Hero + gallery:** несколько проверенных изображений, типы media, alt, подписи, мобильное кадрирование.
2. **Apartment plans:** карточки планировок, соответствие площади/комнат данным паспорта, CTA с контекстом конкретной планировки; не показывать наличие/цены без актуального inventory.
3. **Personal selection:** квиз с вопросами из стратегии, валидацией, прогрессом и сериализацией ответов; до CRM — локальный preview payload без отправки.

Эти три сценария дают более полезный MVP, чем поверхностная реализация всех типов секций.

### P2 — CTA contract и delivery boundary

- Для каждого CTA определить `scenarioId`, `projectId`, `moduleId`, `offerId`, `entityContext`, обязательные поля и consent requirements.
- Разделить UI success (пользователь завершил ввод) и delivery success (сервер подтвердил приём).
- Ошибка доставки всегда оставляет возможность повторить отправку и не показывает экран «заявка принята».

### P3 — production readiness

- Для ипотечных программ подключать только актуальные подтверждённые ставки и условия с источником, датой проверки и сроком действия; не превращать локальный калькулятор в обещание одобрения.
- Подключить интеграцию только после согласования endpoint, схемы payload, согласия на обработку данных и политики хранения.
- Проверить Android/iOS Safari/Chrome на реальных устройствах или достоверной device matrix.
- Провести визуальный аудит двух разных ЖК и убедиться, что результат отличается не только текстом и фотографиями.

## Definition of Done для следующего этапа

- Один и тот же renderer строит две визуально и композиционно разные страницы из двух паспортов.
- Неподтверждённые сведения и неразрешённые медиа не попадают в HTML.
- Планировка и CTA сохраняют точный контекст.
- Квиз собирает и валидирует ответы, но preview не отправляет персональные данные.
- Браузерные тесты проверяют не только отсутствие overflow, но и конкретные пользовательские сценарии.
- Production status остаётся закрытым до фактической проверки доставки лидов, consent, прав на медиа и визуального QA.


## Update 2026-11-05 — implemented after the initial audit

The review renderer now has a first set of specialized components and explicit data gates:

- **Hero:** project name is the primary heading; positioning is separate supporting copy and is not duplicated.
- **Gallery:** renders all approved assets explicitly assigned to the gallery module in a responsive mosaic.
- **Apartment plans:** passport now supports structured plan records (rooms, area, optional floor/finishing, asset reference, evidence, publication status). Only verified, non-expired records with an approved rights-cleared plan asset enter the public preview profile. Each plan CTA preserves its plan ID in the preview dialog.
- **Selection quiz:** passport now supports an approved, finite-choice quiz connected to an active offer. The preview validates required radio answers and keeps answers local; it does not transmit or collect contact details.
- **Media security:** approved public assets require HTTP(S) URLs. The renderer validates the URL again before creating an image element.
- **CTA privacy:** public offer objects are allowlisted; internal success copy is not copied into the public profile. Preview interactions never claim that a lead was delivered.

The browser CI now uses a clearly synthetic passport and local SVG assets to test the actual gallery, plan card and quiz interactions. This fixture is not a real ЖК and must never be used as a publication source.

The source-integrity job and the first cross-browser run after these changes should be treated as the release evidence for this incremental preview milestone; production readiness remains false. The renderer now includes a local annuity calculator that uses only visitor-entered assumptions. It still does not provide bank-integrated mortgage programs or production lead delivery, inventory availability, complete FAQ/navigation systems or the full visual art direction required by the product standard.
