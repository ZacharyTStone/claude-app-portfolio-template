/* The Worker's settings (src/worker/settings.ts): each is what its variable
   says, or its default when the variable isn't set or can't be read. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mapValues } from "es-toolkit";
import { DEFAULT_MODEL, KNOWN_MODELS, UNLISTED_MODEL_PRICE } from "../../src/worker/ask/known-models.ts";
import { DURABLE_OBJECT_LOCATIONS, SETTINGS, readSettings } from "../../src/worker/settings.ts";

const DEFAULTS = mapValues(SETTINGS, (row) => row.default);
const UNLISTED_MODEL = "@cf/someone/some-model";

test("with no variable set, every setting is its default, and the model is priced as known-models.ts has it", () => {
  assert.deepEqual(readSettings({}), { ...DEFAULTS, price: KNOWN_MODELS.get(DEFAULT_MODEL)?.price });
});

test("each setting is read from its own variable", () => {
  const settings = readSettings({
    ASK_ENABLED: "true",
    ASK_MODEL: UNLISTED_MODEL,
    ASK_MODEL_PRICE: "1000/2000",
    ASK_DAILY_LIMIT: "7",
    ASK_DAILY_NEURONS: "1200",
    ASK_VISITOR_LIMIT: "5",
    ASK_BLOCK_HOURS: "2",
    ASK_GUARD_LOCATION: "weur",
    ASK_LOG_QUESTIONS: "true",
    ASK_SALT: "a secret",
  });
  assert.deepEqual(settings, {
    enabled: true,
    model: UNLISTED_MODEL,
    modelPrice: { input: 1000, output: 2000 },
    dailyLimit: 7,
    neuronBudget: 1200,
    visitorLimit: 5,
    blockHours: 2,
    guardLocation: "weur",
    logQuestions: true,
    salt: "a secret",
    price: { input: 1000, output: 2000 },
  });
});

test('a flag is on only when its variable says "true"', () => {
  for (const written of ["false", "TRUE", "1", ""]) {
    const { enabled, logQuestions } = readSettings({ ASK_ENABLED: written, ASK_LOG_QUESTIONS: written });
    assert.deepEqual({ enabled, logQuestions }, { enabled: false, logQuestions: false }, written);
  }
});

test("a number that isn't above 0, or isn't a number at all, is the default", () => {
  for (const written of ["0", "-1", "Infinity", "lots", ""]) {
    const settings = readSettings({
      ASK_DAILY_LIMIT: written,
      ASK_DAILY_NEURONS: written,
      ASK_VISITOR_LIMIT: written,
      ASK_BLOCK_HOURS: written,
    });
    assert.deepEqual(settings, readSettings({}), written);
  }
});

test("AskGuard's location is any of Cloudflare's hints", () => {
  for (const location of DURABLE_OBJECT_LOCATIONS) {
    assert.equal(readSettings({ ASK_GUARD_LOCATION: location }).guardLocation, location);
  }
});

test("a location that isn't one of them is the default", () => {
  for (const written of ["mars", "ENAM", ""]) {
    assert.equal(readSettings({ ASK_GUARD_LOCATION: written }).guardLocation, SETTINGS.guardLocation.default, written);
  }
});

test("a model or a salt set to nothing is the default", () => {
  assert.deepEqual(readSettings({ ASK_MODEL: "", ASK_SALT: "" }), readSettings({}));
});

test("a model is priced as known-models.ts has it, and one that isn't there as a model not listed", () => {
  const [listed, known] = [...KNOWN_MODELS].find(([model]) => model !== DEFAULT_MODEL) ?? [];
  assert.deepEqual(readSettings({ ASK_MODEL: listed }).price, known?.price);
  assert.deepEqual(readSettings({ ASK_MODEL: UNLISTED_MODEL }).price, UNLISTED_MODEL_PRICE);
});

test("ASK_MODEL_PRICE is a price of the model's own: two numbers above 0, with or without spaces", () => {
  assert.deepEqual(readSettings({ ASK_MODEL_PRICE: " 1000 / 2000 " }).price, { input: 1000, output: 2000 });
});

test("an ASK_MODEL_PRICE that isn't two numbers above 0 leaves the model's own price", () => {
  for (const written of ["1000", "1000/", "0/2000", "a/b", "1000/2000/3000", ""]) {
    assert.deepEqual(readSettings({ ASK_MODEL_PRICE: written }).price, readSettings({}).price, written);
  }
});
