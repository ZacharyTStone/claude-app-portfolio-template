/* Workers AI is called here and nowhere else, and its replies are read here
   and nowhere else: the shapes they come in are Cloudflare's to change. */
import { isString } from "../../contracts/guards.ts";
import { arrayOrEmpty, get } from "../lib/shape.ts";
import { withinTime } from "../lib/time.ts";
import { estimateJsonTokens, type Tokens } from "./cost.ts";
import { reasoningOptionsOf } from "./known-models.ts";

/** A call counted by its size: what the model read (`prompt`) and what
    came back. One the clock cut off is paid for all the same, and counted
    as if it wrote all it may (`maxOutputTokens`). */
type CountedBySize = { prompt: unknown; maxOutputTokens: number };

export type ModelCall = {
  /** All the model is sent: its messages, any tools, and its options. */
  input: Record<string, unknown>;
  /** How long its reply is waited for, in milliseconds. Left out, as long
      as it takes. */
  timeoutMs?: number;
  /** What the call is counted as using when its reply doesn't say. */
  tokensIfUnreported: Tokens | CountedBySize;
};

/** A model's reply (undefined when the clock cut the call off) and the
    tokens the call is counted as using. */
export type Called = { modelReply: unknown; tokens: Tokens };

/** Rejects when Workers AI can't run the model. */
export async function callModel(ai: Ai, model: string, call: ModelCall): Promise<Called> {
  const { input, timeoutMs, tokensIfUnreported } = call;
  const running = ai.run(model, input);
  const modelReply: unknown = timeoutMs === undefined ? await running : await withinTime(running, timeoutMs);
  const wasCutOff = timeoutMs !== undefined && modelReply === undefined;
  return { modelReply, tokens: tokensUsed(modelReply) ?? tokensAssumed(tokensIfUnreported, modelReply, wasCutOff) };
}

function tokensAssumed(assumed: Tokens | CountedBySize, modelReply: unknown, wasCutOff: boolean): Tokens {
  if (!("prompt" in assumed)) return assumed;
  return {
    input: estimateJsonTokens(assumed.prompt),
    output: wasCutOff ? assumed.maxOutputTokens : estimateJsonTokens(modelReply),
  };
}

const isTokenCount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

/** The tokens a reply says its call used, by either pair of names Workers
    AI gives them; undefined if it doesn't say. */
export function tokensUsed(modelReply: unknown): Tokens | undefined {
  const usage = get(modelReply, "usage");
  const input = get(usage, "prompt_tokens") ?? get(usage, "input_tokens");
  const output = get(usage, "completion_tokens") ?? get(usage, "output_tokens");
  return isTokenCount(input) && isTokenCount(output) ? { input, output } : undefined;
}

export type Message = { role: "system" | "user" | "assistant"; content: string };

/** What a call for a line of text is sent, besides the model's own options. */
export type Prompt = { messages: Message[]; temperature: 0 };

export type TextLimits = {
  /** The most the model may write, in tokens. */
  maxTokens: number;
  /** How long its reply is waited for, in milliseconds. */
  timeoutMs: number;
};

/** One call for a line of text. Rejects when Workers AI can't run the
    model. */
export const callForText = (ai: Ai, model: string, prompt: Prompt, limits: TextLimits): Promise<Called> =>
  callModel(ai, model, {
    input: { ...prompt, ...reasoningOptionsOf(model), max_completion_tokens: limits.maxTokens },
    timeoutMs: limits.timeoutMs,
    tokensIfUnreported: { prompt, maxOutputTokens: limits.maxTokens },
  });

/** What a reply says, as the model wrote it, in either shape Workers AI
    gives it; undefined when it says nothing in text. */
export function rawTextIn(modelReply: unknown): string | undefined {
  const text = get(modelReply, "choices", 0, "message", "content") ?? get(modelReply, "response");
  return isString(text) ? text : undefined;
}

// The reasoning some models write before their reply:
// "<think>The lines list Svelte.</think>".
const REASONING = /<think>[\s\S]*?<\/think>/g;

/** That text on one line, without the reasoning some models write first.
    "" when there's none. */
export const textIn = (modelReply: unknown): string =>
  (rawTextIn(modelReply) ?? "").replace(REASONING, " ").replace(/\s+/g, " ").trim();

/** Whether the model stopped because it had written all it may, with more
    to say: what it wrote is cut off. */
export const ranOutOfRoom = (modelReply: unknown): boolean =>
  get(modelReply, "choices", 0, "finish_reason") === "length";

/** The arguments of each tool call in a reply, in either shape Workers AI
    returns: `choices[0].message.tool_calls`, each with its arguments under
    `function`; or `tool_calls` at the top, with them on the call itself. */
export function toolCallArguments(modelReply: unknown): unknown[] {
  const message = get(modelReply, "choices", 0, "message");
  const toolCalls = arrayOrEmpty(get(message, "tool_calls") ?? get(modelReply, "tool_calls"));
  return toolCalls.map((toolCall) => parsed(get(toolCall, "function", "arguments") ?? get(toolCall, "arguments")));
}

// Arguments come as an object, or as JSON text of one.
function parsed(sentArguments: unknown): unknown {
  if (!isString(sentArguments)) return sentArguments;
  try {
    return JSON.parse(sentArguments);
  } catch {
    return null;
  }
}

/** Whether Llama Guard's reply calls what it read unsafe. Its verdict comes
    as text ("safe", "unsafe\nS10") or as { safe, categories }; a reply with
    no verdict (it was too slow to give one) isn't "unsafe". */
export function isUnsafeVerdict(modelReply: unknown): boolean {
  const verdict = get(modelReply, "response");
  if (typeof verdict === "string") return verdict.trim().toLowerCase().startsWith("unsafe");
  return get(verdict, "safe") === false;
}
