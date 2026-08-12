# AGENTS.md — Project Context for AI Agents

> Read this file at the start of every session. It contains the durable facts and conventions you need to work effectively on this codebase.
>
> **Current state:** All major refactors are shipped and reflected here:
>
> - SRS uses a **points-based hybrid** (0–100 pts drive stages, SM-2 reserved for mastered phase ≥100 pts). Quiz difficulty is **not** tied to stage — the user freely picks any of 9 quiz types per session.
> - UI is **mobile-first** (safe-area aware, inline-SVG icons via `<lew-icon>`, `<lew-dialog>` for confirms, "5 + More" bottom nav, segmented controls, dropdown nav on `≥1024px` becomes left sidebar). All styles live in `docs/styles/*.css` — never inject `<style>` from JS, never inline `style=""` except for truly dynamic values (`width:%`, `height:%`).
> - Polish audit (`P15`) is done: `<lew-toggle>` CSS fix, audio parity in every quiz component, WCAG AA contrast (`--color-primary` → `#4f46e5`), `color-scheme`, `forced-colors`, `withTimeout` for IDB, scroll-restoration, leave-quiz dialog, iOS PWA meta, race-condition guards (`_navToken` on `<app-shell>`, `active` flag on every page), `document.title` dynamic, `view-transitions` ready.
> - 165/165 tests green at the time of this revision.

---

## 1. Project Overview

**Name:** `lew` (Learn English Words)
**Type:** Offline-first Progressive Web App for memorizing English vocabulary using the Oxford Learner's Dictionary 5000 list.
**Audience:** Single self-user. No backend, no auth, no sync.
**Goal:** Daily vocabulary training that runs entirely in the browser, persists locally, and works offline after first load.

---

## 2. Tech Stack (Fixed)

| Layer | Choice | Notes |
|---|---|---|
| Language | **Vanilla JavaScript (ES2022+)** | No TypeScript, no JSX |
| Modules | **Native ES Modules** | Always include explicit `.js` extensions in imports |
| Components | **Web Components** (Custom Elements) | Shadow DOM optional |
| Templates | **`<template>` + `cloneNode`** | Native; also direct string templates |
| Styling | **Plain CSS + CSS Custom Properties** | Variables for theming |
| Database | **IndexedDB via Dexie.js** | Vendored in `/docs/src/vendor/` (`dexie.min.mjs`), not via npm |
| Local settings | **LocalStorage** | Synchronous |
| Audio cache | **Cache API via Service Worker** | Lazy, per-first-play |
| Service Worker | **Native, no Workbox** | Hand-written `service-worker.js` |
| Router | **History API + custom router** | SPA, no library; scroll-restore on back/forward |
| Dev server | **`npx serve` or `python3 -m http.server`** | No bundler, no Vite |
| Unit tests | **`node --test`** (built into Node 18+) | Zero test deps; `fake-indexeddb` for DB tests |
| Build step | **None for source** | `dist/lew.bundle.js` exists as a possible future optimization, not used in development |

**Production rule:** the deployed app is just static files. No bundling, no transpilation, no source maps.

---

## 3. Dataset Facts

The dictionary comes from `words.json` in the project root.

| Property | Value |
|---|---|
| Total entries | **5,948** (Oxford includes homonyms as separate entries) |
| File size | **6.87 MB** |
| CEFR levels | A1: 1,076 · A2: 992 · B1: 903 · B2: 1,573 · C1: 1,404 · **C2: 0 (not in dataset)** |

### Raw structure (one entry)

```json
{
  "id": 0,
  "value": {
    "word": "a",
    "translations": { "ru": "...", "ua": "..." },
    "href": "https://www.oxfordlearnersdictionaries.com/...",
    "type": "indefinite article",
    "level": "A1",
    "us": { "mp3": "https://...", "ogg": "https://..." },
    "uk": { "mp3": "https://...", "ogg": "https://..." },
    "phonetics": { "us": "/eɪ/", "uk": "/eɪ/" },
    "examples": [{ "en": "...", "ru": "...", "ua": "..." }]
  }
}
```

### Important dataset quirks

1. **Homonyms are separate entries.** E.g. `about` appears as id 6 (adverb) and id 7 (preposition). Each `id` is an independent card with independent progress. Do not deduplicate by `word`.
2. **`type` is kept in English** (noun, verb, adjective, adverb, preposition, etc.). Do not translate.
3. **`href` field is ignored.** Not stored in IndexedDB, not shown in UI.
4. **Audio is external** (Oxford CDN). Cached lazily through Service Worker.
5. **`word` is lowercase** in raw data. Do not capitalize.

### Mapped structure (stored in IDB)

```js
{
  id: 0,
  word: "a",
  translations: { ru: "...", ua: "..." },
  type: "indefinite article",
  level: "A1",
  audio: { us_mp3: "...", us_ogg: "...", uk_mp3: "...", uk_ogg: "..." },
  phonetics: { us: "/eɪ/", uk: "/eɪ/" },
  examples: [{ en: "...", ru: "...", ua: "..." }]
}
```

---

## 4. Project Structure

