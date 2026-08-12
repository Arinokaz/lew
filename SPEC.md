# Техническое задание: PWA для изучения английских слов (Oxford 5000)

> **Ревизия 2026-08-12:** все фазы **P0–P15** завершены, 165/165 тестов зелёные. Проект готов к публикации. План-файлы (`REFORM-PLAN.md`, `UI-REDESIGN-PLAN.md`, `UI-AUDIT-2.md`) подлежат удалению — их содержимое отражено в этом документе и в `AGENTS.md`.

## 1. Обзор проекта

**Название кодовое:** `lew` (Learn English Words)

**Суть продукта.** Автономное Progressive Web App для запоминания английских слов Oxford 5000 на основе алгоритма интервальных повторений SM-2 (как Anki). Все данные хранятся локально на устройстве пользователя, приложение полностью работоспособно в офлайне после первой загрузки. Целевая аудитория — сам заказчик, для персонального использования.

**Ключевые принципы:**

- **Offline-first.** После первой загрузки PWA работает без сети.
- **Локальность данных.** Никакого бэкенда, никакой синхронизации, никакой авторизации.
- **Простота стека.** Только нативные браузерные технологии, минимум зависимостей.
- **Научная база.** Алгоритм SM-2 доказал эффективность в Anki/SuperMemo.
- **Геймификация без перегруза.** Streak, ачивки, прогресс-бары — но без спама уведомлениями.

---

## 2. Цели и не-цели

### Цели

- Обеспечить ежедневную тренировку слов с интервальным повторением.
- Хранить прогресс и статистику между сессиями.
- Поддержать русский и украинский языки перевода.
- Поддержать US/UK произношение с фолбэком.
- Дать пользователю разные типы квизов от простого выбора до ввода с клавиатуры.
- Показывать видимый прогресс (streak, процент уровня, ачивки).
- Позволить резервное копирование прогресса (экспорт JSON).

### Не-цели

- Нет бэкенда, нет API, нет авторизации.
- Нет push-уведомлений.
- Нет многопользовательского режима.
- Нет синхронизации между устройствами.
- Нет облачного хранения.
- Нет интеграции с социальными сетями.
- Нет in-app purchases / подписок.
- Нет редактирования датасета из UI.

---

## 3. Стек технологий

### Frontend

| Слой | Технология | Обоснование |
|---|---|---|
| Базовый язык | **Vanilla JavaScript (ES2022+)** | Минимальный вес, нет магии, полный контроль |
| Модули | **ES Modules (native)** | Нативная поддержка в браузере, без бандлера |
| UI компоненты | **Web Components (Custom Elements + Shadow DOM опционально)** | Стандарт браузера, инкапсуляция стилей |
| Шаблоны | **HTML `<template>` + cloneNode** | Нативный, без зависимостей |
| Маршрутизация | **History API + собственный router** | Простой SPA без зависимостей |
| Стили | **Нативный CSS + CSS Custom Properties** | CSS Variables для тем, zero build |
| Иконки | **SVG inline или спрайт** | Без шрифтовых зависимостей |
| Анимации | **CSS transitions + Web Animations API** | Нативно |

### Хранилище

| Слой | Технология | Обоснование |
|---|---|---|
| Словарь + прогресс | **IndexedDB через Dexie.js** | Асинхронно, не ограничено 5 МБ (в отличие от LocalStorage), удобное API |
| Мелкие настройки (тема, язык UI, дневная норма) | **LocalStorage** | Синхронно, просто |
| Аудио | **Cache API (через Service Worker)** | Offline playback после первого прослушивания |
| Service Worker | **Нативный, без Workbox** | Полный контроль, минимум зависимостей |

### Tooling (только для разработки, не идёт в production)

| Задача | Инструмент | Обоснование |
|---|---|---|
| Dev-сервер | **`npx serve`** или `python3 -m http.server` | Никакого бандлера, никакого Vite |
| Unit-тесты | **`node --test`** (нативный test runner Node 18+) | Нулевая зависимость, встроен в Node |
| Линтинг (опционально) | **`eslint`** flat config | Минимальная конфигурация, не критично |

### Зависимости (vendor)

Только одна runtime-зависимость — **Dexie.js**. Она поставляется как готовый ESM-файл, размещённый в `/docs/src/vendor/dexie.min.mjs` (без npm install, без CDN в production).

### Принципы

- **Production — это статические файлы.** Никакой сборки, никакой транспайляции.
- **Все импорты — нативные ES modules с явными расширениями** (`./modules/db.js`).
- **Без npm в runtime.** Если нужна библиотека — кладём готовый файл в `/docs/src/vendor/`.
- **Без TypeScript.** Ради простоты; типы документируем в JSDoc-комментариях (опционально).

---

## 4. Датасет

### Источник

Файл `words.json` в корне репозитория — экспорт Oxford Learner's Dictionary 5000.

### Факты о датасете (вычислено)

- **Всего записей:** 5 948 (не 5 000 — Oxford дедуплицирует по сущностям, включая омонимы).
- **Размер файла:** 6.87 МБ.
- **Распределение по уровням CEFR:**

| Уровень | Количество |
|---|---|
| A1 | 1 076 |
| A2 | 992 |
| B1 | 903 |
| B2 | 1 573 |
| C1 | 1 404 |
| **C2** | **0** (нет в датасете) |

### Исходная структура (raw)

```json
{
  "id": 0,
  "value": {
    "word": "a",
    "translations": {
      "ru": "неопределённый артикль",
      "ua": "неозначений артикль"
    },
    "href": "https://www.oxfordlearnersdictionaries.com/definition/english/a_1",
    "type": "indefinite article",
    "level": "A1",
    "us": {
      "mp3": "https://www.oxfordlearnersdictionaries.com/.../a__us_2_rr.mp3",
      "ogg": "https://www.oxfordlearnersdictionaries.com/.../a__us_2_rr.ogg"
    },
    "uk": {
      "mp3": "https://www.oxfordlearnersdictionaries.com/.../a__gb_2.mp3",
      "ogg": "https://www.oxfordlearnersdictionaries.com/.../a__gb_2.ogg"
    },
    "phonetics": {
      "us": "/eɪ/",
      "uk": "/eɪ/"
    },
    "examples": [
      {
        "en": "I have a cat.",
        "ru": "У меня есть кот.",
        "ua": "У мене є кіт."
      }
    ]
  }
}
```

### Целевая структура в IndexedDB (после маппинга)

Поле `href` **не используется** (см. решение в обсуждении). Остальные поля переносятся 1:1, `value`-обёртка снимается:

```js
{
  id: 0,                              // primary key (из raw.id)
  word: "a",                          // string
  translations: {
    ru: "неопределённый артикль",
    ua: "неозначений артикль"
  },
  type: "indefinite article",         // часть речи
  level: "A1",                        // CEFR
  audio: {
    us_mp3: "https://...",
    us_ogg: "https://...",
    uk_mp3: "https://...",
    uk_ogg: "https://..."
  },
  phonetics: {
    us: "/eɪ/",
    uk: "/eɪ/"
  },
  examples: [
    { en: "I have a cat.", ru: "У меня есть кот.", ua: "У мене є кіт." }
  ]
}
```

### Особенности датасета

1. **Омонимы как отдельные записи.** Слово `about` встречается дважды: id 6 (adverb) и id 7 (preposition). Каждый `id` — отдельная независимая карточка со своим прогрессом. Это корректно отражает лексическую реальность: одно и то же написание — разные лексемы.
2. **Часть речи в `type`.** Английские значения (`noun`, `verb`, `adjective`, `adverb`, `preposition`, `indefinite article` и т.п.). Не переводим, отображаем как есть.
3. **Примеры содержат переводы.** Один и более объект с полями `en`/`ru`/`ua`. Используются в cloze-квизах.
4. **Фонетика дублируется.** `phonetics.us` и `phonetics.uk` могут совпадать (для слов, где акцент не различается).
5. **Аудио — внешние ссылки Oxford.** Кешируются лениво через Cache API.

