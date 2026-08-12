import db from "./db.js";
import { todayKey } from "./date.js";
import { levenshtein, shuffle } from "./random.js";

const CACHE_TTL_MS = 5 * 60 * 1000;
const _distractorCache = new Map();
const _progressIndexCache = { today: null, map: new Map() };

function regexEscape(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getCached(key) {
  const entry = _distractorCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    _distractorCache.delete(key);
    return null;
  }
  return entry.words;
}

function setCached(key, words) {
  if (_distractorCache.size > 64) {
    const oldest = _distractorCache.keys().next().value;
    if (oldest) _distractorCache.delete(oldest);
  }
  _distractorCache.set(key, { words, ts: Date.now() });
}

async function getPool(word, activeLevels) {
  const filterLevels = activeLevels && activeLevels.length > 0
    ? activeLevels
    : (word.level ? [word.level] : null);
  if (filterLevels && !filterLevels.includes(word.level)) {
    return [];
  }
  const key = filterLevels
    ? filterLevels.slice().sort().join(",") + ":" + (word.type || "")
    : `${word.level}:${word.type}`;
  let pool = getCached(key);
  if (!pool) {
    pool = await db.words
      .where("level")
      .anyOf(filterLevels || [word.level])
      .toArray();
    if (word.type) {
      pool = pool.filter((w) => w.type === word.type);
    }
    setCached(key, pool);
  }
  return filterLevels ? pool.filter((w) => w.id !== word.id) : pool.filter((w) => w.id !== word.id);
}

async function getProgressIndex() {
  const today = todayKey();
  if (_progressIndexCache.today === today && _progressIndexCache.map.size > 0) {
    return _progressIndexCache.map;
  }
  const all = await db.progress.toArray();
  const map = new Map();
  for (const p of all) {
    map.set(p.wordId, p);
  }
  _progressIndexCache.today = today;
  _progressIndexCache.map = map;
  return map;
}

export function invalidateDistractorCache() {
  _distractorCache.clear();
  _progressIndexCache.today = null;
  _progressIndexCache.map = new Map();
}

export { escapeHtml, regexEscape };

async function getDistractorsForWord(word, count = 3, activeLevels) {
  const pool = await getPool(word, activeLevels);
  const sameType = pool.filter((w) => w.type === word.type);
  const source = sameType.length >= count ? sameType : pool;
  const progressMap = await getProgressIndex();
  const today = todayKey();

  const candidates = source.filter((w) => {
    const p = progressMap.get(w.id);
    if (p && p.lastTouchedDate === today) return false;
    return true;
  });

  const preferred = [];
  const others = [];
  for (const w of candidates) {
    const p = progressMap.get(w.id);
    if (p && (p.points || 0) >= 40) preferred.push(w);
    else others.push(w);
  }

  const result = [];
  const shuffledPreferred = shuffle(preferred);
  for (const w of shuffledPreferred) {
    if (result.length >= count) break;
    result.push(w);
  }
  if (result.length < count) {
    for (const w of shuffle(others)) {
      if (result.length >= count) break;
      if (!result.includes(w)) result.push(w);
    }
  }
  if (result.length < count) {
    for (const w of shuffle(source)) {
      if (result.length >= count) break;
      if (!result.includes(w)) result.push(w);
    }
  }
  return result.slice(0, count);
}

async function getAudioDistractorsForWord(word, count = 3, activeLevels) {
  const filterLevels = activeLevels && activeLevels.length > 0
    ? activeLevels
    : [word.level];
  if (!filterLevels.includes(word.level)) return [];
  const key = `audio:${filterLevels.slice().sort().join(",")}`;
  let pool = getCached(key);
  if (!pool) {
    pool = await db.words
      .where("level")
      .anyOf(filterLevels)
      .toArray();
    setCached(key, pool);
  }
  pool = pool.filter((w) => w.id !== word.id);
  const progressMap = await getProgressIndex();
  const today = todayKey();

  const candidates = pool.filter((w) => {
    const p = progressMap.get(w.id);
    if (p && p.lastTouchedDate === today) return false;
    return true;
  });

  const scored = candidates.map((w) => ({
    word: w,
    dist: levenshtein(w.word, word.word),
  }));
  scored.sort((a, b) => a.dist - b.dist);
  const close = scored.filter((s) => s.dist <= 3).slice(0, count);
  const result = close.map((s) => s.word);
  if (result.length < count) {
    const preferredRemaining = candidates
      .filter((w) => !result.includes(w) && (() => {
        const p = progressMap.get(w.id);
        return p && (p.points || 0) >= 40;
      })());
    const extra1 = shuffle(preferredRemaining).slice(0, count - result.length);
    result.push(...extra1);
  }
  if (result.length < count) {
    const extra = shuffle(candidates.filter((w) => !result.includes(w))).slice(
      0,
      count - result.length
    );
    result.push(...extra);
  }
  return result.slice(0, count);
}

function getTranslation(word, lang) {
  return word.translations?.[lang] || word.translations?.ru || "";
}

function shuffleOptions(correct, distractors) {
  const all = [correct, ...distractors];
  return shuffle(all);
}

