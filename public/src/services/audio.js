import * as settings from "./settings.js";

let _enabled = null;
let _audioCtx = null;
let _sharedAudio = null;
let _listeners = new Set();

export function isSoundEnabled() {
  if (_enabled === null) _enabled = settings.get("soundEnabled");
  return _enabled;
}

export function refreshSoundSetting() {
  _enabled = settings.get("soundEnabled");
}

settings.onChange((key) => {
  if (key === "soundEnabled") refreshSoundSetting();
});

function ensureAudio() {
  if (!_sharedAudio && typeof Audio !== "undefined") {
    _sharedAudio = new Audio();
    _sharedAudio.preload = "none";
    _sharedAudio.addEventListener("ended", () => {
      for (const fn of _listeners) {
        try { fn({ state: "ended" }); } catch (e) {}
      }
    });
    _sharedAudio.addEventListener("error", () => {
      for (const fn of _listeners) {
        try { fn({ state: "error" }); } catch (e) {}
      }
    });
    _sharedAudio.addEventListener("playing", () => {
      for (const fn of _listeners) {
        try { fn({ state: "playing" }); } catch (e) {}
      }
    });
  }
  return _sharedAudio;
}

export function onAudioState(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export async function playAudioUrl(url) {
  if (!url) return false;
  try {
    const audio = ensureAudio();
    if (!audio) return false;
    audio.src = url;
    await audio.play().catch(() => {});
    return true;
  } catch (e) {
    return false;
  }
}

const TONES = {
  correct: { freq: 660, duration: 0.12, type: "sine" },
  wrong: { freq: 180, duration: 0.18, type: "square" },
  complete: { freq: 880, duration: 0.25, type: "triangle" },
  click: { freq: 440, duration: 0.04, type: "sine" },
};

function getCtx() {
  if (_audioCtx) return _audioCtx;
  if (typeof window !== "undefined" && window.__audioCtx) {
    _audioCtx = window.__audioCtx;
    return _audioCtx;
  }
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    _audioCtx = new Ctx();
  } catch (e) {
    return null;
  }
  return _audioCtx;
}

export async function resumeAudioCtx() {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    try {
      await ctx.resume();
    } catch (e) {}
  }
}

export function playTone(name) {
  if (!isSoundEnabled()) return;
  const spec = TONES[name];
  if (!spec) return;
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = spec.type;
    osc.frequency.value = spec.freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + spec.duration);
    osc.start();
    osc.stop(ctx.currentTime + spec.duration);
  } catch (e) {}
}

export function playCorrect() {
  playTone("correct");
}

export function playWrong() {
  playTone("wrong");
}

export function playComplete() {
  playTone("complete");
}

export function playClick() {
  playTone("click");
}

export function vibrate(pattern) {
  if (!settings.get("vibrationEnabled")) return;
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch (e) {}
}

export function _resetForTests() {
  if (_audioCtx) {
    try {
      _audioCtx.close();
    } catch (e) {}
    _audioCtx = null;
  }
}