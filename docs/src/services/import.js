import db, { invalidateCache } from "./db.js";

export function mapWord(raw) {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid raw entry");
  }
  const v = raw.value;
  if (!v || typeof v !== "object") {
    throw new Error(`Entry ${raw.id} has no value`);
  }
  if (typeof v.word !== "string" || v.word.length === 0) {
    throw new Error(`Entry ${raw.id} has invalid word`);
  }
  if (!v.translations || typeof v.translations !== "object") {
    throw new Error(`Entry ${raw.id} has no translations`);
  }
  if (typeof v.level !== "string") {
    throw new Error(`Entry ${raw.id} has no level`);
  }

  return {
    id: raw.id,
    word: v.word,
    translations: {
      ru: v.translations.ru || "",
      ua: v.translations.ua || "",
    },
    type: v.type || "",
    level: v.level,
    audio: {
      us_mp3: v.us?.mp3 || "",
      us_ogg: v.us?.ogg || "",
      uk_mp3: v.uk?.mp3 || "",
      uk_ogg: v.uk?.ogg || "",
    },
    phonetics: {
      us: v.phonetics?.us || "",
      uk: v.phonetics?.uk || "",
    },
    examples: Array.isArray(v.examples)
      ? v.examples.map((ex) => ({
          en: ex.en || "",
          ru: ex.ru || "",
          ua: ex.ua || "",
        }))
      : [],
  };
}

export function mapAll(rawArray) {
  return rawArray.map(mapWord);
}

export async function importFromArray(rawArray, onProgress) {
  const mapped = [];
  const skipped = [];
  const total = rawArray.length;
  for (let i = 0; i < total; i++) {
    try {
      mapped.push(mapWord(rawArray[i]));
    } catch (e) {
      skipped.push({ index: i, id: rawArray[i]?.id, error: e.message });
    }
    if (onProgress && (i % 500 === 0 || i === total - 1)) {
      onProgress(i + 1, total);
    }
  }
  if (mapped.length) {
    await db.words.bulkPut(mapped);
    invalidateCache("words");
  }
  if (skipped.length) {
    console.warn(`[import] skipped ${skipped.length}/${total} malformed entries`);
  }
  return { imported: mapped.length, skipped: skipped.length };
}

export async function importFromUrl(url = "./data/words.json", onProgress) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const raw = await res.json();
  return importFromArray(raw, onProgress);
}


export async function isImported() {
  const count = await db.words.count();
  return count > 0;
}
