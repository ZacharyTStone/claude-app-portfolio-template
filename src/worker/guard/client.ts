/* What /ask asks of the site's AskGuard. When the guard is missing or
   can't be reached, the visitor gets no pick: the safe side. */
import {
  GUARD_NAME,
  GUARD_ORIGIN,
  GUARD_PATH,
  GUARD_REPLY,
  type BlockQuery,
  type SpendQuery,
  type TakeQuery,
} from "../constants.ts";
import type { Settings } from "../env.ts";

/** Whether the visitor's question can go to the model.
    - ok: yes, and `left` is how many more they can ask today.
    - limited: they've asked `limit` today, the most there is.
    - spent: the site's questions for today are used up, or the Neurons
      they may cost.
    - blocked: they asked something inappropriate earlier.
    - down: the guard isn't bound, can't be reached, or said something else. */
export type Gate =
  { state: "ok"; left: number } | { state: "limited"; limit: number } | { state: "spent" | "blocked" | "down" };

// Sends the site's one AskGuard a request. It's created where
// ASK_GUARD_LOCATION says (eastern North America by default), not near
// whoever happened to ask first.
function tell(
  namespace: DurableObjectNamespace,
  { guardLocation }: Settings,
  path: string,
  query: TakeQuery | BlockQuery | SpendQuery,
): Promise<Response> {
  const guard = namespace.get(namespace.idFromName(GUARD_NAME), { locationHint: guardLocation });
  return guard.fetch(`${GUARD_ORIGIN}${path}?${new URLSearchParams(query)}`, { method: "POST" });
}

/** Takes one question from the visitor's and the site's allowances for the
    day. */
export async function take(
  namespace: DurableObjectNamespace | undefined,
  who: string,
  settings: Settings,
): Promise<Gate> {
  if (!namespace) return { state: "down" };
  const { dailyLimit, visitorLimit, neuronBudget } = settings;
  try {
    const query: TakeQuery = {
      limit: String(dailyLimit),
      each: String(visitorLimit),
      budget: String(neuronBudget),
      who,
    };
    const response = await tell(namespace, settings, GUARD_PATH.take, query);
    if (!response.ok) return { state: "down" };
    const [state, left] = (await response.text()).split(" ");
    if (state === GUARD_REPLY.ok) return { state, left: Number(left) };
    if (state === GUARD_REPLY.limited) return { state, limit: visitorLimit };
    if (state === GUARD_REPLY.spent || state === GUARD_REPLY.blocked) return { state };
    return { state: "down" };
  } catch {
    return { state: "down" };
  }
}

/** Blocks the visitor from /ask for ASK_BLOCK_HOURS. */
export async function block(
  namespace: DurableObjectNamespace | undefined,
  who: string,
  settings: Settings,
): Promise<void> {
  if (!namespace) return;
  try {
    await tell(namespace, settings, GUARD_PATH.block, { hours: String(settings.blockHours), who });
  } catch {
    // This question is turned away all the same; only the block is missed.
  }
}

/** Adds what a question's model calls cost, in Neurons, to the day's. */
export async function spend(
  namespace: DurableObjectNamespace | undefined,
  neurons: number,
  settings: Settings,
): Promise<void> {
  if (!namespace || !(neurons > 0)) return;
  try {
    await tell(namespace, settings, GUARD_PATH.spend, { neurons: String(neurons) });
  } catch {
    // The question is answered all the same; only its cost goes uncounted.
  }
}
