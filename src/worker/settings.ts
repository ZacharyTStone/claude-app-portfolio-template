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

/** An email address, or "" where none is set. */
const address = <Variable extends string>(variable: Variable): Setting<Variable, string> => ({
  variable,
  default: "",
  read: (written) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(written) ? written : undefined),
});

/** One of `values`, as written; the default for anything else. */
const oneOf = <Variable extends string, Value extends string>(
  variable: Variable,
  values: readonly Value[],
  fallback: Value,
): Setting<Variable, Value> => ({
  variable,
  default: fallback,
  read: (written) => values.find((value) => value === written),
});

/** Who can send the contact form's emails: Cloudflare's send_email binding,
    or the API of Resend or Postmark (contact/providers.ts). */
export const CONTACT_SENDERS = ["cloudflare", "resend", "postmark"] as const;

export type ContactSender = (typeof CONTACT_SENDERS)[number];

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
      free allowance is 10,000 a day: the rest is room for the last
      question, which may take the day a little past the budget. */
  neuronBudget: numberAboveZero("ASK_DAILY_NEURONS", 9000),
  /** The questions one visitor may ask in a day. */
  visitorLimit: numberAboveZero("ASK_VISITOR_LIMIT", 30),
  /** How long a visitor is blocked for after an inappropriate question, in
      hours. One model's word sets a block, and an address can be a whole
      office's or a phone network's: an hour stops whoever is trying
      things without shutting the rest out for a day. A block ends with
      the day (UTC) if that comes first: the next day's hash is another. */
  blockHours: numberAboveZero("ASK_BLOCK_HOURS", 1),
  /** Where AskGuard is created. */
  guardLocation: {
    variable: "ASK_GUARD_LOCATION",
    default: "enam",
    read: (written) => DURABLE_OBJECT_LOCATIONS.find((location) => location === written),
  } satisfies Setting<"ASK_GUARD_LOCATION", DurableObjectLocationHint>,
  /** Whether the log has the questions themselves, and what came of them. */
  logQuestions: flag("ASK_LOG_QUESTIONS"),
  /** What visitors' addresses are hashed with, beside the day: a secret,
      where the site has set one. The hash keys a visitor's rate limit,
      count and any block, and their count of the contact form's messages,
      so changing this starts everyone afresh, as every midnight (UTC)
      does. */
  salt: text("ASK_SALT", "portfolio-ask:"),
  /** The contact form's messages the whole site sends in a day (UTC). */
  contactDailyLimit: numberAboveZero("CONTACT_DAILY_LIMIT", 20),
  /** The messages one visitor (a hashed address) may send in a day. */
  contactVisitorLimit: numberAboveZero("CONTACT_VISITOR_LIMIT", 3),
  /** Where the form's emails go: your own address, the one the send_email
      binding's destination_address locks it to (an API sender has no such
      lock: the Worker asks it to send here alone). Without it, /contact
      sends nothing. */
  contactTo: address("CONTACT_TO"),
  /** The address the form's emails come from, on a domain the sender
      sends from: one Email Routing is on for, or one verified with Resend
      or Postmark. Left out (""), it's portfolio@ and the domain the form
      was sent from, less a leading "www.". */
  contactFrom: address("CONTACT_FROM"),
  /** Who sends the form's emails: "cloudflare", the send_email binding, on
      a domain Email Routing is on for; or "resend" or "postmark", whose API
      the Worker asks with the secret CONTACT_API_KEY, from an address on a
      domain verified with them (docs/contact-form.md). */
  contactSender: oneOf("CONTACT_SENDER", CONTACT_SENDERS, "cloudflare"),
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