### Процедура импорта

Однократно при первом запуске (или при сбросе):

1. Service Worker кеширует `words.json` при install.
2. На странице загрузки (`/onboarding`) клиентский код читает файл (из кеша, если офлайн).
3. Маппит каждую запись в целевую структуру.
4. Делает `db.words.bulkPut(mapped)` через Dexie.
5. Показывает прогресс-бар (импорт 6.87 МБ занимает ~2-5 сек).
6. После завершения — редирект на Dashboard.

Повторный импорт **не требуется**: IDB сохраняется между сессиями. Если нужно обновить датасет — кнопка "Reimport" в Settings (удаляет только таблицу `words`, прогресс привязан к `wordId`, поэтому сохранится).

---

## 5. Архитектура

### High-level

```
┌─────────────────────────────────────────────────────────┐
│                    PWA Shell (SPA)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  index.html │  │ manifest.json│  │ service-     │   │
│  │  + router   │  │              │  │ worker.js    │   │
│  └─────────────┘  └──────────────┘  └──────────────┘   │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                  ES Modules Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Components  │  │   Pages      │  │  Services    │   │
│  │  (Web Comp.) │  │  (SPA views) │  │  (logic)     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│           │                │                │             │
│           └────────────────┴────────────────┘             │
└──────────┬──────────────────────────────────────────────┘
           │
           ▼
┌──────────────────────────────────────────────────────────┐
│                Storage Adapters                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Dexie / IDB  │  │ LocalStorage │  │ Cache API    │   │
│  │  (words,     │  │  (settings,  │  │  (audio,     │   │
│  │   progress,  │  │   theme)     │  │   app shell) │   │
│  │   stats)     │  │              │  │              │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### Слои и зависимости

- **Pages** импортируют **Components** и **Services**.
- **Components** импортируют **Services** (никогда не обращаются к IDB напрямую).
- **Services** — единственная точка доступа к данным. Pages и Components через них.
- **Storage adapters** (`db.js`, `storage.js`, `audio-cache.js`) инкапсулируют API браузера.

Это правило критично: если компонент начинает напрямую вызывать `indexedDB.open()`, значит нужно вынести логику в сервис.

### Поток данных (пример: показать due-слова)

```
Page "Repeat"
  └─> Service "srs.js" — getDueWords(limit)
       └─> db.js — words.where('nextReview').below(today).limit(limit).toArray()
       └─> db.js — join with words table by wordId
       └─> return enriched WordProgress[]
  └─> Component <quiz-choice> — render(words)
       └─> Service "audio.js" — playAudio(word.audio)
            └─> audio-cache.js — fetch from Cache, fallback network
```

---

## 6. Структура проекта

```
/docs
  index.html                     # SPA shell
  manifest.json                  # PWA manifest
  service-worker.js              # SW: precache + runtime cache
  /icons
    icon-192.png
    icon-512.png
    maskable-icon-512.png
  /styles
    reset.css
    tokens.css                   # CSS variables (light/dark themes)
    base.css                     # Layout primitives
    components.css               # Web Component styles
  /data
    words.json                   # Исходный датасет (raw)
  /src
    /vendor
      dexie.min.mjs              # Vendored Dexie (ESM)
    /services
      db.js                      # Dexie instance + table accessors
      import.js                  # words.json → IDB mapper
      srs.js                     # SM-2 algorithm + due/new logic
      settings.js                # Settings: get/set, sync to LocalStorage
      stats.js                   # Statistics computations
      audio.js                   # Audio playback facade
      audio-cache.js             # Cache API wrapper for Oxford audio
      storage.js                 # LocalStorage wrapper
      i18n.js                    # UI strings: RU / UA / EN
      achievements.js            # Achievement unlock detection
      backup.js                  # Export/import JSON
      date.js                    # Day boundaries, today calculation
      random.js                  # PRNG + shuffle helpers
    /components
      app-shell.js               # <app-shell>: header + nav + outlet
      word-card.js               # <word-card>: displays one word
      quiz-choice.js             # <quiz-choice>: 4-option picker
      quiz-letters.js            # <quiz-letters>: tile builder
      quiz-input.js              # <quiz-input>: free typing
      quiz-cloze.js              # <quiz-cloze>: fill-in-the-blank
      audio-player.js            # <audio-player>: play/pause + accent
      progress-bar.js            # <progress-bar>: % bar with label
      streak-badge.js            # <streak-badge>: streak indicator
      stat-tile.js               # <stat-tile>: dashboard metric
      level-meter.js             # <level-meter>: CEFR progress
      toggle.js                  # <toggle>: switch component
      slider.js                  # <slider>: numeric range
      toast.js                   # <toast>: notifications
    /pages
      onboarding.js              # First-run import
      dashboard.js               # Home: stats + CTA
      learn.js                   # New words session
      repeat.js                  # SRS review session
      quiz.js                    # Free practice (any word)
      dictionary.js              # Browse all words
      stats.js                   # Detailed statistics
      settings.js                # Settings page
    router.js                    # History API router
    app.js                       # App bootstrap + service worker registration
/tests
  srs.test.js                    # SM-2 algorithm tests
  import.test.js                 # Mapping tests
  db.test.js                     # DB schema tests (with fake-indexeddb)
/tools
  vendor-dexie.sh                # One-off script to download Dexie
  serve.mjs                      # Dev-сервер (root = docs/, без билда)
  build.mjs                      # Опциональный esbuild-билд в dist/
