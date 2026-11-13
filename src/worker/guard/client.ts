import type { Settings } from "../settings.ts";
import { ASK_GUARD_NAME, readTaken, urlAsking, type Asked, type Asker, type DayLimits, type Gate } from "./wire.ts";

/** What /ask asks of the site's AskGuard while it answers one request. */
export type Guard = {
  /** Takes one question from the allowances of the visitor, their network
      and the site, and says whether it can go to the model. */
  takeQuestion(asker: Asker): Promise<Gate>;
  /** Blocks the visitor from /ask for ASK_BLOCK_HOURS. */
  blockVisitor(visitorHash: string): Promise<void>;
  /** Pays for a question that was taken with what its model calls cost,
      in Neurons. One that failed is paid for with nothing: until it's
      paid for, AskGuard counts it at the most a question has cost. */
  spendNeurons(neurons: number): Promise<void>;
};

const DOWN: Gate = { state: "down" };

// With no guard, the visitor gets no pick: the safe side.
const NO_GUARD: Guard = {
  takeQuestion: async () => DOWN,
  blockVisitor: async () => {},
  spendNeurons: async () => {},
};

/** However many addresses ask, the day's questions can't all be asked in
    fewer hours than this: a flood ends Ask for the rest of an hour, not of
    the day. */
const FEWEST_HOURS_TO_ASK_A_DAYS_QUESTIONS = 3;

/** A network may ask as much as this many visitors: room for neighbours
    who share one, and too little for one of them to use up the site's hour. */
const VISITORS_A_NETWORK_MAY_ASK_FOR = 2;

/** The limits AskGuard is asked with. The hour's and the network's are read
    off the day's and the visitor's, and are never less than one visitor's
    day: a visitor alone meets their own limit first. */
export function limitsFrom({ dailyLimit, visitorLimit, neuronBudget }: Settings): DayLimits {
  const sharePerHour = Math.ceil(dailyLimit / FEWEST_HOURS_TO_ASK_A_DAYS_QUESTIONS);
  return {
    siteLimit: dailyLimit,
    hourLimit: Math.max(sharePerHour, visitorLimit),
    visitorLimit,
    networkLimit: visitorLimit * VISITORS_A_NETWORK_MAY_ASK_FOR,
    neuronBudget,
  };
}

/** The site's AskGuard, asked with the limits the settings have. A guard
    that isn't bound or can't be reached lets no question through. */
export function guardFor(namespace: DurableObjectNamespace | undefined, settings: Settings): Guard {
  if (!namespace) return NO_GUARD;
  const { blockHours, guardLocation } = settings;
  const limits = limitsFrom(settings);
  // It's created where ASK_GUARD_LOCATION says, not near whoever happened
  // to ask first.
  const ask = (asked: Asked): Promise<Response> =>
    namespace
      .get(namespace.idFromName(ASK_GUARD_NAME), { locationHint: guardLocation })
      .fetch(urlAsking(asked), { method: "POST" });
  return {
    async takeQuestion(asker) {
      try {
        const response = await ask({ ask: "take", ...asker, limits });
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
      try {
        await ask({ ask: "spend", neurons: neurons > 0 ? neurons : 0 });
      } catch {
        // The question is answered all the same; only its cost goes uncounted.
      }
    },
  };
}
