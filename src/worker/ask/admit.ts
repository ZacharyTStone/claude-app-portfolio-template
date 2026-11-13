/* Whether a question may go to the model. */
import type { Env } from "../env.ts";
import type { Guard } from "../guard/client.ts";
import { hashAddress, visitorAddress } from "../lib/visitor.ts";
import type { Settings } from "../settings.ts";
import { readChoices, type Choices } from "./answers.ts";
import type { Outcome } from "./outcome.ts";
import { readAskRequest, rejectionUnlessJsonPost, type CheckedAskRequest } from "./request.ts";

/** A question that may go to the model, and what answering it needs. */
export type Admitted = {
  kind: "admitted";
  /** The question, and the language of the page it was typed on. */
  askRequest: CheckedAskRequest;
  /** The visitor, as the hash of their address. */
  visitorHash: string;
  /** How many more questions they may ask today, this one taken off. */
  questionsLeft: number;
  /** The site's answers, still being read when this is made. */
  choicesBeingRead: Promise<Choices>;
};

type TurnedAway = Extract<Outcome, { kind: "rejected" | "off" | "busy" | "refused" }>;

// A limiter that's missing or fails ("down") lets no one through.
async function checkRateLimit(limiter: RateLimit | undefined, visitorHash: string): Promise<"ok" | "busy" | "down"> {
  try {
    if (!limiter) return "down";
    return (await limiter.limit({ key: visitorHash })).success ? "ok" : "busy";
  } catch {
    return "down";
  }
}

/** The question in the request, if it may go to the model; otherwise why
    not. Each check comes before anything dearer than it: nothing is read
    for a request that isn't a JSON POST, and nothing is counted for a
    visitor who's asking too fast. */
export async function admit(
  request: Request,
  env: Env,
  settings: Settings,
  guard: Guard,
): Promise<Admitted | TurnedAway> {
  const { visitorLimit } = settings;
  const notJsonPost = rejectionUnlessJsonPost(request);
  if (notJsonPost) return { kind: "rejected", rejection: notJsonPost };
  if (!settings.enabled) return { kind: "off" };
  const visitorHash = await hashAddress(visitorAddress(request), settings.salt);
  const rateLimit = await checkRateLimit(env.ASK_LIMIT, visitorHash);
  if (rateLimit === "busy") return { kind: "busy" };
  if (rateLimit === "down") return { kind: "refused", why: "down", visitorLimit };
  const askRequest = await readAskRequest(request);
  if ("error" in askRequest) return { kind: "rejected", rejection: askRequest };
  // The answers are read while AskGuard (in North America) is asked, not
  // after: one less wait.
  const choicesBeingRead = readChoices(env.ASSETS, request, askRequest.lang);
  choicesBeingRead.catch(() => {}); // a reply before it's awaited leaves it unhandled otherwise
  const gate = await guard.takeQuestion(visitorHash);
  if (gate.state !== "ok") return { kind: "refused", why: gate.state, visitorLimit, question: askRequest.question };
  return { kind: "admitted", askRequest, visitorHash, questionsLeft: gate.questionsLeft, choicesBeingRead };
}