package.json                     # Только для node:test runner + dev scripts
SPEC.md                          # Этот документ
AGENTS.md                        # Контекст для агентной разработки
```

### Правила организации

- **Pages** не импортируют напрямую друг друга.
- **Services** не импортируют **Components**.
- **Components** не импортируют **Pages**.
- **Pages** регистрируются в `app.js` по имени маршрута.
- Каждый **Page** экспортирует функцию `mount(rootEl)` и `unmount()`.
- Каждый **Service** — singleton, экспортируется как default.

---

## 7. База данных (Dexie.js)

### Схема (текущая: db.version(3).stores({...}))

```js
db.version(3).stores({
  // Словарь (импортируется один раз из words.json)
  words: 'id, word, level, type',

  // Прогресс SRS по каждому слову
  progress: 'wordId, nextReview, lastReview, points, lastTouchedDate',

  // Статистика по дням (для графиков)
  stats: 'date',

  // Достижения (разблокированы/нет)
  achievements: 'id, unlockedAt'
});
```

История миграций: v1 (исходная) → v2 (points-era: индексы `points`, `lastTouchedDate` в `progress`) → v3 (индекс `unlockedAt` в `achievements` для сортировки по `orderBy`). Миграция — через цепочку `db.version()` в Dexie.

**Замечания по индексам:**

- `words.id` — primary key.
- `words.word` — для поиска в словаре.
- `words.level` — для фильтрации по CEFR.
- `progress.wordId` — primary key (одна запись на слово).
- `progress.nextReview` — для выборки due-слов (`where('nextReview').below(now)`).
- `progress.points` — для фильтрации по стадиям (новые / active / mastered) и для подбора distractors.
- `progress.lastTouchedDate` — для исключения сегодняшнего пула из distractors и детекта смены интервального дня.
- `progress.lastReview` — для сортировки и аналитики.
- `stats.date` — primary key (формат `YYYY-MM-DD`).
- `achievements.id` — primary key.
- `achievements.unlockedAt` — индекс для сортировки разблокировок по времени.

### Таблица `words`

| Поле | Тип | Описание |
|---|---|---|
| `id` | `number` | Первичный ключ |
| `word` | `string` | Английское слово (lower-case) |
| `translations` | `{ ru: string, ua: string }` | Переводы |
| `type` | `string` | Часть речи (noun, verb, ...) |
| `level` | `string` | CEFR (A1, A2, B1, B2, C1) |
| `audio` | `{ us_mp3, us_ogg, uk_mp3, uk_ogg }` | Внешние URL |
| `phonetics` | `{ us, uk }` | IPA-транскрипция |
| `examples` | `Array<{ en, ru, ua }>` | Примеры предложений |

**Не хранится:** `href` (игнорируем при импорте).

### Таблица `progress`

| Поле | Тип | Default | Описание |
|---|---|---|---|
| `wordId` | `number` | — | Первичный ключ (= words.id) |
| `points` | `number` | `0` | **0–100**, основной показатель прогресса |
| `pointsAtIntervalStart` | `number` | `0` | Снапшот на начало интервального дня; пол отката |
| `accumulatedToday` | `number` | `0` | 0–20, очки в текущем интервальном дне |
| `wrongToday` | `number` | `0` | Кол-во ошибок в текущем интервальном дне |
| `lastTouchedDate` | `string \| null` | `null` | "YYYY-MM-DD", для детекта нового дня |
| `nextReview` | `number` | `Date.now()` | Timestamp следующего повторения |
| `lastReview` | `number \| null` | `null` | Timestamp последнего повторения |
| `EF` | `number` | `2.5` | Easiness factor (≥ 1.3). Используется только при `points >= 100` |
| `interval` | `number` | `0` | Интервал в днях (только для mastered) |
| `repetition` | `number` | `0` | Кол-во успешных повторений подряд (только для mastered) |
| `successCount` | `number` | `0` | Всего правильных ответов |
| `failCount` | `number` | `0` | Всего неправильных ответов |

**Стадия вычисляется из очков:** `stage = Math.floor(points / 20)`, макс. 5.

| Stage | Points | Фаза |
|---|---|---|
| 0 | 0 | Новое слово |
| 1 | 20 | Активное повторение |
| 2 | 40 | Активное повторение |
| 3 | 60 | Активное повторение |
| 4 | 80 | Активное повторение |
| 5 | 100 | **Mastered** (SM-2 long-interval) |

SM-2 поля (`EF`, `interval`, `repetition`) «спят» в активной фазе и активируются при достижении 100 pts.

### Таблица `stats`

| Поле | Тип | Описание |
|---|---|---|
| `date` | `string` | `YYYY-MM-DD` |
| `reviewed` | `number` | Слов повторено за день |
| `learned` | `number` | Новых слов выучено за день (достигли 20 pts) |
| `correct` | `number` | Правильных ответов |
| `wrong` | `number` | Неправильных ответов |
| `minutes` | `number` | Времени потрачено |
| `xp` | `number` | Очки опыта (см. геймификация) |
| `pointsEarned` | `number` | SRS-очки начисленные (без учёта штрафов за ошибки) |
| `stageUps` | `number` | Кол-во stage-up'ов за день |
| `audioTotal` | `number` | Lifetime аудио-квизов успешно пройдено (для ачивки `polyglot_audio`) |
| `maxSpeed` | `number` | Лучший результат правильных ответов в минуту за день (для ачивки `speed_demon`) |

### Таблица `achievements`

| Поле | Тип | Описание |
|---|---|---|
| `id` | `string` | Уникальный id (например, `first_word`) |
| `unlockedAt` | `number` | Timestamp разблокировки (индексирован) |
| `notified` | `boolean` | Показали ли тост пользователю |

### LocalStorage (мелкие настройки)

| Ключ | Тип | Описание |
|---|---|---|
| `theme` | `'light' \| 'dark' \| 'auto'` | Тема |
| `uiLang` | `'ru' \| 'ua' \| 'en'` | Язык интерфейса |
| `translationLang` | `'ru' \| 'ua'` | Язык переводов |
| `dailyNorm` | `number` | Новых слов в день (5/10/15/20/25), по умолчанию **15** |
| `repeatSessionSize` | `number` | Размер сессии в `/repeat` (10/15/20/50/100), по умолчанию **15** |
| `accent` | `'us' \| 'uk'` | Акцент по умолчанию |
| `activeLevels` | `string[]` | Активные уровни CEFR (по умолчанию все 5) |
| `soundEnabled` | `boolean` | Звуки квизов |
| `vibrationEnabled` | `boolean` | Вибрация (мобильные) |
| `firstLaunch` | `number \| null` | Timestamp первого запуска |
| `lastVisit` | `number` | Timestamp последнего визита |
| `streakLastDay` | `string \| null` | Последний день серии (`YYYY-MM-DD`) |
| `streakCount` | `number` | Кешированное значение текущей серии (избегаем пересчёта) |
| `learnDailyPool.<YYYY-MM-DD>` | `object` | Снапшот дневного пула слов (`getDailyLearnPool`): `{ quota, wordIds: number[] }`. Фиксируется на день, чтобы частичный прогресс утром не сбрасывался. Удаляется через 24 часа. |

### Миграции

Dexie позволяет миграции через `.version(N).upgrade(tx => {...})`. Текущая версия — **v3** (см. схему выше). Миграция с предыдущих версий не нужна, т.к. на момент рефактора реальных пользовательских данных нет.

---

## 8. Алгоритм SRS — Points-Based Hybrid

Активная фаза изучения (0–100 pts) использует **аккумулятор очков** с дневным капом. После того как слово достигает 100 pts (stage 5 / mastered), включается классический **SM-2** для длинных интервалов.

### Stage → points → расписание

| Stage | Points | Расписание |
|---|---|---|
| 0 | 0 | Новое слово, всегда доступно, в пуле `/learn` |
| 1 | 20 | `nextReview` = +1 день |
| 2 | 40 | +6 дней |
| 3 | 60 | +16 дней |
| 4 | 80 | +45 дней |
| 5 | 100 | **Mastered** — SM-2 long-interval (60→150→…capped 365) |

`STAGE_UP_INTERVALS = [null, 1, 6, 16, 45]` (индекс = новая стадия, 1–4).

### Quiz types и очки (`POINTS_FOR_QUIZ_TYPE`)

| Quiz type | SRS pts | XP (для геймификации) |
|---|---|---|
| `en-to-l1`, `l1-to-en`, `audio-to-en`, `cloze-choice` | **5** (easy) | 5 |
| `tile-l1-en`, `tile-audio-en` | **10** (medium) | 8 |
| `type-in`, `cloze`, `audio-type-in` | **20** (hard) | 10 |

Очки XP рассчитываются отдельной функцией `xpForQuizType(quizType, correct)` в `docs/src/services/quiz-factory.js` и **никогда не пишутся в `progress.points`** — они идут только в `stats.xp`.

### Дневной кап и правила

- **Кап на слово за реальный календарный день:** `+20 pts`. После достижения капа (например, на 4-м правильном ответе `en-to-l1` для стадии 1) выполняется `points += 20` (stage-up), `wrongToday = 0`, и **`accumulatedToday` остаётся равным 20** — слово **заморожено до конца дня**. Дальнейшие правильные или неправильные ответы возвращают `no-op-cap-reached` (кнопка всё ещё зеленеет, но очки не начисляются, штрафа нет).
- **Неверный ответ:** `-quizCost` из `accumulatedToday`. Пол = `0`. **Не уменьшает `points`** (которые монотонно растут в активной фазе). Не опускается ниже `pointsAtIntervalStart` — это гарантировано тем, что `points` сам только растёт.
- **3 ошибки на одно слово за реальный день** → `resetToNew`: `points = 0`, `successCount = 0`, `failCount = 0`, `lastReview = null`, `lastTouchedDate = today`. Слово возвращается в **новый пул** и обязано быть выучено заново сегодня (появится снова в `/learn` после сброса). Тихо удалено не будет.
- **Сброс капа при stage-up в том же дне не происходит.** Spaced repetition зависит от **времени между повторениями**, а не от утрамбовывания. Пользователь не может за один реальный день продвинуть несколько стадий, достигая капа за капом. После stage-up слово снова должно показываться только через `STAGE_UP_INTERVALS[newStage]` дней (1, 6, 16 или 45).
- **Если пользователь не достиг капа в день, когда слово должно было повториться:** `nextReview` остаётся на момент stage-up (он уже в прошлом), поэтому слово остаётся due (`nextReview <= now`) и появляется снова в `/repeat` в каждой следующей сессии, пока пользователь не закроет кап. Это намеренно: SM-2 работает только если пользователя заставляют вспоминать.
- **Mastered-слово с ошибкой (stage 5)** → сброс до `points = 80` (стадия 4, обратно в активную фазу), SM-2 поля сбрасываются к дефолтам, `nextReview = +1 день`.
- **Первый правильный ответ сразу после достижения stage 5** (`applyMastered`): это специальный случай — `repetition` инкрементируется 0→1, но **60-дневный начальный mastered-интервал сохраняется**. Без этого SM-2 с `q=5, repetition=0` сбросил бы интервал на 1 день, обнулив «долгосрочную награду». Последующие правильные ответы идут через обычный `sm2()`.

### SM-2 (только для mastered, `points >= 100`)

```js
export function sm2(card, q) {
  if (q >= 3) {
    if (card.repetition === 0) card.interval = 1;
    else if (card.repetition === 1) card.interval = 6;
    else card.interval = Math.round(card.interval * card.EF);
    card.repetition += 1;
    card.successCount += 1;
  } else {
    card.repetition = 0;
    card.interval = 1;
    card.failCount += 1;
  }

  card.EF = card.EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (card.EF < 1.3) card.EF = 1.3;
  if (card.interval > 365) card.interval = 365;

  card.lastReview = Date.now();
  card.nextReview = card.lastReview + card.interval * 86400000;
  return card;
}
```

### Grade mapping

Используем только две оценки:

| Исход | `q` |
|---|---|
| Правильно | `5` |
| Неправильно | `2` |

### Точка входа: `recordQuizResult(wordId, quizType, correct)`

Единая публичная функция, вызывается из `/learn` и `/repeat`. Обрабатывает обе фазы:

1. Открыть Dexie `rw`-транзакцию над `progress`.
2. Загрузить прогресс (или `createProgress(wordId)`).
3. Если `points >= 100` (`isMastered`) → mastered-путь: `applyMastered` (спец-кейс для первого правильного или обычный `sm2()`, или сброс в stage 4 при ошибке).
4. Иначе → active-путь: `normalizeProgress` (детект смены дня), затем `applyActive(quizType, correct)` — инкремент `accumulatedToday` к дневному капу, триггеры `stage-up` / `mastered` / `reset-to-new` / `reset-to-active`.
5. Сохранить, инвалидировать кеш `progress`, вернуть `{ progress, event }`, где `event` ∈ `progress | stage-up | mastered | reset-to-new | reset-to-active | no-op-cap-reached`.

Страницы передают `event` в `stats.recordReview` (геймификация) и в `achievements.checkAndUnlockAchievements`.

### Граничные случаи

- **Первое изучение нового слова:** любая активность создаёт `progress` с `points = 0`, `lastTouchedDate = today`.
- **Достижение 20 pts на новом слове:** stage-up до 1, `nextReview = +1 день`. Слово остаётся в дневной очереди для практики (0 pts за дальнейшие квизы).
- **Достижение 100 pts (stage-up до 5):** инициализируются SM-2 поля (`EF=2.5, interval=60, repetition=0`).
- **Mastered + правильный:** интервал растёт по SM-2 (60 → 150 → 360 → capped 365).
- **Mastered + неправильный:** `points = 80`, SM-2 поля сбрасываются до дефолтов, `nextReview = завтра`.
- **Граница дня:** локальная дата пользователя, не UTC. `lastTouchedDate` детектит смену интервального дня.
- **Кап 365 дней:** чтобы интервалы не уходили в бесконечность.

---

## 9. Логика дневной сессии

В приложении **три независимых режима**, у каждого своя страница. Пользователь свободно выбирает тип квиза в начале каждой сессии (`/learn` и `/repeat`), либо жёстко через интерфейс `/quiz`.

### `/learn` — новые слова (stage 0)

1. **Пул:** `getDailyLearnPool(activeLevels, dailyNorm)` возвращает до `dailyNorm` (по умолчанию 15) слов, находящихся на stage 0. Пул фиксируется на календарный день через LocalStorage-снапшот `learnDailyPool.<YYYY-MM-DD>`. Если снапшот есть и его `quota` совпадает с сегодняшним `dailyNorm`, используется он (частичный прогресс утра не теряется). Иначе — строится свежий пул через `getNewWordPool` (итерация по активным уровням от меньшего, приоритет частично пройденных stage-0 слов), снапшотится и возвращается.
2. **Выбор квиза:** пользователь выбирает любой из 9 типов в сетке 3×3; выбор действует в рамках сессии.
3. **Все слова пула** выдаются в очередь сессии.
4. **Per-word поток:**
   - Каждый правильный квиз: `accumulatedToday += quizCost` (кап +20 за реальный день).
   - Каждый неправильный: `accumulatedToday -= quizCost` (пол 0); `wrongToday += 1`. Если `wrongToday` дошёл до 3 → `resetToNew` (см. ниже).
   - Достигли `accumulatedToday >= 20` → stage-up до 1, `points += 20`, `nextReview = +1 день`, `accumulatedToday` **остаётся равным 20** (заморожено на сегодня). Слово «выпущено» — дальнейшие ответы сегодня возвращают `no-op-cap-reached`.
   - Частичный прогресс (напр. 15/20 на конец дня): слово сохраняет `points = 15`, остаётся в пуле на завтра (не в `/repeat`, потому что `points < 20` всё ещё stage 0).
   - Нетронутое новое слово на конец дня: остаётся в пуле (свежие не добавляются, пока пул < dailyNorm).
5. **3 ошибки на одно слово за реальный день** → `resetToNew` (`points = 0` и т.д.). Слово возвращается в **stage 0** и снова попадает в сегодняшний пул `/learn` — обязано быть выучено заново сегодня.

### `/repeat` — интервальные повторения (stages 1–4)

1. **Due-слова:** `progress.where('nextReview').below(now).and(p => p.points > 0 && p.points < 100)`.
2. **Сессия:** `getDueSession(activeLevels, repeatSessionSize)` возвращает случайные `repeatSessionSize` (по умолчанию 15, опции 10/15/20/50/100) слов из due-пула.
3. **Выбор квиза:** пользователь выбирает любой из 9 типов в рамках сессии.
4. **Per-word поток:**
   - При смене дня (`normalizeProgress`): `pointsAtIntervalStart = points`, `accumulatedToday = 0`, `wrongToday = 0`. **`nextReview` НЕ трогается** — он остаётся на момент stage-up до следующего stage-up.
   - Каждый правильный: `accumulatedToday = min(20, accumulatedToday + quizCost)`. Если кап достигнут → stage-up: `points += 20`, `wrongToday = 0`, `nextReview = now + STAGE_UP_INTERVALS[N]` дней. Слово скрывается из текущей очереди сессии.
   - Каждый неправильный: `accumulatedToday = max(0, accumulatedToday - quizCost)`, `wrongToday += 1`. Если `wrongToday >= 3` → `resetToNew`.
5. **Слово остаётся due в нескольких сессиях одного дня:** потому что `nextReview <= now` (он был выставлен в прошлый день и теперь в прошлом), слово продолжает появляться в `/repeat`, пока пользователь не закроет кап. Это by design — SM-2 полагается на принудительное воспоминание.
6. **Несколько сессий в день:** можно запустить ещё `repeatSessionSize` слов из того же due-пула, пока не исчерпан.

### `/quiz` — свободная практика (sandbox)

- Пользователь выбирает уровень CEFR, диапазон, тип квиза.
- **НЕ трогает таблицу `progress`.** Обновляется только `stats.xp`.

### Streak-проверка

При открытии Dashboard вызывается `refreshStreakOnVisit` (`docs/src/services/streak.js`):

1. Читаем `streakLastDay` и `lastVisit` из LocalStorage.
2. Считаем gap в календарных днях между `lastStreakDay` и сегодня:
   - `gap === 1`: смотрим `stats.reviewed` или `stats.learned` предыдущего дня; если больше нуля — инкремент streak, иначе streak = 1.
   - `gap > 1`: streak = 1.
   - тот же день или `lastStreakDay === null`: streak не меняется.
3. Сохраняем `streakLastDay = today`, обновляем `streakCount`, `lastVisit = today`.

### Идентификация «сегодня»

- «Сегодня» = локальная дата пользователя, не UTC. `docs/src/services/date.js#todayKey()` возвращает `"YYYY-MM-DD"` через `getFullYear/getMonth/getDate`.
- Все «интервально-дневные» границы (`lastTouchedDate` на `progress`, ключ строки `stats`, снапшот пула `learnDailyPool`) используют эту функцию.
- Для тестов `todayKey(date)` принимает объект `Date`, чтобы детерминированно замораживать время.

