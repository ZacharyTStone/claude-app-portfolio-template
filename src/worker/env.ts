/* What the Worker is given: its bindings, and its settings (text, each
   explained in wrangler.jsonc), with the default for each one not set. */
import { DEFAULT_MODEL, LOCATIONS, PRICES, UNLISTED_PRICE, VISITOR_SALT, type Price } from "./constants.ts";
import { positiveNumber } from "./lib/shape.ts";

export type Env = {
  /** Workers AI: the model that picks an answer, and Llama Guard. */
  AI: Ai;
  /** The built site's files (dist/), ask.json among them. */
  ASSETS: Fetcher;
  /** Questions a minute from one visitor. Without it, /ask picks nothing. */
  ASK_LIMIT?: RateLimit;
  /** AskGuard: the daily counts, and blocks. Without it, /ask picks nothing. */
  ASK_GUARD?: DurableObjectNamespace;
  ASK_ENABLED?: string;
  ASK_MODEL?: string;
  /** "5500/36400": what ASK_MODEL costs, in Neurons for a million tokens
      read and a million written, if it isn't the price in constants.ts. */
  ASK_MODEL_PRICE?: string;
  ASK_DAILY_LIMIT?: string;
  ASK_DAILY_NEURONS?: string;
  ASK_VISITOR_LIMIT?: string;
  ASK_BLOCK_HOURS?: string;
  ASK_GUARD_LOCATION?: string;
  ASK_LOG_QUESTIONS?: string;
  /** A secret: what visitors' addresses are hashed with. */
  ASK_SALT?: string;
};

/** The settings, read from Env. */
export type Settings = {
  enabled: boolean;
  model: string;
  /** What the picker's tokens cost. */
  price: Price;
  dailyLimit: number;
  /** The Neurons a day's questions may cost, the whole site's. */
  neuronBudget: number;
  visitorLimit: number;
  blockHours: number;
  guardLocation: DurableObjectLocationHint;
  logQuestions: boolean;
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
  salt: VISITOR_SALT,
} as const satisfies Omit<Settings, "enabled" | "logQuestions" | "price">;

const isLocation = (value: string | undefined): value is DurableObjectLocationHint =>
  LOCATIONS.some((location) => location === value);

// A price as a setting gives it: "5500/36400".
function readPrice(text: string | undefined): Price | undefined {
  const [input, output, ...rest] = (text ?? "").split("/").map((part) => positiveNumber(part.trim()));
  return input != null && output != null && !rest.length ? { input, output } : undefined;
}

export function readSettings(env: Env): Settings {
  const model = env.ASK_MODEL || DEFAULTS.model;
  return {
    enabled: env.ASK_ENABLED === "true",
    model,
    price: readPrice(env.ASK_MODEL_PRICE) ?? PRICES.get(model) ?? UNLISTED_PRICE,
    dailyLimit: positiveNumber(env.ASK_DAILY_LIMIT) ?? DEFAULTS.dailyLimit,
    neuronBudget: positiveNumber(env.ASK_DAILY_NEURONS) ?? DEFAULTS.neuronBudget,
    visitorLimit: positiveNumber(env.ASK_VISITOR_LIMIT) ?? DEFAULTS.visitorLimit,
    blockHours: positiveNumber(env.ASK_BLOCK_HOURS) ?? DEFAULTS.blockHours,
    guardLocation: isLocation(env.ASK_GUARD_LOCATION) ? env.ASK_GUARD_LOCATION : DEFAULTS.guardLocation,
    logQuestions: env.ASK_LOG_QUESTIONS === "true",
    salt: env.ASK_SALT || DEFAULTS.salt,
  };
}
