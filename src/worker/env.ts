/* What the Worker is given: its bindings, and its settings (text, each
   explained in wrangler.jsonc), with the default for each one not set. */
import { DEFAULT_MODEL, LOCATIONS, VISITOR_SALT } from "./constants.ts";
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
  ASK_DAILY_LIMIT?: string;
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
  dailyLimit: number;
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
  visitorLimit: 30,
  blockHours: 24,
  guardLocation: "enam",
  salt: VISITOR_SALT,
} as const satisfies Omit<Settings, "enabled" | "logQuestions">;

const isLocation = (value: string | undefined): value is DurableObjectLocationHint =>
  LOCATIONS.some((location) => location === value);

export function readSettings(env: Env): Settings {
  return {
    enabled: env.ASK_ENABLED === "true",
    model: env.ASK_MODEL || DEFAULTS.model,
    dailyLimit: positiveNumber(env.ASK_DAILY_LIMIT) ?? DEFAULTS.dailyLimit,
    visitorLimit: positiveNumber(env.ASK_VISITOR_LIMIT) ?? DEFAULTS.visitorLimit,
    blockHours: positiveNumber(env.ASK_BLOCK_HOURS) ?? DEFAULTS.blockHours,
    guardLocation: isLocation(env.ASK_GUARD_LOCATION) ? env.ASK_GUARD_LOCATION : DEFAULTS.guardLocation,
    logQuestions: env.ASK_LOG_QUESTIONS === "true",
    salt: env.ASK_SALT || DEFAULTS.salt,
  };
}