---

## 10. Типы квизов

Все 9 типов доступны на любой стадии; пользователь выбирает свободно в рамках сессии.

### Классификация по сложности и очки

| # | Ключ | Стимул → Ответ | Сложность | Pts |
|---|---|---|---|---|
| 1 | `en-to-l1` | EN слово → L1 перевод (4-выбор) | easy | 5 |
| 2 | `l1-to-en` | L1 перевод → EN слово (4-выбор) | easy | 5 |
| 3 | `audio-to-en` | 🔊 аудио → EN слово (4-выбор) | easy | 5 |
| 4 | `cloze-choice` | Пример с пропуском + 4 варианта | easy | 5 |
| 5 | `tile-l1-en` | L1 перевод → EN слово (тайлы) | medium | 10 |
| 6 | `tile-audio-en` | 🔊 аудио → EN слово (тайлы) | medium | 10 |
| 7 | `type-in` | L1 перевод → EN слово (ввод) | hard | 20 |
| 8 | `cloze` | Пример с пропуском (ввод) | hard | 20 |
| 9 | `audio-type-in` | 🔊 аудио → EN слово (ввод) | hard | 20 |

Дневная норма = 20, кап/день на слово = +20.

### Генерация distractors (неправильных вариантов)

Для квизов 1–4 нужны 3 неправильных варианта. Правила:

