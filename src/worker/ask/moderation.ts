/* Llama Guard's verdict on a question, beside the picker's own judgement
   (it can call a question "inappropriate"): either turns it away. Llama
   Guard has no category for an attempt to redirect the model; the picker does. */
import { NO_TOKENS, estimateTokens, type Tokens } from "./cost.ts";
import { LLAMA_GUARD_MODEL } from "./known-models.ts";
import { callModel, isUnsafeVerdict } from "./model.ts";

/** Its verdict ("safe", or "unsafe" and the categories) is a few tokens,
    and the first word is all that's read, so it's cut short and not left
    to chance. */
export const LLAMA_GUARD_OPTIONS = { max_tokens: 10, temperature: 0 } as const;

/** How long the pick waits for its verdict. */
const LLAMA_GUARD_TIMEOUT_MS = 2500;

/** About what Llama Guard reads besides the question: its own instructions
    and categories, in tokens. */
export const LLAMA_GUARD_PROMPT_TOKENS = 250;

export type Verdict = { isUnsafe: boolean; tokens: Tokens };

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
    const { modelReply, tokens } = await callModel(ai, LLAMA_GUARD_MODEL, {
      input: { messages: [{ role: "user", content: question }], ...LLAMA_GUARD_OPTIONS },
      timeoutMs,
      tokensIfUnreported: assumedTokens,
    });
    return { isUnsafe: isUnsafeVerdict(modelReply), tokens };
  } catch {
    // A call that failed wasn't run, so it isn't paid for.
    return { isUnsafe: false, tokens: NO_TOKENS };
  }
}