```
/docs
  index.html                     # SPA shell (iOS PWA meta tags + viewport-fit=cover)
  manifest.json                  # PWA manifest
  service-worker.js              # SW: precache + runtime cache + update flow
  /icons
    icon-192.png, icon-512.png, maskable-icon-512.png,
    apple-touch-icon-180.png, splash-*.png
  /styles
    reset.css, tokens.css, base.css, components.css
  /data
    words.json                   # raw dataset (read-only at runtime)
  /src
    /vendor
      dexie.min.mjs              # Vendored Dexie ESM build
    /services                    # business logic, single source of truth
      db.js, import.js, srs.js, settings.js, stats.js,
      audio.js, audio-cache.js, storage.js, i18n.js,
      achievements.js, backup.js, date.js, random.js,
      streak.js, quiz-factory.js
    /utils                       # tiny cross-cutting helpers
      html.js (escapeHtml, escapeAttr)
    /components                  # reusable Web Components
      app-shell.js, word-card.js, quiz-choice.js, quiz-letters.js,
      quiz-input.js, quiz-cloze.js, audio-player.js,
      base-quiz-element.js,       # shared base for all quiz components
      progress-bar.js, streak-badge.js, stat-tile.js,
      level-meter.js, toggle.js, slider.js, toast.js,
      icon.js, dialog.js
    /quiz-selector.js            # shared renderer for the 3×3 quiz picker
    /pages                       # SPA views, one per route
      onboarding.js, dashboard.js, learn.js, repeat.js,
      quiz.js, dictionary.js, stats.js, settings.js
    router.js                    # History API router + scroll restoration + leave-quiz guard
    app.js                       # Bootstrap + SW registration
/tests                           # node --test files
  srs.test.js, import.test.js, db.test.js, stats.test.js,
  achievements.test.js, random.test.js, smoke.test.js,
  streak.test.js, quiz-factory.test.js
/tools
  vendor-dexie.sh, serve.mjs, build.mjs
package.json                     # only for `node --test` + small dev helpers
SPEC.md                          # Russian — full specification
AGENTS.md                        # English — this file (durable agent context)
```

### Layer dependency rules

- **Pages** import **Components** and **Services**.
- **Components** import **Services** only (never touch IDB directly).
- **Services** never import **Components**.
- **Components** never import **Pages**.
- **Services** are singletons (default-exported instances).
- **Pages** export `mount(rootEl)` and `unmount()`.

If a component needs IndexedDB, the data access goes through a service. Never call `indexedDB.open()` from a component.

---

## 5. Data Model (IndexedDB via Dexie)

### Schema (current: v3)

```js
db.version(3).stores({
  words:        'id, word, level, type',
  progress:     'wordId, nextReview, lastReview, points, lastTouchedDate',
  stats:        'date',
  achievements: 'id, unlockedAt',
});
```

The IDB schema has shipped through v1 → v2 (added SRS points-era indexes) → v3 (added `unlockedAt` to achievements for `orderBy` queries). Migration is handled by Dexie's `version()` chaining.

### `words` table

| Field | Type | Notes |
|---|---|---|
| `id` | number | Primary key (from raw.id) |
| `word` | string | English headword, lowercase |
| `translations` | { ru, ua } | |
| `type` | string | Part of speech, English |
| `level` | string | "A1" \| "A2" \| "B1" \| "B2" \| "C1" |
| `audio` | { us_mp3, us_ogg, uk_mp3, uk_ogg } | External URLs |
| `phonetics` | { us, uk } | IPA strings |
| `examples` | Array<{ en, ru, ua }> | At least one example |

### `progress` table

| Field | Type | Default | Notes |
|---|---|---|---|
| `wordId` | number | — | Primary key (= words.id) |
| `points` | number | `0` | **0–100**, primary progress metric |
| `pointsAtIntervalStart` | number | `0` | Snapshot of `points` taken on first touch each interval day. Floor during the active phase; `points` never decreases within an active interval. |
| `accumulatedToday` | number | `0` | 0–20, SRS points earned **today (calendar day)** toward the active interval's daily cap. Stays at 20 after cap — word is "frozen" for the rest of the day; **not** reset by stage-up. |
| `wrongToday` | number | `0` | Wrong-answer count in **today's calendar day** |
| `lastTouchedDate` | string \| null | `null` | "YYYY-MM-DD"; calendar-day boundary for resetting `accumulatedToday`/`wrongToday` |
| `nextReview` | number | `Date.now()` | Set at stage-up (or `resetToNew` = now). For active words: stays at stage-up time + `STAGE_UP_INTERVALS[N]` days; if the user fails to close the cap on the due day, the word **stays due** (`nextReview <= now`) and reappears in `/repeat` until the cap is reached. Never reset by day rollover alone. |
| `lastReview` | number \| null | `null` | Timestamp of last answer |
| `EF` | number | `2.5` | SM-2 easiness factor (active only when `points >= 100`) |
| `interval` | number | `0` | SM-2 interval in days (active only when `points >= 100`) |
| `repetition` | number | `0` | SM-2 consecutive correct (active only when `points >= 100`) |
| `successCount` | number | `0` | Lifetime correct answers |
| `failCount` | number | `0` | Lifetime wrong answers |

