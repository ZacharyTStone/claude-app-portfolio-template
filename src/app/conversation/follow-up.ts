/* What a question is sent to /ask with from before it, so a follow-up
   ("and before that?") can be read in the light of what came first: a
   turn or two of its chat or tab, each a question and the id of the answer
   shown for it. Never a reply's text: /ask reads an answer in the site's
   own words, by its id. It needs no page. */
import {
  MAX_EARLIER_TURNS,
  MAX_QUESTION_LENGTH,
  MAX_REQUEST_BYTES,
  threadAnswerId,
  type AskRequest,
  type AskTurn,
} from "../../contracts/ask.ts";
import { byOutcome, type ByOutcome, type Exchange } from "./exchange.ts";

/** What each kind of outcome tells /ask of the question that came to it. */
const TURN_OF: ByOutcome<AskTurn | null> = {
  unasked: ({ question }) => ({ question }),
  answered: ({ question, outcome }) => ({ question, id: outcome.answerId }),
  replied: ({ question, outcome }) => ({ question, id: outcome.answerId }),
  unanswered: ({ question }) => ({ question }),
  // Nothing a blocked visitor typed is sent again, and a question found
  // inappropriate is the page's own wording by now.
  blocked: () => null,
  limited: () => null,
};

/** The turn an exchange was: a question typed in, with the answer /ask
    picked for it if it picked one; or a thread chosen, as its first
    question and first answer (`firstQuestionOf` reads the page's). Null
    for one /ask isn't told of. */
export function turnOf(exchange: Exchange, firstQuestionOf: (tabId: string) => string | null): AskTurn | null {
  if (exchange.kind === "typed") return byOutcome(exchange, TURN_OF);
  const question = firstQuestionOf(exchange.tabId);
  return question ? { question, id: threadAnswerId(exchange.tabId, 1) } : null;
}

// As /ask reads one: trimmed, and no longer than a question may be.
function asSent({ question, id }: AskTurn): AskTurn | null {
  const cut = question.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!cut) return null;
  return id === undefined ? { question: cut } : { question: cut, id };
}

/** The last MAX_EARLIER_TURNS of `turns`, oldest first, leaving out what
    /ask isn't told of. */
export const lastTurns = (turns: readonly (AskTurn | null)[]): AskTurn[] =>
  turns
    .flatMap((turn) => (turn ? [asSent(turn)] : []))
    .filter((turn): turn is AskTurn => turn !== null)
    .slice(-MAX_EARLIER_TURNS);

const bytesIn = (text: string): number => new TextEncoder().encode(text).byteLength;

/** The request for a question, with as many of the turns before it as fit
    in MAX_REQUEST_BYTES, the oldest left out first: three questions as
    long as they may be, in Japanese, don't. With none, it's the question
    and the page's language, as a page from before follow-ups sent. */
export function askRequestFor(question: string, lang: string, earlier: readonly AskTurn[]): AskRequest {
  for (let from = 0; from < earlier.length; from++) {
    const request: AskRequest = { question, lang, earlier: earlier.slice(from) };
    if (bytesIn(JSON.stringify(request)) <= MAX_REQUEST_BYTES) return request;
  }
  return { question, lang };
}