- **Исключаются:** слова с `lastTouchedDate === today` (сегодняшний пул — избегаем интерференции).
- **Предпочитаются:** слова с `progress.points >= 40` (выученные — re-exposure укрепляет старую память).
- Тот же уровень CEFR (обязательно).
- Та же часть речи (`type`) когда возможно.
- Для аудио-квизов: prefer distractors с Levenshtein ≤ 3 от правильного слова.

### Компоненты квизов

| Компонент | Используется квизами |
|---|---|
| `<quiz-choice>` | `en-to-l1`, `l1-to-en`, `audio-to-en` |
| `<quiz-letters>` | `tile-l1-en`, `tile-audio-en` |
| `<quiz-input>` | `type-in`, `audio-type-in` |
| `<quiz-cloze>` | `cloze`, `cloze-choice` (один компонент, режим options vs input) |

### Cloze fallback

Если у слова нет `examples[0]` или слово не находится как `\b…\b` в его примере:
- `cloze` → деградирует до `type-in`
- `cloze-choice` → деградирует до `en-to-l1`

### Логика оценки

| Тип | Правильный ответ | Неправильный |
|---|---|---|
| 1, 2, 3, 4 | Клик на правильный вариант | Клик на другой |
| 5, 6 | Все буквы на местах, нажат Submit | Не все правильные или лишние |
| 7, 9 | Строгое сравнение строки после trim + lowercase | Любое другое |
| 8 | Правильное слово вписано в пропуск | Другое |

### Клавиатурные шорткаты

- `1`, `2`, `3`, `4` — выбор варианта (для типов 1–4).
- `Enter` или `Space` — Submit / Continue.
- `Esc` — Skip.
- `A` — воспроизвести аудио.

### UI каждого квиза

Общий шаблон:

```
┌─────────────────────────────┐
│  Прогресс сессии: 7/15  ▓▓▓░│
├─────────────────────────────┤
│                             │
│  [Задание]                  │
│                             │
│  [Вариант 1] [Вариант 2]   │
│  [Вариант 3] [Вариант 4]   │
│                             │
├─────────────────────────────┤
│ [Skip]   [🔊 Play]   [Next] │
└─────────────────────────────┘
```

После ответа:

- Зелёная подсветка правильного.
- Красная — выбранного неправильного.
- Кнопка Continue (Enter).

### Клавиатурные шорткаты

- `1`, `2`, `3`, `4` — выбор варианта (для типов 1-3, 8).
- `Enter` или `Space` — Submit / Continue.
- `Esc` — Skip.
- `A` — воспроизвести аудио.

---

## 11. Геймификация

### XP (опыт)

XP — отдельная метрика от SRS-очков. Начисляется во всех режимах, включая `/quiz` (sandbox). Значения рассчитываются функцией `xpForQuizType(quizType, correct)` в `docs/src/services/quiz-factory.js`:

| Действие | XP |
|---|---|
| Правильный ответ на `type-in` / `cloze` / `audio-type-in` | 10 |
| Правильный ответ на `tile-l1-en` / `tile-audio-en` | 8 |
| Правильный ответ на `cloze-choice` | 7 |
| Правильный ответ на `en-to-l1` / `l1-to-en` / `audio-to-en` | 5 |
| Неправильный ответ | 1 (за попытку) |
| Завершение sandbox-сессии `/quiz` | 25 бонус |

При входе на Dashboard начисляется дополнительный бонус, пропорциональный текущему streak (`+1 × streak`).

### SRS-очки (`stats.pointsEarned`)

Отдельно от XP, считаем накопленные SRS-очки (только в `/learn` и `/repeat`):
- За правильный квиз: +`quizCost` (5/10/20, см. `POINTS_FOR_QUIZ_TYPE`).
- За неправильный: 0 (не вычитаем из статистики, штраф применяется только в `progress`).
- Stage-up: инкремент `stageUps`.

`/quiz` не добавляет в `pointsEarned` и не трогает `progress` (sandbox режим).

### Streak

- Хранится в LocalStorage: `streakLastDay` (`YYYY-MM-DD`), текущее значение — в `streakCount` (кеш, чтобы не пересчитывать на каждой странице).
- Алгоритм `refreshStreakOnVisit`:
  - `gap = 0` (тот же день) или `streakLastDay === null` → ничего не делаем.
  - `gap === 1` → проверяем `stats` предыдущего дня: `reviewed > 0 || learned > 0`? streak++ : streak = 1.
  - `gap > 1` → streak = 1.
