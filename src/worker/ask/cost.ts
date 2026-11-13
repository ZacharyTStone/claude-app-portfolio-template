/* What a question costs: the tokens each model call read and wrote, as
   Workers AI reports them, priced in Neurons (known-models.ts). AskGuard
   adds up the day's, and stops at the budget (ASK_DAILY_NEURONS): the
   allowance is kept by what was used, not by a guess at it. */
import { MIN_BYTES_PER_TOKEN, TOKENS_PER_PRICE } from "../constants.ts";
import { get } from "../lib/shape.ts";
import type { Price } from "./known-models.ts";

/** The tokens a call read (`input`) and wrote (`output`). */
export type Tokens = { input: number; output: number };

/** A call that wasn't made. */
export const NO_TOKENS: Tokens = { input: 0, output: 0 };

// A number of tokens as a model reports it: 0 or more, and not Infinity.
const isTokenCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** The tokens a model's reply says its call used, by either pair of names
    Workers AI gives them; undefined if it doesn't say. */
export function tokensUsed(modelReply: unknown): Tokens | undefined {
  const usage = get(modelReply, "usage");
  const input = get(usage, "prompt_tokens") ?? get(usage, "input_tokens");
  const output = get(usage, "completion_tokens") ?? get(usage, "output_tokens");
  return isTokenCount(input) && isTokenCount(output) ? { input, output } : undefined;
}

/** About how many tokens a text is, for a call that didn't say what it
    used. It errs high (MIN_BYTES_PER_TOKEN says why). */
export const estimateTokens = (text: string): number =>
  Math.ceil(new TextEncoder().encode(text).length / MIN_BYTES_PER_TOKEN);

/** The same for anything sent to a model or got back from one, as JSON. */
export const estimateJsonTokens = (value: unknown): number => estimateTokens(JSON.stringify(value) ?? "");

/** What the tokens cost at `price`, in Neurons. */
export const neuronCost = ({ input, output }: Tokens, price: Price): number =>
  (input * price.input + output * price.output) / TOKENS_PER_PRICE;
