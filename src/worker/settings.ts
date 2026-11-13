/* The Worker's settings. A site's owner sets each as a variable in
   wrangler.jsonc, which explains them; one that isn't set, or says nothing
   the Worker can read, is its default. */
import { mapValues } from "es-toolkit";
import { DEFAULT_MODEL, priceOf, type Price } from "./ask/known-models.ts";
import { positiveNumber } from "./lib/shape.ts";

type Setting<Variable extends string, Value> = {
  variable: Variable;
  default: Value;
  /** The variable's text as the setting's value; undefined when it isn't one. */
  read: (text: string) => Value | undefined;
};

function readFlag(text: string): boolean | undefined {
  if (text === "true") return true;
  return text === "false" ? false : undefined;
}

const flag = <Variable extends string>(variable: Variable): Setting<Variable, boolean> => ({
  variable,
  default: false,
  read: readFlag,
});

const text = <Variable extends string>(variable: Variable, fallback: string): Setting<Variable, string> => ({
  variable,
  default: fallback,
  read: (written) => written || undefined,
});

const numberAboveZero = <Variable extends string>(variable: Variable, fallback: number): Setting<Variable, number> => ({
  variable,
  default: fallback,
  read: (written) => positiveNumber(written) ?? undefined,
});

/** Cloudflare's location hints for a Durable Object. */
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

// "5500/36400": two numbers above 0, and nothing else.
function readPrice(written: string): Price | undefined {
  const [input, output, ...extra] = written.split("/").map((part) => positiveNumber(part.trim()));
  return input != null && output != null && !extra.length ? { input, output } : undefined;
}

export const SETTINGS = {
  /** Whether /ask answers at all. */
  enabled: flag("ASK_ENABLED"),
  /** The Workers AI model that picks an answer and writes the reply. */
  model: text("ASK_MODEL", DEFAULT_MODEL),
  /** What that model costs, where it isn't what known-models.ts has: Neurons
      for a million tokens read and a million written, as "5500/36400". */
  modelPrice: {
    variable: "ASK_MODEL_PRICE",
    default: undefined,
    read: readPrice,
  } satisfies Setting<"ASK_MODEL_PRICE", Price | undefined>,
  /** The questions the whole site may be asked in a day. */
  dailyLimit: numberAboveZero("ASK_DAILY_LIMIT", 200),
  /** The Neurons a day's questions may cost, the whole site's. Workers AI's
      free allowance is 10,000 a day: the rest is room for the questions
      already on their way when the budget is reached. */
  neuronBudget: numberAboveZero("ASK_DAILY_NEURONS", 9000),
  /** The questions one visitor may ask in a day. */
  visitorLimit: numberAboveZero("ASK_VISITOR_LIMIT", 30),
  /** How long a visitor is blocked for after an inappropriate question, in hours. */
  blockHours: numberAboveZero("ASK_BLOCK_HOURS", 24),
  /** Where AskGuard is created. */
  guardLocation: {
    variable: "ASK_GUARD_LOCATION",
    default: "enam",
    read: (written) => DURABLE_OBJECT_LOCATIONS.find((location) => location === written),
  } satisfies Setting<"ASK_GUARD_LOCATION", DurableObjectLocationHint>,
  /** Whether the log has the questions themselves, and what came of them. */
  logQuestions: flag("ASK_LOG_QUESTIONS"),
  /** What visitors' addresses are hashed with: a secret, where the site has
      set one. The hash keys a visitor's rate limit, count and any block, so
      changing this starts everyone afresh (counts are per day and blocks
      last a day, so nothing much is lost). */
  salt: text("ASK_SALT", "portfolio-ask:"),
};

type Rows = typeof SETTINGS;
type RowValues = { [Name in keyof Rows]: Rows[Name]["default"] };

/** Each setting's value, and the price the model's tokens are counted at. */
export type Settings = RowValues & { price: Price };

/** The variables the settings are read from, as the Worker is given them. */
export type Variables = { readonly [Variable in Rows[keyof Rows]["variable"]]?: string };

export function readSettings(variables: Variables): Settings {
  const values = mapValues(SETTINGS, (row) => row.read(variables[row.variable] ?? "") ?? row.default) as RowValues;
  return { ...values, price: values.modelPrice ?? priceOf(values.model) };
}
