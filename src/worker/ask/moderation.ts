/* Llama Guard's verdict on a question, beside the picker's own judgement
   (it can call a question "inappropriate"): either turns it away. Llama
   Guard has no category for an attempt to redirect the model; the picker does. */
import {
  LLAMA_GUARD_MODEL,
  LLAMA_GUARD_OPTIONS,
  LLAMA_GUARD_PROMPT_TOKENS,
  LLAMA_GUARD_TIMEOUT_MS,
} from "../constants.ts";
import { get } from "../lib/shape.ts";
import { withinTime } from "../lib/time.ts";
import { NO_TOKENS, estimateTokens, tokensUsed, type Tokens } from "./cost.ts";

/** Llama Guard's verdict on a question, and the tokens its call used. */
export type Verdict = { isUnsafe: boolean; tokens: Tokens };

// Its verdict comes as text ("safe", "unsafe\nS10") or as { safe, categories }.
// No verdict at all (it was too slow to give one) isn't "unsafe".
function isUnsafeVerdict(modelReply: unknown): boolean {
  const verdict = get(modelReply, "response");
  if (typeof verdict === "string") return verdict.trim().toLowerCase().startsWith("unsafe");
  return get(verdict, "safe") === false;
}

/** `isUnsafe` if Llama Guard calls the question that within `timeoutMs`.
    If it can't say by then, or fails, the picker's judgement stands. */
export async function llamaGuardVerdict(
  ai: Ai,
  question: string,
  timeoutMs: number = LLAMA_GUARD_TIMEOUT_MS,
): Promise<Verdict> {
  // What a call is counted as when it doesn't say what it used, or is still
  // running when the time is up: it is paid for all the same.
  const assumedTokens: Tokens = {
    input: LLAMA_GUARD_PROMPT_TOKENS + estimateTokens(question),
    output: LLAMA_GUARD_OPTIONS.max_tokens,
  };
  try {
    const call = ai.run(LLAMA_GUARD_MODEL, { messages: [{ role: "user", content: question }], ...LLAMA_GUARD_OPTIONS });
    const modelReply: unknown = await withinTime(call, timeoutMs);
    return { isUnsafe: isUnsafeVerdict(modelReply), tokens: tokensUsed(modelReply) ?? assumedTokens };
  } catch {
    // A call that failed wasn't run, so it isn't paid for.
    return { isUnsafe: false, tokens: NO_TOKENS };
  }
}