- Воскресенье не «защитное» — пропуск обнуляет серию (как в Duolingo).
- Мотивация: streak виден на Dashboard большим шрифтом, при пропуске — угрызения совести через цвет.

### Ачивки

| ID | Условие | Иконка |
|---|---|---|
| `first_word` | Первое слово достигло 20 pts (stage 1) | 🎯 |
| `streak_3` | Streak 3 дня | 🔥 |
| `streak_7` | Streak 7 дней | 🔥🔥 |
| `streak_30` | Streak 30 дней | 🔥🔥🔥 |
| `streak_100` | Streak 100 дней | 🏆 |
| `words_10` | 10 слов освоено (`points >= 100`) | 📚 |
| `words_50` | 50 слов освоено | 📖 |
| `words_100` | 100 слов освоено | 📕 |
| `words_500` | 500 слов освоено | 🎓 |
| `words_1000` | 1000 слов освоено | 👑 |
| `level_a1_done` | Все A1 освоены (100 pts) | 🥉 |
| `level_a2_done` | Все A2 освоены | 🥈 |
| `level_b1_done` | Все B1 освоены | 🥇 |
| `level_b2_done` | Все B2 освоены | 💎 |
| `level_c1_done` | Все C1 освоены | 🏅 |
| `polyglot_audio` | 50 аудио-квизов пройдено | 🎧 |
| `speed_demon` | 20 правильных ответов за 60 секунд | ⚡ |
| `points_100_day` | 100 SRS-очков за один день | ⭐ |
| `points_500_day` | 500 SRS-очков за один день | 🌟 |

**«Освоено»** = `points >= 100` (stage 5, mastered).

При разблокировке — toast в углу + запись в `achievements`. Уже показанные помечаем `notified: true`.

### Прогресс-бар уровня CEFR

На Dashboard для каждого активного уровня — две метрики:
- Выучено (points >= 100): "612 / 1076 (56%)"
- В процессе (0 < points < 100): "+34 in progress"

### Вибрация (мобильные)

При неправильном ответе — короткая вибрация (100мс) через `navigator.vibrate(100)`. Только если `vibrationEnabled === true` и устройство поддерживает.

### Звуки

Через `<audio>` элементы:

- `correct.mp3` — короткий positive click
- `wrong.mp3` — низкий buzz
- `complete.mp3` — успешный chime

Только если `soundEnabled === true`. Дефолт: true.

---

## 12. Страницы приложения

### Карта маршрутов

| Маршрут | Page | Описание |
|---|---|---|
| `/` | Dashboard | Главная: streak, прогресс, CTA |
| `/onboarding` | Onboarding | Первый запуск (импорт) |
| `/learn` | Learn | Новые слова сегодня |
| `/repeat` | Repeat | Due-слова |
| `/quiz` | Quiz | Свободная тренировка |
| `/dictionary` | Dictionary | Браузер всех слов |
| `/stats` | Stats | Подробная статистика |
| `/settings` | Settings | Все настройки |

### Страница Dashboard

**Контент:**

- Большой streak (число + 🔥 иконка).
- Кнопка «Учить сегодня» (CTA).
- Список due: «X слов ждут повторения».
- Список new: «Y новых слов в норме».
- Прогресс по уровням CEFR (компактные прогресс-бары).
- Последние ачивки (3 последние).

**Empty state (всё сделано):** «Все слова на сегодня пройдены! Возвращайся завтра 🌟» + кнопка «Потренироваться» (→ /quiz).

### Страница Onboarding

**Шаги:**

1. Приветствие: «PWA для запоминания английских слов».
2. Выбор языка интерфейса (RU / UA / EN).
3. Выбор языка перевода (RU / UA).
4. Выбор дневной нормы (slider).
5. Импорт датасета (прогресс-бар).
6. Готово! → Dashboard.

### Страница Learn (новые слова)

- Показывает пул новых слов: `getNewWordPool(activeLevels, dailyNorm)` — до `dailyNorm` слов (по умолчанию 15).
- **Перед стартом сессии:** пользователь выбирает тип квиза из 9 доступных (сетка 3×3).
- В очереди все слова текущего пула.
- На каждом слове надо набрать 20 pts для stage-up.
- Достигли 20 pts → слово остаётся в очереди (greyed-out «graduated»), но дальнейшие квизы дают 0 pts.
- Частичный прогресс (напр. 15/20) сохраняется на завтра.
- 3 ошибки на слово за день → сброс `points = 0` (всё ещё новое).

### Страница Repeat (повторения)

- Показывает due-слова (stages 1–4).
- **Перед стартом сессии:** пользователь выбирает тип квиза из 9 доступных + видит размер сессии (`repeatSessionSize`).
- Сессия = `repeatSessionSize` случайных слов из due-пула.
- На интервальном дне надо набрать 20 pts для stage-up.
- Stage-up → слово скрывается из очереди, расписание следующего интервала.
- После сессии: кнопка «Следующая порция (N due осталось)», если due-пул не исчерпан.

### Страница Quiz (свободная тренировка)

- Пользователь выбирает: уровень CEFR, диапазон (только изученные / все), тип квиза.
- **Не влияет на SRS:** не вызывает `recordQuizResult`, не пишет в `progress`.
- Начисляется только `stats.xp` для геймификации.
- Безопасный режим для повторения без последствий.

### Страница Dictionary

- Поиск по слову или переводу (debounce 200мс).
- Фильтры: уровень CEFR, часть речи, статус (новое / в обучении / mastered).
- Виртуальный скролл (все 5948 в одном списке).
- Клик на слово → детальная карточка + кнопка «Oxford» (откроет `href` в новой вкладке, если нужен интернет). В нашей реализации ссылка `href` не используется, но это можно добавить опционально.

### Страница Stats

- Графики: слов в день (line chart), правильных/неправильных (bar chart), streak history.
- Суммарно: всего слов освоено, время потрачено, XP.
- Ачивки — полный список (заблокированные серым).

### Страница Settings

Все параметры из раздела LocalStorage + опасная зона:

- Экспорт прогресса (скачивает JSON).
- Импорт прогресса (загружает JSON, подтверждение).
- Сброс прогресса (двойное подтверждение).
- Переимпорт датасета.
- Удалить все аудио из кеша (освободить место).

---

## 13. Настройки (Settings)

### UI

- Группировка: «Обучение», «Внешний вид», «Данные».
- Каждая настройка сохраняется мгновенно (autosave).

### Список настроек

**Обучение:**

- Язык перевода (RU / UA) — radio.
- Дневная норма новых слов (5/10/15/20/25) — slider. По умолчанию **15**.
- Размер сессии в повторениях (10/15/20/50/100) — slider. По умолчанию **15**.
- Активные уровни CEFR (multi-checkbox: A1, A2, B1, B2, C1).
- Акцент по умолчанию (US / UK) — radio.
- Звуки в квизах (toggle).
- Вибрация (toggle, только mobile).

**Внешний вид:**

- Тема (light / dark / auto) — radio.
- Язык интерфейса (RU / UA / EN) — radio.

**Данные:**

- Экспорт прогресса → кнопка.
- Импорт прогресса → кнопка + file input.
- Переимпорт датасета → кнопка + подтверждение.
- Очистить кеш аудио → кнопка.
- Сбросить весь прогресс → кнопка + двойное подтверждение.

### Defaults

```js
{
  theme: 'auto',
  uiLang: 'ru',          // первый запуск
  translationLang: 'ru',
  dailyNorm: 15,         // новых слов в день
  repeatSessionSize: 15, // слов за одну сессию в /repeat
  accent: 'us',
  activeLevels: ['A1', 'A2', 'B1', 'B2', 'C1'],
  soundEnabled: true,
  vibrationEnabled: true
}
```