**Stage** is derived: `stage = Math.floor(points / 20)`, capped at 5.

| Stage | Points | Phase |
|---|---|---|
| 0 | 0 | New |
| 1 | 20 | Active repeat |
| 2 | 40 | Active repeat |
| 3 | 60 | Active repeat |
| 4 | 80 | Active repeat |
| 5 | 100 | Mastered (SM-2 long-interval) |

### `stats` table

| Field | Type | Notes |
|---|---|---|
| `date` | string | "YYYY-MM-DD" |
| `reviewed` | number | Words reviewed this day |
| `learned` | number | New words graduated this day |
| `correct` | number | Correct answers |
| `wrong` | number | Wrong answers |
| `minutes` | number | Time spent |
| `xp` | number | Experience points |
| `pointsEarned` | number | SRS points gained (excludes wrong-answer losses) |
| `stageUps` | number | Count of words that advanced a stage today |
| `audioTotal` | number | Lifetime audio-quiz successes (drives `polyglot_audio`) |
| `maxSpeed` | number | Best correct-answers-per-minute run today (drives `speed_demon`) |

### `achievements` table

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `"first_word"` |
| `unlockedAt` | number | Timestamp (indexed) |
| `notified` | boolean | Whether toast was shown |

### LocalStorage keys

`theme`, `uiLang`, `translationLang`, `dailyNorm` (default **15**, options 5/10/15/20/25), `repeatSessionSize` (default **15**, options 10/15/20/50/100), `accent`, `activeLevels` (array), `soundEnabled`, `vibrationEnabled`, `firstLaunch`, `lastVisit`, `streakLastDay` (YYYY-MM-DD), `streakCount` (cached counter), `learnDailyPool.<YYYY-MM-DD>` (snapshot of today's learn pool id+quota).

---

## 6. SRS Algorithm — Points-Based Hybrid

The active learning phase (0–100 pts) uses a **points accumulator** with a per-day cap. Once a word reaches 100 pts (stage 5 / mastered), classical **SM-2** takes over for long-interval scheduling. The user picks a quiz type per session; difficulty (and points-per-quiz) is chosen freely, not dictated by stage.

### Stage → points → scheduling

| Stage | Points | `nextReview` after stage-up |
|---|---|---|
| 0 | 0 | "Now" — word is in `/learn` pool until it hits 20 pts |
| 1 | 20 | +1 day |
| 2 | 40 | +6 days |
| 3 | 60 | +16 days |
| 4 | 80 | +45 days |
| 5 | 100 | **Mastered** — SM-2 long-interval (60 → 150 → … capped at 365) |

`STAGE_UP_INTERVALS = [null, 1, 6, 16, 45]` (index = new stage, 1–4).

### Quiz types and points

`POINTS_FOR_QUIZ_TYPE` is a static map in `docs/src/services/srs.js`:

| Quiz type | SRS points |
|---|---|
| `en-to-l1`, `l1-to-en`, `audio-to-en`, `cloze-choice` | **5** (easy) |
| `tile-l1-en`, `tile-audio-en` | **10** (medium) |
| `type-in`, `cloze`, `audio-type-in` | **20** (hard) |

`xpForQuizType(quizType, correct)` in `docs/src/services/quiz-factory.js` returns a separate gamification XP value (5/7/8/10 for correct, **1** for wrong). XP never touches `progress.points`.

### Daily cap & rules

- **Cap per word per real calendar day:** `+20 pts`. After cap is hit (e.g. on the 4th correct `en-to-l1` for a stage-1 word), `points += 20` (stage-up), `wrongToday = 0`, `accumulatedToday` stays at **20** — the word is **frozen for the rest of today**. Further correct or wrong answers return `no-op-cap-reached` (button still turns green/red, but no SRS points added and no penalty).
- **Wrong answer:** `accumulatedToday -= cost`, floor `0`. **Does NOT decrease `points`** (which is monotonic upward in the active phase). Cannot drop below `pointsAtIntervalStart` — guaranteed because `points` only grows.
- **3 wrong on same word in one real day** → `resetToNew`: `points = 0`, `successCount = 0`, `failCount = 0`, `lastReview = null`, `lastTouchedDate = today`. Word is back in the new-word pool and re-enters today's `/learn` pool the next time `getDailyLearnPool` resolves a fresh day.
- **No cap-reset on stage-up within the same day.** Spaced repetition depends on **time between reviews**, not cramming. The user cannot advance multiple stages in one real day by reaching one cap after another. After stage-up, the word becomes due again only after `STAGE_UP_INTERVALS[newStage]` days (1, 6, 16, or 45).
- **If the user doesn't reach the cap on the day the word becomes due:** `nextReview` stays at its stage-up timestamp (already in the past), so the word remains due and reappears in `/repeat` on every subsequent session until the user finally closes the cap. This is intentional: SM-2 only works if the user is forced to recall.
- **Mastered word wrong (stage 5)** → drop to `points = 80` (stage 4, back to active), reset SM-2 fields to defaults, schedule `nextReview = +1 day`.
- **First correct answer after reaching stage 5:** `applyMastered` is special-cased to skip SM-2 on this hit — it advances `repetition` 0→1 but **keeps the 60-day initial mastered interval**. Without this, SM-2 with `q=5, repetition=0` would set `interval=1`, throwing away the long-mastered reward. Subsequent correct answers go through normal `sm2()`.

### Stage-up interval table (active phase)

```js
const STAGE_UP_INTERVALS = [null, 1, 6, 16, 45];
// After stage-up to stage N (1..4): nextReview = now + STAGE_UP_INTERVALS[N] * DAY_MS
// Stage-up to 5: initialize SM-2 fields (EF=2.5, interval=60, repetition=0)
```

### SM-2 (mastered phase only, `points >= 100`)

```js
export function sm2(card, q) {
  if (q >= 3) {
    if (card.repetition === 0) card.interval = 1;
    else if (card.repetition === 1) card.interval = 6;
    else card.interval = Math.max(1, Math.round(card.interval * card.EF));
    card.repetition += 1;
    card.successCount += 1;
  } else {
    card.repetition = 0;
    card.interval = 1;
    card.failCount += 1;
  }

  card.EF = card.EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (card.EF < MIN_EF) card.EF = MIN_EF;
  if (card.interval > MAX_INTERVAL) card.interval = MAX_INTERVAL;

  card.lastReview = Date.now();
  card.nextReview = card.lastReview + card.interval * DAY_MS;
  return card;
}
```

### Grade mapping

| User outcome | `q` |
|---|---|
| Correct | `5` |
| Wrong | `2` |

### Entry point: `recordQuizResult(wordId, quizType, correct)`

Single public function called by `/learn` and `/repeat`. Handles both phases:

1. Open a Dexie `rw` transaction over `progress`.
2. Load progress (or `createProgress(wordId)`).
3. If `isMastered(progress)` → mastered path (`applyMastered` → either SM-2 progression or drop to stage 4).
4. Else → active path: `normalizeProgress` (handles day rollover), then `applyActive(quizType, correct)` which raises/lowers `accumulatedToday` against the daily cap and triggers `stage-up` / `mastered` / `reset-to-new` as needed.
5. Persist, invalidate the `progress` cache, return `{ progress, event }` where `event` ∈ `progress | stage-up | mastered | reset-to-new | reset-to-active | no-op-cap-reached`.

Pages then feed the event into `stats.recordReview` for gamification and into `achievements.checkAndUnlockAchievements`.

---

## 7. Daily Session Logic

The app has **three independent modes**, each with its own page. The user picks a quiz type freely at the start of each session.

### `/learn` — new words (stage 0)

1. **Pool:** `getDailyLearnPool(activeLevels, dailyNorm)` is a fixed-for-day snapshot stored under the LocalStorage key `learnDailyPool.<YYYY-MM-DD>`. If the snapshot exists and its `quota` matches today's `dailyNorm`, return those exact word IDs resolved against IDB (so partial progress from earlier today is preserved). Otherwise build a fresh pool via `getNewWordPool` (which iterates active levels from lowest, prioritizing partial stage-0 words before fresh), snapshot it, and return.
2. **Pool rule:** up to `dailyNorm` (default 15) stage-0 words across active levels. Fresh words are only introduced when the pool has room (so unfinished pool words stay tomorrow).
3. **Quiz selection:** user picks any of 9 quiz types from a 3×3 grid; selection is per-session.
4. **All pool words** are presented in the session queue.
5. **Per-word flow:** each correct quiz increments `accumulatedToday`; each wrong quiz decrements it (floor 0) and increments `wrongToday`. Reaching `accumulatedToday >= 20` triggers stage-up → `points += 20` → `pointsAtIntervalStart = points` → `nextReview = +stage interval`; the word stays visible in the current session queue as "graduated" but further answers today return `no-op-cap-reached`. Partial progress (e.g. 15/20 at end of day) is preserved in the pool for tomorrow (still stage 0, so not in `/repeat`). 3 wrong → `resetToNew`.
6. **Header CTA** on the page chooses quiz type → user clicks "Start". The session continues even after all words graduate.

### `/repeat` — due repeats (stages 1–4)

1. **Due words:** `progress.points > 0 && progress.points < 100 && progress.nextReview <= now`.
2. **Session:** `getDueSession(activeLevels, repeatSessionSize)` (default 15, options 10/15/20/50/100) returns a random sample from the due pool, joining progress with the word record by `wordId`.
3. **Quiz selection:** user picks any of 9 types per session.
4. **Per-word flow:** same as `/learn` for the active phase, but on stage-up the word is **removed** from the current session queue (not shown again today). On wrong, `wrongToday++; resetToNew` if 3.
5. **Word stays due across multiple sessions in the same day:** because `nextReview <= now` (set on a previous day and now in the past), the word keeps appearing in `/repeat` until the user closes the cap. This is by design.
6. **Multiple sessions per day:** the page shows a "Next batch (N due left)" button while the due pool is non-empty.

### `/quiz` — free practice (sandbox)

- User picks level (CEFR or "all"), range ("learned only" or "all"), quiz type.
- **Does NOT touch `progress` table** — only `stats.recordReview({ correct, isNew: false, xp, audio, speed })` and `stats.addSessionBonus(25)` at the end.

### Streak check

On Dashboard load (`refreshStreakOnVisit` in `docs/src/services/streak.js`):

1. Read `streakLastDay` and `lastVisit` from LocalStorage.
2. Compute the gap in calendar days between `lastStreakDay` and today.
   - `gap === 1`: check `stats.reviewed/learning > 0` on the previous day; if yes, streak++, else reset to 1.
   - `gap > 1`: streak = 1.
   - same day or `lastStreakDay === null`: do not modify.
3. Persist `streakLastDay = today`, `streakCount`, `lastVisit = today`.

### `today` definition

- `today` = local user date, not UTC. `docs/src/services/date.js#todayKey()` returns `"YYYY-MM-DD"` from `getFullYear/getMonth/getDate`. All "interval day" boundaries (`lastTouchedDate`, the daily-stats row key, the daily pool snapshot) use this.
- For tests, `todayKey(date)` accepts a `Date` argument so tests can freeze time deterministically.

---

## 8. Quiz Types

All 9 types are available at every stage; the user picks freely per session.

| # | Key | Stimulus → Response | Component | Difficulty | SRS Pts |
|---|---|---|---|---|---|
| 1 | `en-to-l1` | EN word → L1 translation (4-choice) | `<quiz-choice>` | easy | 5 |
| 2 | `l1-to-en` | L1 translation → EN word (4-choice) | `<quiz-choice>` | easy | 5 |
| 3 | `audio-to-en` | 🔊 audio → EN word (4-choice) | `<quiz-choice>` | easy | 5 |
| 4 | `cloze-choice` | Example with blank + 4 options | `<quiz-cloze>` (options mode) | easy | 5 |
| 5 | `tile-l1-en` | L1 translation → EN word (tile builder) | `<quiz-letters>` | medium | 10 |
| 6 | `tile-audio-en` | 🔊 audio → EN word (tile builder) | `<quiz-letters>` | medium | 10 |
| 7 | `type-in` | L1 translation → EN word (typed) | `<quiz-input>` | hard | 20 |
| 8 | `cloze` | Example with blank (typed) | `<quiz-cloze>` (input mode) | hard | 20 |
| 9 | `audio-type-in` | 🔊 audio → EN word (typed) | `<quiz-input>` + audio | hard | 20 |

### Component shared base

All quiz components extend `BaseQuizElement` (`docs/src/components/base-quiz-element.js`), which centralizes:

- `_installKeyHandler` / `_cleanupKeys` — keyboard handler attachment + cleanup on disconnect.
- `_handleSkip` — fires `{ correct: false, skipped: true }` after announcing the correct answer.
- `_fire({ correct, skipped }, skipped?)` — guarded by `this._answered`; schedules `setTimeout` then calls `setOnAnswer` callback.
- `_disableInputs()` — subclass override hook for "answers are locked, no further input allowed".
- `_announceResult(correct, correctText)` — renders `.quiz__correct-answer` with role="status", moves focus there for keyboard users.
- `disconnectedCallback` — clears any pending timers and removes the key listener (prevents audio-bleed and zombie events).

### Distractor generation

For multiple-choice quizzes (`en-to-l1`, `l1-to-en`, `audio-to-en`, `cloze-choice`):

- **Excluded:** any word whose `progress.lastTouchedDate === today` (today's pool — avoids proactive/retroactive interference).
- **Preferred:** words with `progress.points >= 40` (learned — re-exposure strengthens prior memory).
- Same CEFR level (mandatory filter).
- Same `type` (part of speech) when possible, else any CEFR-level match.
- Audio quizzes (`audio-to-en`): sort remaining candidates by **Levenshtein distance ≤ 3** from the correct word; fall back to preferred/learned pool if too few near-matches.
- The pool is cached per `(activeLevels,type)` for 5 minutes; the progress index per day; call `invalidateDistractorCache()` if you need a hard reset.

### Cloze fallback

If a word has no `examples[0]` or the word doesn't appear as `\b…\b` in its example sentence:

- `cloze` → degrades to `type-in`.
- `cloze-choice` → degrades to `en-to-l1`.

### Keyboard shortcuts

- `1`, `2`, `3`, `4` → select option (for choice quizzes).
- `Enter` / `Space` → submit / continue.
- `Esc` → skip (always announces the correct answer).
- `A` (or local `Ф`/equivalent) → replay audio (on quizzes with `audio-url`).

### Special UI conventions

- **Audio quizzes:** the prompt is rendered with a `<button class="quiz__audio-btn">` that calls `playAudioUrl(audio-url)`. The audio autoplays 150ms after mount via a `setTimeout` whose handle is stored so `disconnectedCallback` can clear it (no audio bleeding into the next card).
- **Reveal after answer:** the correct/wrong label is rendered into `.quiz__correct-answer` with `role="status"` and given `tabindex="-1"`, then focused on `requestAnimationFrame` so keyboard users land somewhere meaningful.
- **Disabled inputs after answer:** each quiz component overrides `_disableInputs()` to lock UI on fire.

---

## 9. Pages & Routes

| Route | Page | Purpose |
|---|---|---|
| `/` | Dashboard | Home: streak, debt, CEFR progress, recent achievements, CTAs |
| `/onboarding` | Onboarding | First-run import (DB rows + LocalStorage settings) |
| `/learn` | Learn | New words session (stage 0) |
| `/repeat` | Repeat | Due words session (stages 1–4) |
| `/quiz` | Quiz | Free practice (sandbox; does not touch `progress`) |
| `/dictionary` | Dictionary | Browse all 5,948 words |
| `/stats` | Statistics | Charts + achievement gallery |
| `/settings` | Settings | All user settings + backup/restore |

The router (`docs/src/router.js`) uses the History API:

- `history.scrollRestoration = "manual"`; on each forward `go()` we `replaceState({ scrollY }, current)` first and `pushState({}, "", path)`, so navigating back restores the previous scroll position.
- `popstate` triggers `emit(path, { restoreScroll: true })`.
- A `data-link` global click handler intercepts SPA links.
- If `document.body.dataset.quizActive === "true"`, attempting to navigate (forward via click or backward via popstate) opens `<lew-dialog>` (`quiz.leaveConfirm`) with the danger-style confirm; only on confirm does navigation proceed. `learn.js` / `repeat.js` / `quiz.js` set the flag on session start and clear it on completion/unmount.

---

## 10. PWA & Caching

### Cache strategy

| Resource | Strategy | Cache name |
|---|---|---|
| App shell (HTML, CSS, JS, vendor, icons) | Precache on `install` | `lew-app-v1` |
| `words.json` | Precache on `install` | `lew-data-v1` |
| Oxford audio | Cache-first + network fallback | `lew-audio-v1` |

### SW lifecycle

- `install`: precache shell + data. `self.skipWaiting()`.
- `activate`: delete old caches. `clients.claim()`.
- `fetch`: route to appropriate strategy based on URL pattern.
- **`updatefound` flow:** when a new SW is found, the page shows a toast "Доступно обновление"; user taps it → `postMessage("SKIP_WAITING")` → on `controllerchange` → `location.reload()`. This is the only way users see new versions cleanly.

### iOS PWA meta

`docs/index.html` carries the apple-mobile-web-app-* meta tags (capable=yes, status-bar-style=black-translucent, title=LEW) plus `apple-touch-icon` and `apple-touch-startup-image` for cold-launch icons and splash. `viewport-fit=cover` is set; safe-area CSS tokens use the resulting `env(safe-area-inset-*)` values.

---

## 11. Coding Conventions

### Module style

```js
// math.js
export function add(a, b) { return a + b; }
export const PI = 3.14;
```

```js
// main.js
import { add, PI } from './math.js'; // explicit .js!
```

```js
// docs/src/services/db.js
import Dexie from '../vendor/dexie.min.mjs';
```

- Always `import`/`export`, never `require`.
- Always include the file extension in import paths.
- Prefer named exports; default exports only for service singletons.

### Web Components

```js
class MyEl extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  connectedCallback() { this.render(); }
  render() { this.shadowRoot.innerHTML = `...`; }
}
customElements.define('my-el', MyEl);
```

- Custom element tags use kebab-case (`<quiz-choice>`).
- Shadow DOM is optional. Use when you need style isolation; skip for layout components.
- Components listen to events via `addEventListener`; do not use `on*` attributes.
- All quiz components must inherit `BaseQuizElement` so key handling, answer firing, and disconnect cleanup stay consistent.
- Any class that has a pending `setTimeout` (audio autoplay, answer-fire delay) **must** store the handle in `this._xxxTimer` and override `disconnectedCallback` (or the base one will handle it) to clear it.

### Naming

- Files: `kebab-case.js`.
- Classes: `PascalCase`.
- Functions, variables: `camelCase`.
- Constants: `UPPER_SNAKE_CASE` for true constants only (max lengths, magic numbers, table-name maps).
- Custom element tags: `kebab-case` (`lew-icon`, `lew-dialog`, `quiz-choice`).
- CSS classes: `kebab-case`, BEM-ish (`.quiz__option--correct`).
- IDB fields: `camelCase`.
- CEFR levels: uppercase ("A1", "B2").

### Code style

- **No comments unless explicitly asked.**
- No transpilation, no polyfills in source code (target modern browsers only).
- Prefer `const` over `let`. Never use `var`.
- Use async/await, not `.then()` chains.
- Errors should propagate; pages handle UI for them.
- When a slow IDB query might hang the UI, wrap with `withTimeout(promise, ms, fallback)` (added in `docs/src/services/db.js`). A timed-out call resolves to the fallback so pages render an empty state instead of spinning forever.
- When a page mounts and there is any chance of fast repeat navigation, use the `_navToken` re-entrancy guard (see `app-shell.js#_navigateTo`) and the `active` flag pattern (`dashboard.js`, `learn.js`, `repeat.js`, `quiz.js`, `onboarding.js`, `dictionary.js`, `stats.js`, `settings.js`).

### CSS

- All colors and spacing via CSS variables in `tokens.css`.
- BEM-ish naming: `.quiz__option--correct`.
- **Mobile-first:** base styles target phone (≥320px); enhance with `min-width` at 480 / 600 / 768 / 1024 px.
- **Safe areas:** `--safe-top/bottom/left/right` tokens (`env(safe-area-inset-*)`) on header, nav, and edges. `viewport-fit=cover` is set in `index.html`.
- **Touch targets** ≥ `--tap-min` (44×44). Every interactive element needs `:active` and `:focus-visible` states.
- Respect `@media (prefers-reduced-motion: reduce)`, `(hover: hover) and (pointer: fine)` (for keyboard hints only), `(pointer: coarse)` (disable hover-only effects), `forced-colors: active` (transparent `-webkit-text-fill-color` overrides to `CanvasText`).
- **Single source of truth:** all styles live in `docs/styles/*.css`. Never inject `<style>` from JS, never use inline `style=""` except for truly dynamic values (`width:${pct}%`, `height:${h}%`).
- `--color-primary` is **`#4f46e5`** (was `#6366f1` — old value failed WCAG AA at 12–16 px text). Keep `--gradient-brand` as the original triplet; it stays on dark surfaces and large sizes where contrast is not an issue.
- No CSS-in-JS, no Tailwind, no preprocessors.

### Imports from vendor

```js
import Dexie from './vendor/dexie.min.mjs';
```

Single vendor dep. Dexie ESM build, vendored locally. Do not load from CDN at runtime.

---

## 12. Build / Run / Test Commands

### Dev server (no build)

```bash
npx serve docs/
# or
python3 -m http.server 8000 --directory docs
# or
node tools/serve.mjs   # convenience wrapper used by `npm run dev`
```

Open `http://localhost:3000` (serve) or `http://localhost:8000` (python).

### Tests

```bash
npm test                  # node --test tests/*.test.js
npm run test:watch        # node --test --watch tests/
```

All tests must stay green. The current target is **165/165 pass**.

### Vendoring Dexie

```bash
npm run vendor:dexie
bash tools/vendor-dexie.sh
```

Downloads Dexie's ESM build into `docs/src/vendor/dexie.min.mjs`. Run once during setup.

### Coverage (optional)

```bash
npm run coverage          # c8 + node --test
```

### Build (out of scope for daily work)

```bash
npm run build             # node tools/build.mjs → produces dist/lew.bundle.js
npm run preview           # serves the bundled artifact for smoke testing
```

The bundle is a possible future post-release optimization. The running app does **not** depend on it.

---

## 13. Key Decisions & Rationale

| Decision | Why |
|---|---|
| Pure JS, no framework | Offline reliability, no bundler needed, full control, smallest surface area |
| Web Components + native templates | No library lock-in; standard browser primitives |
| Points-based hybrid SRS | User-chosen quiz difficulty + points-per-quiz; SM-2 preserved for long-term mastered reviews |
| Free quiz selection (no stage tie) | User picks quiz type per session based on context (time, environment, audio availability) |
| 9-quiz model | One easy keyboard alternative per shape; user can mix-and-match any session |
| Daily cap `+20 pts` instead of stage-tied SM-2 stepping | Allows free quiz choice and prevents per-day cramming of multiple stages |
| First-correct-after-mastered keeps the 60-day interval | Avoids SM-2 resetting it to 1 day on `repetition=0, q=5` |
| Dexie.js | Best DX for IndexedDB, bulkPut, indexes out of the box |
| No Vite / no bundler in dev | Static files are deployable anywhere |
| Vendored Dexie (no npm runtime) | Works offline from first load; no build step |
| Cache API for audio (not precache all) | 5,948 audio files would be hundreds of MB; lazy is fine |
| `node --test` | Zero-dep testing built into Node 18+ |
| Each `id` = separate card | Reflects the linguistic reality of homonyms |
| Ignore `href` field | Avoids need for outbound network in core UI |
| English-only `type` | Standard linguistic terminology; don't translate |
| `/quiz` is sandbox only | Free practice must not pollute SRS progress; only `stats.xp` is touched |
| Distractors exclude today's pool | Avoids proactive/retroactive interference (Underwood 1957) |
| Distractors prefer `points >= 40` | Re-exposure of already-learned words strengthens prior memory |
| 3-wrong reset | Simpler than proportional penalties; matches Leitner-like models |
| Mobile-first, safe-area, `<lew-icon>`/`<lew-dialog>` | Primary device is phone, not desktop |
| 5+More nav (vs. 7-item bar) | Icons stay legible, dictionary/settings moved into header "More" |
| Native `confirm()` replaced by `<lew-dialog>` | Non-blocking, on-brand, focus-trap, safe-area aware |
| `color-scheme` set in tokens + `applyTheme` | Native scrollbars / `<input>` autofill / form controls respect dark mode |
| `withTimeout` on IDB calls | IndexedDB stall = infinite spinner without it |
| `_navToken` re-entrancy guard | Two rapid nav taps used to orphan the previous page |
| Scroll restoration on back/forward | Dictionary at page 5 → tap word → back → land at page 5 |
| Leave-quiz dialog on `popstate` + `data-link` click | 18/20 answered → tap nav → state lost without warning |
| `forcéd-colors: active` CSS overrides | Windows High Contrast users see gradient-text otherwise |
| `audio-url` attribute parity across all 4 quiz components | The audio replay/autoplay works in `quiz-choice`, `quiz-input`, `quiz-letters`, `quiz-cloze` |

---

## 14. Do / Don't

### Do

- Read `words.json` only during the import flow (`docs/src/services/import.js`).
- Use services for all IDB access. Never call `indexedDB.open()` from a component or page.
- Write tests for any change to SRS or quiz-factory logic. Run `npm test` before declaring a phase complete.
- Use the router for all navigation (`router.go('/repeat')`, never `location.href`).
- Handle errors with try/catch and a toast notification (`window.dispatchEvent(new CustomEvent('lew:toast', ...))`).
- Store any pending `setTimeout` handles as `this._timer` and clear them in `disconnectedCallback`.
- Inherit `BaseQuizElement` for every quiz component.
- Use `<lew-icon name="..." size="...">` for any iconography. Do not use emoji in UI chrome.
- Use `<lew-dialog>` for confirmation prompts. Do not call `window.confirm()`.
- Apply mobile-first CSS (no min-width defaults in components.css without a 320px base alternative).
- Set `document.body.dataset.quizActive = "true"` at the start of any in-progress session and clear it on completion/unmount.

### Don't

- Add a framework (React, Vue, Svelte, etc.).
- Add a build tool that participates in dev (Vite, webpack, esbuild as a devDep are tolerated only for the optional `dist/` bundle).
- Use LocalStorage for anything >100 KB (use IDB).
- Modify `words.json`.
- Add a backend, server, API, or auth.
- Use CDN URLs in production (vendor everything).
- Load Dexie from npm at runtime (must be vendored).
- Add code comments unless explicitly asked.
- Use TypeScript.
- Touch `docs/src/services/*` business logic from a UI redocument — but adding i18n keys, `withTimeout`, and `colorScheme` in `applyTheme` is allowed.
- Inject `<style>` from JS or set inline `style="..."` (except dynamic `width:%`/`height:%`).
- Use emoji as the primary icon in nav or controls.

---

## 15. Implementation Phases

| Phase | Goal | Status |
|---|---|---|
| **P0. Bootstrap** | Empty PWA loads, SW registers | ✅ |
| **P1. Data Layer** | Dexie + import `words.json` (5,948 rows) | ✅ |
| **P2. SM-2 Engine** | Algorithm + unit tests green | ✅ |
| **P3. Core UI** | Router, layout, theme, i18n | ✅ |
| **P4. Dashboard + Settings** | First visible screens | ✅ |
| **P5. Simple Quizzes** | EN→L1 and L1→EN multiple choice | ✅ |
| **P6. SRS Loop** | Learn + Repeat with proper priority | ✅ |
| **P7. Advanced Quizzes** | Tile builder, type-in, cloze, audio | ✅ |
| **P8. Gamification** | Streak, achievements, XP, sound, vibration | ✅ |
| **P9. Dictionary + Stats** | Browse all, charts | ✅ |
| **P10. PWA Polish** | Full SW, install prompt, icons | ✅ |
| **P11. Backup / Restore** | Export/import JSON | ✅ |
| **P12. A11y & Performance** | Keyboard, ARIA, Lighthouse ≥ 90 | ✅ |
| **P13. Points Refactor** | Stage-tied SM-2 → points-based hybrid | ✅ |
| **P14. UI Redesign** | Mobile-first redesign (safe areas, `<lew-icon>`, `<lew-dialog>`, "5 + More") | ✅ |
| **P15. Audit 2 Polish** | `<lew-toggle>` CSS fix, audio parity in all 4 quiz components, contrast, `color-scheme`, DB timeouts, scroll-restore, leave-quiz dialog, iOS PWA meta, `forced-colors` | ✅ |

Use ⏳ for in-progress and ✅ for done. The state of in-progress phases lives in AGENTS.md; an entire audit/plan file is not needed — capture the rationale inline here.

---

## 16. Files You Must Never Edit

- `words.json` — read-only dataset.

The detailed requirements are in `SPEC.md` (Russian). This `AGENTS.md` is the durable English summary for AI agents. They do not need to be kept in sync word-for-word — `SPEC.md` is authoritative for product decisions, this file is authoritative for working conventions.

---

## 17. Quick Reference Card

```
Dataset:  5948 words, 6.87 MB, 5 CEFR levels (A1–C1)
Stack:    Pure JS + Web Components + Dexie + node --test
SRS:      Points-based hybrid (0–100 pts); SM-2 only for mastered (≥100 pts)
Quizzes:  9 types, user picks freely per session (easy 5 / medium 10 / hard 20 SRS pts)
Storage:  IDB (words/progress/stats/achievements) + LS (settings, daily-pool snapshot, streak)
Offline:  SW precaches shell + data, lazy-caches audio; update toast on SW upgrade
UI:       Mobile-first, safe-area, <lew-icon>/<lew-dialog>, "5 + More" nav (sidebar ≥1024px)
Guards:   _navToken on app-shell, active flag per page, withTimeout on IDB, leave-quiz dialog
A11y:     keyboard reachable, :focus-visible ring, live regions, forced-colors fallback
No:       backend, auth, sync, push, framework, runtime bundler, CDN, emoji in chrome
```

End of context. When in doubt, prefer simpler solutions and consistent style.