function quizSpec(tag, attrs) {
  return { tag, attrs };
}

export async function quizEnToL1(word, lang, activeLevels) {
  const distractors = await getDistractorsForWord(word, 3, activeLevels);
  const correctTr = getTranslation(word, lang);
  const options = shuffleOptions(
    correctTr,
    distractors.map((d) => getTranslation(d, lang))
  );
  return quizSpec("quiz-choice", {
    prompt: word.word,
    options: JSON.stringify(options),
    "correct-index": String(options.indexOf(correctTr)),
    "word-type": word.type || "",
  });
}

export async function quizL1ToEn(word, lang, activeLevels) {
  const distractors = await getDistractorsForWord(word, 3, activeLevels);
  const translation = getTranslation(word, lang);
  const options = shuffleOptions(
    word.word,
    distractors.map((d) => d.word)
  );
  return quizSpec("quiz-choice", {
    prompt: translation,
    options: JSON.stringify(options),
    "correct-index": String(options.indexOf(word.word)),
    "word-type": word.type || "",
  });
}

export async function quizAudioToEn(word, lang, activeLevels) {
  const distractors = await getAudioDistractorsForWord(word, 3, activeLevels);
  const options = shuffleOptions(
    word.word,
    distractors.map((d) => d.word)
  );
  return quizSpec("quiz-choice", {
    prompt: "🔊",
    options: JSON.stringify(options),
    "correct-index": String(options.indexOf(word.word)),
    "audio-url": word.audio?.us_mp3 || "",
    "word-type": word.type || "",
  });
}

export async function quizTileL1En(word, lang, mode = "l1") {
  const extra = Math.min(4, Math.max(2, Math.floor(word.word.length / 4)));
  return quizSpec("quiz-letters", {
    prompt: mode === "audio" ? "🔊 Собери слово" : getTranslation(word, lang),
    target: word.word,
    extra: String(extra),
    "word-type": word.type || "",
    ...(mode === "audio" ? { "audio-url": word.audio?.us_mp3 || "" } : {}),
  });
}

export async function quizTileAudioEn(word, lang) {
  return quizTileL1En(word, lang, "audio");
}

export async function quizTypeIn(word, lang) {
  return quizSpec("quiz-input", {
    prompt: getTranslation(word, lang),
    target: word.word,
    "word-type": word.type || "",
  });
}

export async function quizAudioTypeIn(word, lang) {
  return quizSpec("quiz-input", {
    prompt: "🔊",
    target: word.word,
    "audio-url": word.audio?.us_mp3 || "",
    "word-type": word.type || "",
  });
}

export async function quizCloze(word, lang) {
  const example = word.examples?.[0];
  if (!example) return quizTypeIn(word, lang);
  const sentence = example.en;
  const escaped = regexEscape(word.word);
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  const masked = sentence.replace(regex, "___");
  if (masked === sentence) return quizTypeIn(word, lang);
  const translation = example[lang] || example.ru || "";
  return quizSpec("quiz-cloze", {
    sentence: masked,
    translation,
    "word-type": word.type || "",
  });
}

export async function quizClozeChoice(word, lang, activeLevels) {
  const example = word.examples?.[0];
  if (!example) return quizEnToL1(word, lang, activeLevels);
  const sentence = example.en;
  const escaped = regexEscape(word.word);
  const regex = new RegExp(`\\b${escaped}\\b`, "i");
  const masked = sentence.replace(regex, "___");
  if (masked === sentence) return quizEnToL1(word, lang, activeLevels);
  const translation = example[lang] || example.ru || "";
  const distractors = await getDistractorsForWord(word, 3, activeLevels);
  const options = shuffleOptions(
    word.word,
    distractors.map((d) => d.word)
  );
  return quizSpec("quiz-cloze", {
    sentence: masked,
    translation,
    options: JSON.stringify(options),
    "correct-index": String(options.indexOf(word.word)),
    "word-type": word.type || "",
  });
}

export const QUIZ_FACTORIES = {
  "en-to-l1": quizEnToL1,
  "l1-to-en": quizL1ToEn,
  "audio-to-en": quizAudioToEn,
  "cloze-choice": quizClozeChoice,
  "tile-l1-en": (w, l) => quizTileL1En(w, l, "l1"),
  "tile-audio-en": (w, l) => quizTileL1En(w, l, "audio"),
  "type-in": quizTypeIn,
  "cloze": quizCloze,
  "audio-type-in": quizAudioTypeIn,
};

export async function buildQuiz(quizType, word, lang, activeLevels) {
  const factory = QUIZ_FACTORIES[quizType];
  if (!factory) throw new Error(`Unknown quiz type: ${quizType}`);
  return factory(word, lang, activeLevels);
}

export const QUIZ_TYPES = Object.keys(QUIZ_FACTORIES);

export function xpForQuizType(quizType, correct) {
  if (!correct) return 1;
  switch (quizType) {
    case "type-in":
    case "cloze":
    case "audio-type-in":
      return 10;
    case "tile-l1-en":
    case "tile-audio-en":
      return 8;
    case "cloze-choice":
      return 7;
    default:
      return 5;
  }
}
