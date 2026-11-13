/* The line /ask logs for a question. wrangler.jsonc, at ASK_LOG_QUESTIONS,
   tells a site's owner what's in it, and they read these names in Workers
   Logs: the names stay as they are. */
import type { Outcome } from "./outcome.ts";
import type { QuoteCheck } from "./quote.ts";
import type { NotSaid } from "./to-owner.ts";
import type { Unwritten } from "./write.ts";

/** What a line always says. */
type Summary = {
  /** What came of the question: the id of the answer shown, "none",
      "blocked", "refused" (turned away before the model) or "error". */
  ask: string;
  /** What the question's model calls cost, in Neurons. */
  neurons?: number;
  /** With "refused": the limit it was turned away at, or "down". */
  why?: string;
  /** With "error": a Workers AI error's number, or the kind of error. */
  error?: string;
  /** The answer picked, which didn't name what was asked (coverage.ts). */
  uncovered?: string;
  /** Whether a reply was written from the lines picked and passed its
      check, and if not, why. */
  wrote?: "sent" | "dropped";
  unwritten?: Unwritten;
  /** Whether those lines could be quoted instead, and if not, why. */
  reply?: "sent" | "dropped";
  check?: QuoteCheck;
  /** With no answer shown: whether the question was rewritten as it's said
      to the owner, for the page's email and message, and passed its check;
      and if not, why. Neither on a page in a language it isn't rewritten
      in. */
  toOwner?: "sent" | "dropped";
  unaddressed?: NotSaid;
  /** The model ran out of room to write before it had picked. */
  cut?: true;
};

/** What it says only with ASK_LOG_QUESTIONS on: each of these may repeat
    the question. */
type Detail = {
  /** What the visitor typed. */
  question?: string;
  /** What the model made of the question before it picked. */
  thought?: string;
  /** The line numbers the model gave. */
  chose?: string;
  /** The names and numbers a reply it wrote had that those lines don't. */
  unsaid?: string;
  /** The reply sent, written or quoted. */
  said?: string;
  /** What the model wrote as the question said to the owner, sent or not. */
  rewrote?: string;
};

export type LogLine = Summary & Detail;

export type LogSink = (line: LogLine) => void;

/** One line of JSON. Fields left undefined are left out. */
export const logToConsole: LogSink = (line) => console.log(JSON.stringify(line));

const NEURON_DECIMALS = 1;

function rounded(neurons: number): number {
  const scale = 10 ** NEURON_DECIMALS;
  return Math.round(neurons * scale) / scale;
}

/** A Workers AI error's number ("3036" for "3036: account limited") or the
    kind of error. Never its message, which could repeat the question. */
function errorCode(error: unknown): string {
  const code = error instanceof Error ? /^\d+(?=:)/.exec(error.message)?.[0] : undefined;
  if (code) return code;
  return error instanceof Error && /^\w+Error$/.test(error.name) ? error.name : "unknown";
}

function answeredSummary({ answer, reply, neurons }: Extract<Outcome, { kind: "answered" }>): Summary {
  const { written, quoted } = reply;
  return {
    ask: answer.id,
    neurons: rounded(neurons),
    wrote: written?.outcome,
    unwritten: written?.why,
    reply: quoted?.outcome,
    check: quoted?.check,
  };
}

function unansweredSummary(outcome: Extract<Outcome, { kind: "unanswered" }>): Summary {
  const { uncoveredId, saidToOwner, picked, neurons } = outcome;
  return {
    ask: "none",
    neurons: rounded(neurons),
    uncovered: uncoveredId,
    toOwner: saidToOwner?.outcome,
    unaddressed: saidToOwner?.why,
    cut: picked.ranOutOfRoom,
  };
}

// Null for an outcome that leaves no line: nothing was asked of anything.
function summaryOf(outcome: Outcome): Summary | null {
  switch (outcome.kind) {
    case "rejected":
    case "off":
    case "busy":
      return null;
    // The reply to these is a 200 like any other, so the log is the only
    // place a visitor at a limit, or a guard that's down, can be seen.
    case "refused":
      return { ask: "refused", why: outcome.why };
    case "flagged":
      return { ask: "blocked", neurons: rounded(outcome.neurons) };
    case "answered":
      return answeredSummary(outcome);
    case "unanswered":
      return unansweredSummary(outcome);
    case "failed":
      return { ask: "error", error: errorCode(outcome.error) };
  }
}

function answeredDetail({ question, picked, reply }: Extract<Outcome, { kind: "answered" }>): Detail {
  const unsourced = reply.written?.unsourced ?? [];
  return {
    question,
    thought: picked.thought,
    chose: reply.quoted ? JSON.stringify(picked.sentences) : undefined,
    unsaid: unsourced.length ? unsourced.join(" ") : undefined,
    said: reply.text,
  };
}

function detailOf(outcome: Outcome): Detail {
  switch (outcome.kind) {
    case "rejected":
    case "off":
    case "busy":
      return {};
    case "refused":
    case "failed":
      return { question: outcome.question };
    case "flagged":
      return { question: outcome.question, thought: outcome.picked.thought };
    case "answered":
      return answeredDetail(outcome);
    case "unanswered":
      return { question: outcome.question, thought: outcome.picked.thought, rewrote: outcome.saidToOwner?.rewrite };
  }
}

/** The line the outcome leaves in the log, if it leaves one. What may
    repeat the question is in it only when `logsQuestions`. */
export function lineFor(outcome: Outcome, logsQuestions: boolean): LogLine | null {
  const summary = summaryOf(outcome);
  if (summary === null) return null;
  return logsQuestions ? { ...summary, ...detailOf(outcome) } : summary;
}
