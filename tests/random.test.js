import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  pickRandom,
  pickN,
  shuffle,
  shuffleInPlace,
  makeSeededRng,
  levenshtein,
} from "../public/src/services/random.js";

describe("pickRandom", () => {
  test("returns undefined for empty array", () => {
    assert.equal(pickRandom([]), undefined);
  });
  test("returns element from array", () => {
    const a = pickRandom([1, 2, 3]);
    assert.ok([1, 2, 3].includes(a));
  });
  test("uses provided RNG", () => {
    const rng = () => 0.99;
    assert.equal(pickRandom([1, 2, 3], rng), 3);
  });
});

describe("pickN", () => {
  test("returns n elements", () => {
    const r = pickN([1, 2, 3, 4, 5], 3);
    assert.equal(r.length, 3);
  });
  test("does not return more than array length", () => {
    const r = pickN([1, 2], 10);
    assert.equal(r.length, 2);
  });
  test("returns empty for empty input", () => {
    assert.deepEqual(pickN([], 5), []);
  });
  test("result has no duplicates", () => {
    const r = pickN([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5);
    assert.equal(new Set(r).size, 5);
  });
});

describe("shuffle / shuffleInPlace", () => {
  test("shuffleInPlace mutates and returns same array", () => {
    const arr = [1, 2, 3, 4];
    const ref = arr;
    const out = shuffleInPlace(arr);
    assert.equal(out, ref);
    assert.equal(arr.length, 4);
  });
  test("shuffle returns new array", () => {
    const arr = [1, 2, 3, 4];
    const out = shuffle(arr);
    assert.notEqual(out, arr);
  });
  test("shuffle preserves elements", () => {
    const arr = [1, 2, 3, 4, 5];
    const out = shuffle(arr);
    assert.deepEqual(out.slice().sort(), arr.slice().sort());
  });
});

describe("makeSeededRng", () => {
  test("deterministic with same seed", () => {
    const a = makeSeededRng(42);
    const b = makeSeededRng(42);
    for (let i = 0; i < 10; i++) {
      assert.equal(a(), b());
    }
  });
  test("produces values in [0, 1)", () => {
    const rng = makeSeededRng(123);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      assert.ok(v >= 0 && v < 1);
    }
  });
});

describe("levenshtein", () => {
  test("identical strings have distance 0", () => {
    assert.equal(levenshtein("cat", "cat"), 0);
  });
  test("empty strings", () => {
    assert.equal(levenshtein("", ""), 0);
    assert.equal(levenshtein("abc", ""), 3);
    assert.equal(levenshtein("", "abc"), 3);
  });
  test("single substitution", () => {
    assert.equal(levenshtein("cat", "bat"), 1);
  });
  test("single insertion", () => {
    assert.equal(levenshtein("cat", "cats"), 1);
  });
  test("single deletion", () => {
    assert.equal(levenshtein("cats", "cat"), 1);
  });
  test("completely different strings", () => {
    assert.equal(levenshtein("cat", "dog"), 3);
  });
  test("example from spec: similar-sounding words", () => {
    assert.ok(levenshtein("about", "aboot") <= 3);
    assert.ok(levenshtein("there", "their") <= 3);
  });
});