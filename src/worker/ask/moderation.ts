/* Llama Guard's verdict on a question, beside the picker's own judgement
   (it can call a question "inappropriate"): either turns it away. Llama
   Guard has no category for an attempt to redirect the model; the picker does. */
import { GUARD_MODEL, GUARD_OPTIONS, GUARD_TIMEOUT } from "../constants.ts";
import { get } from "../lib/shape.ts";

// Its verdict comes as text ("safe", "unsafe\nS10") or as { safe, categories }.
function isUnsafeVerdict(result: unknown): boolean {
  const verdict = get(result, "response");
  if (typeof verdict === "string") return verdict.trim().toLowerCase().startsWith("unsafe");
  return get(verdict, "safe") === false;
}

/** True if Llama Guard calls the question unsafe within `timeout` ms. If it
    can't say by then, the picker's judgement stands. */
export async function isUnsafe(ai: Ai, question: string, timeout: number = GUARD_TIMEOUT): Promise<boolean> {
  let timer: number | null = null;
  try {
    const run = ai.run(GUARD_MODEL, { messages: [{ role: "user", content: question }], ...GUARD_OPTIONS });
    run.catch(() => {}); // still running when the time is up: its failure is no one's
    const late = new Promise<undefined>((done) => (timer = setTimeout(done, timeout)));
    return isUnsafeVerdict(await Promise.race([run, late]));
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