---

## 14. PWA

### `manifest.json`

```json
{
  "name": "Learn English Words — Oxford 5000",
  "short_name": "LEW",
  "description": "Интервальное повторение английских слов Oxford 5000",
  "start_url": "./",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "icons/maskable-icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "categories": ["education", "productivity", "books"]
}
```

### `service-worker.js`

**Стратегии кеширования:**

| Ресурс | Стратегия | Причина |
|---|---|---|
| App shell (HTML, CSS, JS, vendor) | **Precache** при `install` | Критично для офлайн |
| `words.json` | **Precache** при `install` | Большой, но нужен сразу |
| Аудио Oxford | **Cache-first** + network fallback | Ленивая загрузка |
| `manifest.json`, иконки | **Precache** | Маленькие, нужны для установки |

**Версионирование кеша:**

```js
const CACHE_VERSION = 'v1';
const APP_CACHE = `lew-app-${CACHE_VERSION}`;
const AUDIO_CACHE = `lew-audio-${CACHE_VERSION}`;
const DATA_CACHE = `lew-data-${CACHE_VERSION}`;
```

**Lifecycle:**

- `install`: precache app shell + `words.json`. `skipWaiting()`.
- `activate`: удалить старые кеши. `clients.claim()`.
- `fetch`:
  - `/styles/*`, `/icons/*`, `/src/*`, `index.html` → cache-first.
  - `words.json` → cache-first (он в DATA_CACHE).
  - Audio URL (Oxford CDN) → cache-first с fallback network, кладём в AUDIO_CACHE.

### Регистрация

В `app.js` (только в production или по условию):

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js');
  });
}
```

В dev-режиме (без SW) работает обычная загрузка через network.

---

## 15. Стратегия кеширования аудио

### Принцип: ленивая загрузка

Аудио **не предзагружается** для всех 5948 слов (это сотни МБ). Вместо этого:

1. При первом запросе URL аудио → SW проверяет AUDIO_CACHE.
2. Если нет → fetch из сети → сохраняет в AUDIO_CACHE → возвращает.
3. Если сети нет и в кеше ничего → возвращает ошибку (UI показывает «🔇 Аудио недоступно в офлайне, нужно подключение к сети при первом прослушивании»).

### Формат аудио

Каждое слово имеет 4 URL (us_mp3, us_ogg, uk_mp3, uk_ogg). Браузер сам выберет поддерживаемый формат через `<audio>` с `<source>`. Предпочитаем mp3 (лучшая поддержка).

```html
<audio>
  <source src="${audio.us_mp3}" type="audio/mpeg">
  <source src="${audio.us_ogg}" type="audio/ogg">
</audio>
```

### Предзагрузка уровня (опционально)

В Settings → кнопка «Предзагрузить аудио для активных уровней». Делает fetch всех URL → кеширует. Показывает прогресс. Это для тех, кто хочет полный офлайн заранее.

### Лимиты

Cache API в браузерах: обычно 50-100% от свободного места. Для аудио 5948 слов ≈ 30-50 МБ. Не критично.

---

## 16. UX требования

### Mobile-first (целевое устройство — телефон)

- Дизайн начинается с мобильного (база ≥320px), расширяется `min-width` на 480 / 600 / 768 / 1024 px.
- **Безопасные зоны:** `env(safe-area-inset-*)` через токены `--safe-top/--safe-bottom/--safe-left/--safe-right` на шапке, навигации и краях. `viewport-fit=cover` уже включён в `index.html`. Шапка не уходит под чёлку, навигация — под home-indicator.
- **Touch-таргеты** минимум `--tap-min` (44×44 px). У каждого интерактивного элемента есть `:active` и `:focus-visible`.
- Никаких hover-only фич; под `@media (pointer: coarse)` hover-эффекты отключаются.
- **Навигация «5 + Ещё»:** в нижнем меню — Home, Learn, Repeat, Quiz, Stats; Dictionary и Settings — в меню «Ещё» (шапка). На ≥1024px — левый sidebar со всеми пунктами.
- **Иконки — inline SVG** через компонент `<lew-icon name="...">` (`currentColor`, размеры 16/20/24). Emoji в навигации и UI не используем (платформенно-зависимый рендер).
- **Диалоги подтверждения** — через кастомный компонент `<lew-dialog>` (focus trap, safe-area, закрытие по Esc/overlay). Нативные `confirm()` не используем.
- Подсказки клавиатуры `(Esc)`/`(Enter)` показываем только под `@media (hover: hover) and (pointer: fine)`.
- `prefers-reduced-motion: reduce` — отключаем ненужные анимации.
- Единый источник стилей — `docs/styles/*.css`. Никаких инжектируемых `<style>` из JS и inline-`style=""` (кроме динамических `width:%`/`height:%`).

### Темы

- Light: белый фон, тёмный текст.
- Dark: тёмный фон (#0f172a), светлый текст.
- Auto: переключение через `prefers-color-scheme`.
- Все цвета через CSS Variables в `/styles/tokens.css`.

### Accessibility (a11y)

- Все интерактивные элементы доступны с клавиатуры (tabindex, focus, видимый `:focus-visible` ring).
- ARIA-labels для иконок-кнопок; `role="dialog" aria-modal="true"` на модалках.
- Контрастность текста ≥ WCAG AA (4.5:1).
- Live regions для динамического контента (счётчик прогресса, тосты).

### Производительность

- Lazy load компонентов (динамический `import()`).
- Виртуальный скролл / бесконечная лента (`IntersectionObserver`) в Dictionary.
- Debounce поиска (200мс).
- Минимум reflow в квизах.
- Service Worker запускается только после `load`.

### Производительность в квизах

- Не блокировать UI при записи в IDB (всё асинхронно через Dexie).
- Показывать следующую карточку сразу после Continue (не ждать записи).
- Запись в фоне (можно через `requestIdleCallback`).

---

## 17. Тестирование

### Что тестируем

| Модуль | Тип теста | Инструмент |
|---|---|---|
| `srs.js` (SM-2) | Unit | `node --test` |
| `import.js` (маппинг JSON) | Unit | `node --test` |
| `stats.js` (подсчёты) | Unit | `node --test` |
| `achievements.js` (условия) | Unit | `node --test` |
| `random.js` (shuffle) | Unit | `node --test` |
| `db.js` (схема) | Integration | `node --test` + `fake-indexeddb` |
| Pages / Components | Manual E2E | Браузер, ручная проверка |

### Тесты SRS / points-модели (примеры)

```js
test('new word accumulates points across quizzes', () => {
  // 4 лёгких квиза (5 pts × 4) = 20 pts → stage-up to 1
  let p = createProgress(1);
  for (let i = 0; i < 4; i++) p = applyCorrect(p, 'en-to-l1');
  assert.equal(p.points, 20);
  assert.equal(p.nextReview, /* +1 day */);
});

test('hard quiz closes daily cap in one shot', () => {
  let p = createProgress(1);
  p = applyCorrect(p, 'type-in');  // 20 pts
  assert.equal(p.points, 20);
});

test('wrong answer does not drop below pointsAtIntervalStart', () => {
  let p = { points: 40, pointsAtIntervalStart: 40, accumulatedToday: 0 };
  p = applyWrong(p, 'type-in');  // -20
  assert.equal(p.points, 40);  // not 20
  assert.equal(p.accumulatedToday, 0);
});

test('3 wrong in one interval day resets to new', () => {
  let p = { points: 40, pointsAtIntervalStart: 40, accumulatedToday: 0, wrongToday: 0 };
  p = applyWrong(p, 'en-to-l1');  // wrongToday=1
  p = applyWrong(p, 'en-to-l1');  // wrongToday=2
  p = applyWrong(p, 'en-to-l1');  // wrongToday=3 → reset
  assert.equal(p.points, 0);
});

