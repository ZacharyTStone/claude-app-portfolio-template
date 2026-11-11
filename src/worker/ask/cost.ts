/* What a question costs: the tokens each model call read and wrote, as
   Workers AI reports them, priced in Neurons (PRICES, in constants.ts).
   AskGuard adds up the day's, and stops at the budget (ASK_DAILY_NEURONS):
   the allowance is kept by what was used, not by a guess at it. */
import type { Price } from "../constants.ts";
import { get } from "../lib/shape.ts";

/** The tokens a call read (`input`) and wrote (`output`). */
export type Tokens = { input: number; output: number };

/** A call that wasn't made. */
export const NO_TOKENS: Tokens = { input: 0, output: 0 };

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** The tokens a reply says its call used, by either pair of names Workers
    AI gives them; undefined if it doesn't say. */
export function tokensUsed(result: unknown): Tokens | undefined {
  const usage = get(result, "usage");
  const input = get(usage, "prompt_tokens") ?? get(usage, "input_tokens");
  const output = get(usage, "completion_tokens") ?? get(usage, "output_tokens");
  return isCount(input) && isCount(output) ? { input, output } : undefined;
}

/** About how many tokens a text is, for a call that didn't say what it
    used. It errs high: a token is rarely under three bytes of English, or
    under one Japanese character (three bytes). */
export const tokensIn = (text: string): number => Math.ceil(new TextEncoder().encode(text).length / 3);

/** The same for anything sent to a model or got back from one, as JSON. */
export const tokensInJson = (value: unknown): number => tokensIn(JSON.stringify(value) ?? "");

/** What the tokens cost at `price`, in Neurons. */
export const neurons = ({ input, output }: Tokens, price: Price): number =>
  (input * price.input + output * price.output) / 1_000_000;
