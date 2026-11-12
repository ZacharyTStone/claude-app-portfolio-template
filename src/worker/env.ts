/* What the Worker is given: its bindings, and its settings (text, each
   explained in wrangler.jsonc), with the default for each one not set. */
import { DEFAULT_MODEL, DEFAULT_VISITOR_SALT, MODEL_PRICES, UNLISTED_MODEL_PRICE, type Price } from "./constants.ts";
import { positiveNumber } from "./lib/shape.ts";

/** The Worker's bindings and variables, as wrangler.jsonc names them. */
export type Env = {
  /** Workers AI: the model that picks an answer, and Llama Guard. */
  AI: Ai;
  /** The built site's files (dist/), ask.json among them. */
  ASSETS: Fetcher;
  /** Questions a minute from one visitor. Without it, /ask picks nothing. */
  ASK_LIMIT?: RateLimit;
  /** AskGuard: the daily counts, and blocks. Without it, /ask picks nothing. */
  ASK_GUARD?: DurableObjectNamespace;
  /** "true" turns /ask on; anything else, off. */
  ASK_ENABLED?: string;
  /** The Workers AI model that picks and writes. */
  ASK_MODEL?: string;
  /** "5500/36400": what ASK_MODEL costs, in Neurons for a million tokens
      read and a million written, if it isn't the price in constants.ts. */
  ASK_MODEL_PRICE?: string;
  /** Questions a day, for the whole site. */
  ASK_DAILY_LIMIT?: string;
  /** Neurons a day's questions may cost, for the whole site. */
  ASK_DAILY_NEURONS?: string;
  /** Questions a day from one visitor. */
  ASK_VISITOR_LIMIT?: string;
  /** Hours a visitor is blocked for after an inappropriate question. */
  ASK_BLOCK_HOURS?: string;
  /** Where AskGuard is created: one of DURABLE_OBJECT_LOCATIONS. */
  ASK_GUARD_LOCATION?: string;
  /** "true" adds what was asked, and what came of it, to each log line. */
  ASK_LOG_QUESTIONS?: string;
  /** A secret: what visitors' addresses are hashed with. */
  ASK_SALT?: string;
};

/** The settings, read from Env. */
export type Settings = {
  /** Whether /ask answers at all (ASK_ENABLED). */
  enabled: boolean;
  /** The model that picks an answer and writes the reply (ASK_MODEL). */
  model: string;
  /** What that model's tokens cost. */
  price: Price;
  /** The questions the whole site may be asked in a day (ASK_DAILY_LIMIT). */
  dailyLimit: number;
  /** The Neurons a day's questions may cost, the whole site's
      (ASK_DAILY_NEURONS). */
  neuronBudget: number;
  /** The questions one visitor may ask in a day (ASK_VISITOR_LIMIT). */
  visitorLimit: number;
  /** How long a visitor is blocked for, in hours (ASK_BLOCK_HOURS). */
  blockHours: number;
  /** Where AskGuard is created (ASK_GUARD_LOCATION). */
  guardLocation: DurableObjectLocationHint;
  /** Whether the log has the questions themselves (ASK_LOG_QUESTIONS). */
  logQuestions: boolean;
  /** What visitors' addresses are hashed with (ASK_SALT). */
  salt: string;
};

/** What each setting is when it isn't set, or isn't one it can be. */
export const DEFAULTS = {
  model: DEFAULT_MODEL,
  dailyLimit: 200,
  // Workers AI's free allowance is 10,000 a day: the rest is room for the
  // questions already on their way when the budget is reached.
  neuronBudget: 9000,
  visitorLimit: 30,
  blockHours: 24,
  guardLocation: "enam",
  salt: DEFAULT_VISITOR_SALT,
} as const satisfies Omit<Settings, "enabled" | "logQuestions" | "price">;

/** Cloudflare's location hints for a Durable Object (ASK_GUARD_LOCATION is
    one of them). */
export const DURABLE_OBJECT_LOCATIONS: readonly DurableObjectLocationHint[] = [
  "wnam",
  "enam",
  "sam",
  "weur",
  "eeur",
  "apac",
  "oc",
  "afr",
  "me",
];

const isLocationHint = (value: string | undefined): value is DurableObjectLocationHint =>
  DURABLE_OBJECT_LOCATIONS.some((location) => location === value);

// A price as ASK_MODEL_PRICE gives it, "5500/36400": two numbers above 0,
// for a million tokens read and a million written. Anything else is no price.
function parsePrice(text: string | undefined): Price | undefined {
  const [input, output, ...extra] = (text ?? "").split("/").map((part) => positiveNumber(part.trim()));
  return input != null && output != null && !extra.length ? { input, output } : undefined;
}

/** The settings the Worker runs with: each from its variable, or its
    default where the variable isn't set or can't be read. */
export function readSettings(env: Env): Settings {
  const model = env.ASK_MODEL || DEFAULTS.model;
  return {
    enabled: env.ASK_ENABLED === "true",
    model,
    price: parsePrice(env.ASK_MODEL_PRICE) ?? MODEL_PRICES.get(model) ?? UNLISTED_MODEL_PRICE,
    dailyLimit: positiveNumber(env.ASK_DAILY_LIMIT) ?? DEFAULTS.dailyLimit,
    neuronBudget: positiveNumber(env.ASK_DAILY_NEURONS) ?? DEFAULTS.neuronBudget,
    visitorLimit: positiveNumber(env.ASK_VISITOR_LIMIT) ?? DEFAULTS.visitorLimit,
    blockHours: positiveNumber(env.ASK_BLOCK_HOURS) ?? DEFAULTS.blockHours,
    guardLocation: isLocationHint(env.ASK_GUARD_LOCATION) ? env.ASK_GUARD_LOCATION : DEFAULTS.guardLocation,
    logQuestions: env.ASK_LOG_QUESTIONS === "true",
    salt: env.ASK_SALT || DEFAULTS.salt,
  };
}
