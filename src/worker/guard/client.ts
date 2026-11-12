/* What /ask asks of the site's AskGuard. When the guard is missing or
   can't be reached, the visitor gets no pick: the safe side. */
import {
  ASK_GUARD_NAME,
  ASK_GUARD_ORIGIN,
  ASK_GUARD_PATH,
  ASK_GUARD_REPLY,
  type BlockQuery,
  type SpendQuery,
  type TakeQuery,
} from "../constants.ts";
import type { Settings } from "../env.ts";

/** Whether the visitor's question can go to the model.
    - ok: yes, and `questionsLeft` is how many more they can ask today.
    - limited: they've asked `visitorLimit` today, the most there is.
    - spent: the site's questions for today are used up, or the Neurons
      they may cost.
    - blocked: they asked something inappropriate earlier.
    - down: the guard isn't bound, can't be reached, or said something else. */
export type Gate =
  | { state: "ok"; questionsLeft: number }
  | { state: "limited"; visitorLimit: number }
  | { state: "spent" | "blocked" | "down" };

const GUARD_IS_DOWN: Gate = { state: "down" };

// Sends the site's one AskGuard a request. It's created where
// ASK_GUARD_LOCATION says (eastern North America by default), not near
// whoever happened to ask first.
function callAskGuard(
  namespace: DurableObjectNamespace,
  { guardLocation }: Settings,
  path: string,
  query: TakeQuery | BlockQuery | SpendQuery,
): Promise<Response> {
  const guard = namespace.get(namespace.idFromName(ASK_GUARD_NAME), { locationHint: guardLocation });
  return guard.fetch(`${ASK_GUARD_ORIGIN}${path}?${new URLSearchParams(query)}`, { method: "POST" });
}

// What AskGuard's reply to /take means: "ok 25" (the visitor has 25
// questions left today), "limited", "spent" or "blocked". Anything else is
// read as the guard being down.
function readGate(guardReply: string, visitorLimit: number): Gate {
  const [state, questionsLeft] = guardReply.split(" ");
  if (state === ASK_GUARD_REPLY.ok) return { state, questionsLeft: Number(questionsLeft) };
  if (state === ASK_GUARD_REPLY.limited) return { state, visitorLimit };
  if (state === ASK_GUARD_REPLY.spent || state === ASK_GUARD_REPLY.blocked) return { state };
  return GUARD_IS_DOWN;
}

/** Takes one question from the visitor's and the site's allowances for the
    day, and says whether it can go to the model. */
export async function takeQuestion(
  namespace: DurableObjectNamespace | undefined,
  visitorHash: string,
  settings: Settings,
): Promise<Gate> {
  if (!namespace) return GUARD_IS_DOWN;
  const { dailyLimit, visitorLimit, neuronBudget } = settings;
  try {
    const query: TakeQuery = {
      limit: String(dailyLimit),
      each: String(visitorLimit),
      budget: String(neuronBudget),
      who: visitorHash,
    };
    const response = await callAskGuard(namespace, settings, ASK_GUARD_PATH.take, query);
    return response.ok ? readGate(await response.text(), visitorLimit) : GUARD_IS_DOWN;
  } catch {
    return GUARD_IS_DOWN;
  }
}

/** Blocks the visitor from /ask for ASK_BLOCK_HOURS. */
export async function blockVisitor(
  namespace: DurableObjectNamespace | undefined,
  visitorHash: string,
  settings: Settings,
): Promise<void> {
  if (!namespace) return;
  try {
    const query: BlockQuery = { hours: String(settings.blockHours), who: visitorHash };
    await callAskGuard(namespace, settings, ASK_GUARD_PATH.block, query);
  } catch {
    // This question is turned away all the same; only the block is missed.
  }
}

/** Adds what a question's model calls cost, in Neurons, to the day's. */
export async function spendNeurons(
  namespace: DurableObjectNamespace | undefined,
  neurons: number,
  settings: Settings,
): Promise<void> {
  // Nothing to add for a cost of 0, or one that isn't a number.
  if (!namespace || !(neurons > 0)) return;
  try {
    const query: SpendQuery = { neurons: String(neurons) };
    await callAskGuard(namespace, settings, ASK_GUARD_PATH.spend, query);
  } catch {
    // The question is answered all the same; only its cost goes uncounted.
  }
}
