/* Llama Guard's verdict on a question, beside the picker's own judgement
   (it can call a question "inappropriate"): either turns it away. Llama
   Guard has no category for an attempt to redirect the model; the picker does. */
import { GUARD_MODEL, GUARD_OPTIONS, GUARD_PROMPT_TOKENS, GUARD_TIMEOUT } from "../constants.ts";
import { get } from "../lib/shape.ts";
import { NO_TOKENS, tokensIn, tokensUsed, type Tokens } from "./cost.ts";

// Its verdict comes as text ("safe", "unsafe\nS10") or as { safe, categories }.
function isUnsafeVerdict(result: unknown): boolean {
  const verdict = get(result, "response");
  if (typeof verdict === "string") return verdict.trim().toLowerCase().startsWith("unsafe");
  return get(verdict, "safe") === false;
}

/** Llama Guard's verdict on a question, and the tokens its call used. */
export type Verdict = { unsafe: boolean; tokens: Tokens };

/** `unsafe` if Llama Guard calls the question that within `timeout` ms. If
    it can't say by then, the picker's judgement stands. */
export async function verdictOn(ai: Ai, question: string, timeout: number = GUARD_TIMEOUT): Promise<Verdict> {
  // What a call is counted as when it doesn't say what it used, or is still
  // running when the time is up: it is paid for all the same.
  const assumed: Tokens = { input: GUARD_PROMPT_TOKENS + tokensIn(question), output: GUARD_OPTIONS.max_tokens };
  let timer: number | null = null;
  try {
    const run = ai.run(GUARD_MODEL, { messages: [{ role: "user", content: question }], ...GUARD_OPTIONS });
    run.catch(() => {}); // still running when the time is up: its failure is no one's
    const late = new Promise<undefined>((done) => (timer = setTimeout(done, timeout)));
    const result: unknown = await Promise.race([run, late]);
    return { unsafe: isUnsafeVerdict(result), tokens: tokensUsed(result) ?? assumed };
  } catch {
    return { unsafe: false, tokens: NO_TOKENS };
  } finally {
    clearTimeout(timer);
  }
}
