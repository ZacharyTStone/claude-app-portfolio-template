/* What came of a request to /ask, and what the visitor is told of it. The
   line the log gets is in log.ts. */
import type { AskAnswer, AskResponse } from "../../contracts/ask.ts";
import { HTTP_STATUS, json } from "../lib/http.ts";
import type { Picked } from "./pick.ts";
import type { Reply } from "./reply.ts";
import type { Rejection } from "./request.ts";
import type { SaidToOwner } from "./to-owner.ts";

/** A question the model was asked. */
type Asked = {
  question: string;
  picked: Picked;
  /** What its model calls cost, in Neurons. */
  neurons: number;
};

/** How near the visitor is to the most they may ask today. */
type Allowance = { questionsLeft: number; visitorLimit: number };

export type Outcome =
  /** The request isn't one /ask reads. */
  | { kind: "rejected"; rejection: Rejection }
  /** Ask is turned off. */
  | { kind: "off" }
  /** The visitor is asking too fast. */
  | { kind: "busy" }
  /** Turned away before the model: at one of the day's limits, by an
      earlier block, or with the limiter or AskGuard down. `question` is
      there once the request's body has been read. */
  | { kind: "refused"; why: "down" | "blocked" | "limited" | "spent"; visitorLimit: number; question?: string }
  /** The question was inappropriate. The models read it all the same, so
      what that cost is counted. */
  | ({ kind: "flagged"; visitorHash: string } & Asked)
  /** An answer says what was asked. */
  | ({ kind: "answered"; answer: AskAnswer; reply: Reply } & Asked & Allowance)
  /** None does: nothing was picked, or what was picked doesn't name what
      was asked (`uncoveredId`). */
  | ({ kind: "unanswered"; uncoveredId?: string; saidToOwner?: SaidToOwner } & Asked & Allowance)
  /** Something failed on the way to an answer. */
  | { kind: "failed"; error: unknown; question: string };

/** What a question that was taken cost, in Neurons, for the day's count:
    nothing when it failed. Undefined for one that was never taken. */
export function neuronsSpentOn(outcome: Outcome): number | undefined {
  if (outcome.kind === "failed") return 0;
  return "neurons" in outcome ? outcome.neurons : undefined;
}

/** A visitor with this many questions or fewer left today is told so. */
export const WARN_AT_QUESTIONS_LEFT = 10;

// Or with a third of their limit left, where the limit is too small for
// WARN_AT_QUESTIONS_LEFT to be near its end.
function leftToSay({ questionsLeft, visitorLimit }: Allowance): number | undefined {
  const warnAt = Math.min(WARN_AT_QUESTIONS_LEFT, Math.floor(visitorLimit / 3));
  return questionsLeft <= warnAt ? questionsLeft : undefined;
}

function refusal(why: Extract<Outcome, { kind: "refused" }>["why"], visitorLimit: number): AskResponse {
  switch (why) {
    case "blocked":
      return { blocked: true };
    case "limited":
      return { id: null, limited: true, limit: visitorLimit };
    case "spent":
    case "down":
      return { id: null, why: "budget" };
  }
}

function answered(outcome: Extract<Outcome, { kind: "answered" }>): AskResponse {
  const { answer, reply } = outcome;
  const left = leftToSay(outcome);
  if (reply.text === undefined) return { id: answer.id, left };
  return { id: answer.id, reply: reply.text, cited: reply.cited, left };
}

function askResponseTo(outcome: Exclude<Outcome, { kind: "rejected" }>): AskResponse {
  switch (outcome.kind) {
    case "off":
      return { id: null, why: "off" };
    case "busy":
      return { id: null, why: "busy" };
    case "refused":
      return refusal(outcome.why, outcome.visitorLimit);
    case "flagged":
      return { blocked: true, flagged: true };
    case "answered":
      return answered(outcome);
    case "unanswered":
      return { id: null, toOwner: outcome.saidToOwner?.toOwner, left: leftToSay(outcome) };
    case "failed":
      return { id: null, why: "error" };
  }
}

/** What the visitor is told: an AskResponse, or a 4xx for a request that
    isn't one /ask reads. */
export function responseTo(outcome: Outcome): Response {
  if (outcome.kind === "rejected") {
    const { error, status, headers } = outcome.rejection;
    return json({ error }, status, headers);
  }
  const status = outcome.kind === "busy" ? HTTP_STATUS.tooManyRequests : HTTP_STATUS.ok;
  return json(askResponseTo(outcome), status);
}
