/* A question costs what its model calls read and wrote, priced in Neurons:
   the day's budget (ASK_DAILY_NEURONS) is kept by what was used, not by a
   guess at it. */
import { TOKENS_PER_PRICE, type Price } from "./known-models.ts";

/** The fewest bytes of text a token is counted as, for a call that didn't
    say what it used: a token is rarely under three bytes of English, or
    under one Japanese character (three bytes), so the count errs high. */
const MIN_BYTES_PER_TOKEN = 3;

/** The tokens a call read (`input`) and wrote (`output`). */
export type Tokens = { input: number; output: number };

/** A call that wasn't made. */
export const NO_TOKENS: Tokens = { input: 0, output: 0 };

/** About how many tokens a text is, for a call that didn't say what it
    used. It errs high (MIN_BYTES_PER_TOKEN says why). */
export const estimateTokens = (text: string): number =>
  Math.ceil(new TextEncoder().encode(text).length / MIN_BYTES_PER_TOKEN);

/** The same for anything sent to a model or got back from one, as JSON. */
export const estimateJsonTokens = (value: unknown): number => estimateTokens(JSON.stringify(value) ?? "");

export const neuronCost = ({ input, output }: Tokens, price: Price): number =>
  (input * price.input + output * price.output) / TOKENS_PER_PRICE;
