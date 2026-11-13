/* One thing sent into a thread, and what came of it: a thread chosen in the
   question card, or a question typed in. It needs no page. */
import type { AskResponse } from "../../contracts/ask.ts";

/** What came of a question typed in. */
export type Outcome =
  /** Not asked: Ask is off, or the visit ended before /ask replied. */
  | { kind: "unasked" }
  /** One of the site's answers, shown word for word. */
  | { kind: "answered"; answerId: string }
  /** The reply /ask made from one of the site's answers, shown with the
      site's lines it was written from (none, when /ask sent none). */
  | { kind: "replied"; answerId: string; reply: string; citedLines: string[] }
  /** No answer: how to reach the owner, with the question as /ask said it
      to them if it did. */
  | { kind: "unanswered"; toOwner?: string }
  /** The visitor may not ask, and nothing they typed is shown back.
      `isRemoved` when this was the question /ask found inappropriate. */
  | { kind: "blocked"; isRemoved: boolean }
  /** The visitor has asked all they may today: `limit` questions. */
  | { kind: "limited"; limit: number };

type OutcomeKind = Outcome["kind"];

type QuestionThatCameTo<SomeOutcome> = { kind: "typed"; question: string; outcome: SomeOutcome };

/** A question typed in, and what came of it. */
export type TypedQuestion = QuestionThatCameTo<Outcome>;

/** A typed question whose outcome is of one kind. */
export type QuestionWith<Kind extends OutcomeKind> = QuestionThatCameTo<Extract<Outcome, { kind: Kind }>>;

/** A thread chosen in the question card: in a chat, it's sent as a message. */
export type ThreadChoice = { kind: "thread"; tabId: string };

export type Exchange = ThreadChoice | TypedQuestion;

export const threadChoice = (tabId: string): ThreadChoice => ({ kind: "thread", tabId });

export const typedQuestion = (question: string): TypedQuestion => ({
  kind: "typed",
  question,
  outcome: { kind: "unasked" },
});

/** A question that comes with its answer, so nothing is asked of /ask. */
export const questionWithAnswer = (question: string, answerId: string): TypedQuestion => ({
  kind: "typed",
  question,
  outcome: { kind: "answered", answerId },
});

export const isUnasked = (exchange: Exchange): exchange is QuestionWith<"unasked"> =>
  exchange.kind === "typed" && exchange.outcome.kind === "unasked";

export const isRemoved = (exchange: Exchange): boolean =>
  exchange.kind === "typed" && exchange.outcome.kind === "blocked" && exchange.outcome.isRemoved;

/** One function for each kind of outcome. */
export type ByOutcome<Result> = { [Kind in OutcomeKind]: (asked: QuestionWith<Kind>) => Result };

/** What the function for a question's own kind of outcome makes of it. */
export function byOutcome<Result>(asked: TypedQuestion, handlers: ByOutcome<Result>): Result {
  // The compiler can't see that the handler picked by a kind takes that kind.
  const handle = handlers[asked.outcome.kind] as (asked: TypedQuestion) => Result;
  return handle(asked);
}

const unanswered = (toOwner: string | undefined): Outcome =>
  toOwner ? { kind: "unanswered", toOwner } : { kind: "unanswered" };

/** What a reply from /ask comes to; null is no reply at all (/ask couldn't
    be reached). `isOnPage` says whether an answer's id names one of the
    page's answers: one that names none is no answer. */
export function outcomeOf(response: AskResponse | null, isOnPage: (answerId: string) => boolean): Outcome {
  if (!response) return { kind: "unanswered" };
  if (response.blocked) return { kind: "blocked", isRemoved: response.flagged === true };
  if (response.limited) return { kind: "limited", limit: response.limit };
  if (!response.id || !isOnPage(response.id)) return unanswered(response.toOwner);
  if (!response.reply) return { kind: "answered", answerId: response.id };
  return { kind: "replied", answerId: response.id, reply: response.reply, citedLines: response.cited ?? [] };
}

/** The question with what came of it. One /ask found inappropriate is kept
    nowhere: `removedWording` ("Question removed") takes its place. */
export function withOutcome(asked: TypedQuestion, outcome: Outcome, removedWording: string): TypedQuestion {
  const isRemovedNow = outcome.kind === "blocked" && outcome.isRemoved;
  return { kind: "typed", question: isRemovedNow ? removedWording : asked.question, outcome };
}

/** The question as it goes in the email and the message that "Something
    else" offers: as /ask said it to the owner if it did, else as it was
    typed. Nothing a blocked visitor typed goes in either. */
export function questionForOwner({ question, outcome }: TypedQuestion): string {
  if (outcome.kind === "blocked") return "";
  return outcome.kind === "unanswered" && outcome.toOwner ? outcome.toOwner : question;
}