test('mastered + wrong drops to stage 4 (80 pts)', () => {
  let p = { points: 100, EF: 2.5, interval: 60 };
  p = applyWrong(p, 'en-to-l1');
  assert.equal(p.points, 80);
});
```

### Запуск тестов

```bash
node --test tests/
```

Все тесты должны проходить перед коммитом.

### Coverage (опционально)

Если хочется coverage — `c8`:

```bash
npx c8 --reporter=text node --test tests/
```

---

## 18. Производительность и оптимизации

### Загрузка IDB

- **Не читать все 5948 слов сразу.** Pages запрашивают только нужные.
- Для словаря — пагинация по 50 штук.
- Для дашборда — только агрегаты (считаются в фоне).

### Маппинг при импорте

Один `bulkPut` через Dexie. 5948 записей — ~3-5 сек. Показываем прогресс-бар.

### Кеш слов в памяти

`Map<wordId, Word>` в `db.js` — ленивый LRU-кеш на 200 слов. Ускоряет повторные обращения в той же сессии.

### Аудио

- `preload="none"` на `<audio>` (по умолчанию) — не префетчим.
- `crossorigin="anonymous"` — чтобы SW мог перехватывать.

### Бандл (отсутствует)

Нет бандла — каждый файл грузится отдельно. Service Worker их кеширует. На повторных заходах всё летает.

---

## 19. Фазы реализации

Поскольку scope — **полная версия сразу**, всё делается последовательно, но фазы остаются логическими этапами для tracking'а прогресса.

| Фаза | Цель | Результат |
|---|---|---|
| **P0. Bootstrap** | Поднять пустую PWA | `index.html` грузится, SW регистрируется, пустая страница |
| **P1. Data Layer** | Dexie + импорт words.json | После первого запуска 5948 слов в IDB |
| **P2. SM-2 Engine** | Чистая логика повторений | Unit-тесты зелёные, можно прогнать в Node |
| **P3. Core UI** | Router, layout, theme, i18n | 7 пустых страниц переключаются, тема меняется |
| **P4. Dashboard + Settings** | Первый видимый экран | Дашборд показывает streak/прогресс, настройки сохраняются |
| **P5. Простые квизы** | EN→L1 выбор, L1→EN выбор | Уже можно учить первые слова |
| **P6. SRS Loop** | Repeat + Learn с правильным приоритетом | Полноценная дневная сессия работает |
| **P7. Продвинутые квизы** | Tile builder, type-in, cloze, audio | Все 8 типов квизов работают |
| **P8. Геймификация** | Streak, ачивки, XP, звуки, вибрация | Видна мотивация, разблокируются ачивки |
| **P9. Dictionary + Stats** | Браузер слов, графики | Можно искать и анализировать |
| **P10. PWA Polish** | Полный SW, install prompt, иконки | Устанавливается как приложение |
| **P11. Backup / Restore** | Экспорт/импорт прогресса | Можно бэкапить |
| **P12. A11y & Performance** | Клавиатура, ARIA, lighthouse | Lighthouse ≥ 90 PWA score |
| **P13. Points Refactor** | Stage-tied SM-2 → points-based hybrid | 9 квизов, очки 0–100, новая модель SRS, свободный выбор квиза на сессии |
| **P14. UI Redesign** | Mobile-first визуальный/UX-редизайн | Адаптив под телефоны, safe-area, SVG-иконки `<lew-icon>`, навигация «5 + Ещё», `<lew-dialog>` для подтверждений |
| **P15. Audit 2 Polish** | Полировка по итогам второй проверки фронтенда | `<lew-toggle>` CSS fix, полная аудио-паритетность во всех 4 квиз-компонентах, WCAG AA контраст (`--color-primary` → `#4f46e5`, `--color-streak-fg`), `color-scheme`, `forced-colors`, `withTimeout` для IDB, scroll-restoration, leave-quiz dialog, iOS PWA meta, race-condition guards (`_navToken`, `active` flag на каждой странице), `document.title` динамически, `view-transitions` |

Каждая фаза заканчивается работающим (хоть и неполным) приложением. Не должно быть «нельзя запустить, потому что P5 не готов».

---

## 20. Открытые вопросы и решения

### Решённые

| Вопрос | Решение |
|---|---|
| Фреймворк? | Pure JS + Web Components |
| Сборщик? | Нет |
| Dev-сервер? | `npx serve` или `python3 -m http.server` |
| SRS алгоритм? | SM-2 с EF |
| Тесты? | `node --test` для core логики |
| Хранилище? | Dexie.js (vendored) |
| `href` поле? | Игнорируем (опционально отображаем в Dictionary) |
| Дубликаты слов? | Каждый `id` — отдельная карточка |
| Стили? | Нативный CSS + Variables |
| Темы? | light / dark / auto через `prefers-color-scheme` |

### Открытые (можно решить позже)

- Нужны ли «слабые слова» — отдельный список слов, в которых пользователь ошибается? (да, но позже)
- Импорт собственных слов (не Oxford)? (нет, только Oxford)
- Несколько профилей пользователей на одном устройстве? (нет)
- Экспорт в CSV/Anki deck? (опционально, после MVP)

---

## 21. Артефакты и документация

- `SPEC.md` (этот файл) — техническое задание. **Авторитетный источник** продуктовых решений.
- `AGENTS.md` — англоязычная выжимка для AI-агентов: схема данных, реализация SRS, соглашения по коду, последние фазы. **Авторитетный источник** рабочих конвенций.
- `README.md` — короткая инструкция как запустить (создаётся при публикации).

Исторические plan-файлы удалены после завершения всех фаз (P0–P15):

- `REFORM-PLAN.md` — план перехода stage-tied SM-2 → points-based hybrid. Реализован в P13.
- `UI-REDESIGN-PLAN.md` — mobile-first редизайн (R0–R8). Реализован в P14.
- `UI-AUDIT-2.md` — полировка по итогам второй проверки (4 фазы, 63 правки). Реализован в P15.

Их содержимое полностью отражено в `AGENTS.md` (детали реализации) и `SPEC.md` (продуктовый язык). При добавлении новых фаз — сначала обновляются эти два файла, и только потом создаётся отдельный план-документ.

---

## 22. Глоссарий

- **CEFR** — Common European Framework of Reference for Languages (A1, A2, B1, B2, C1, C2).
- **SRS** — Spaced Repetition System.
- **SM-2** — SuperMemo 2 algorithm.
- **EF** — Easiness Factor (от 1.3 до бесконечности, по умолчанию 2.5).
- **Points / стадии** — `points ∈ [0, 100]`, `stage = floor(points / 20)`, `stage ∈ [0, 5]`.
- **Due words** — слова, у которых `0 < points < 100` и `nextReview <= now`.
- **New words** — слова с `points === 0` (или без записи в `progress`).
- **Mastered** — `points >= 100` (stage 5). Переход в режим длинных SM-2 интервалов.
- **Active repeat** — стадии 1–4: очковый аккумулятор + дневной кап `+20 pts` + интервал `STAGE_UP_INTERVALS[stage]` дней.
- **`accumulatedToday`** — очки, заработанные на текущем интервальном дне (0–20). Кап = 20.
- **`wrongToday`** — счётчик ошибок на текущем интервальном дне. При 3 — `resetToNew`.
- **PWA** — Progressive Web App.
- **IDB** — IndexedDB.
- **SW** — Service Worker.

---

**Версия документа:** 1.3
**Дата:** 2026-08-12
**Статус:** Все фазы P0–P15 реализованы. Проект готов к публикации (165/165 тестов зелёные).