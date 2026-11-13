import type { Settings } from "../settings.ts";
import { ASK_GUARD_NAME, readTaken, urlAsking, type Asked, type Gate } from "./wire.ts";

/** What /ask asks of the site's AskGuard while it answers one request. */
export type Guard = {
  /** Takes one question from the visitor's and the site's allowances for
      the day, and says whether it can go to the model. */
  takeQuestion(visitorHash: string): Promise<Gate>;
  /** Blocks the visitor from /ask for ASK_BLOCK_HOURS. */
  blockVisitor(visitorHash: string): Promise<void>;
  /** Adds what a question's model calls cost, in Neurons, to the day's. */
  spendNeurons(neurons: number): Promise<void>;
};

const DOWN: Gate = { state: "down" };

// With no guard, the visitor gets no pick: the safe side.
const NO_GUARD: Guard = {
  takeQuestion: async () => DOWN,
  blockVisitor: async () => {},
  spendNeurons: async () => {},
};

/** The site's AskGuard, asked with the limits the settings have. A guard
    that isn't bound or can't be reached lets no question through. */
export function guardFor(namespace: DurableObjectNamespace | undefined, settings: Settings): Guard {
  if (!namespace) return NO_GUARD;
  const { dailyLimit: siteLimit, visitorLimit, neuronBudget, blockHours, guardLocation } = settings;
  // It's created where ASK_GUARD_LOCATION says, not near whoever happened
  // to ask first.
  const ask = (asked: Asked): Promise<Response> =>
    namespace
      .get(namespace.idFromName(ASK_GUARD_NAME), { locationHint: guardLocation })
      .fetch(urlAsking(asked), { method: "POST" });
  return {
    async takeQuestion(visitorHash) {
      try {
        const response = await ask({ ask: "take", visitorHash, limits: { siteLimit, visitorLimit, neuronBudget } });
        return response.ok ? readTaken(await response.text()) : DOWN;
      } catch {
        return DOWN;
      }
    },
    async blockVisitor(visitorHash) {
      try {
        await ask({ ask: "block", visitorHash, hours: blockHours });
      } catch {
        // This question is turned away all the same; only the block is missed.
      }
    },
    async spendNeurons(neurons) {
      const isACost = neurons > 0;
      if (!isACost) return;
      try {
        await ask({ ask: "spend", neurons });
      } catch {
        // The question is answered all the same; only its cost goes uncounted.
      }
    },
  };
}
