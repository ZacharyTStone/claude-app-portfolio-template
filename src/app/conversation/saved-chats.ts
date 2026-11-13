/* The chats a visitor's browser keeps, as they're saved: the one
   description of the stored format, with its reader and its writer.

   The format only ever grows by optional fields. An older page open in
   another window rewrites the list from what it can read: an entry it
   can't read would be lost, and a field it doesn't know it writes back.
   tests/app/saved-chats.test.ts holds every entry a page has written. */
import { isQuestionToOwner, isCitedLines, isReplyText } from "../../contracts/ask.ts";
import { isArrayOf, isCount, isOptionalString, isRecord, isString } from "../../contracts/guards.ts";
import { byOutcome, type ByOutcome, type Exchange, type Outcome } from "./exchange.ts";

/** A thread chosen in the question card, by its tab's id. */
type SavedThread = { tab: string };

/** A question typed in, with what /ask said about it. */
type SavedQuestion = {
  question: string;
  /** The answer /ask picked ("work.2"), or null for none. Left out until
      it's asked, and when Ask is off. */
  answer?: string | null;
  /** The reply /ask sent with that answer, if it sent one. */
  reply?: string;
  /** The site's own lines that reply was written from. */
  cited?: string[];
  /** The question as /ask said it to the owner, when it picked no answer. */
  toOwner?: string;
  /** The visitor was blocked. */
  blocked?: true;
  /** They were past the day's limit, of this many questions. */
  limited?: number;
};

export type SavedSource = SavedThread | SavedQuestion;

export type SavedChat = {
  /** The time it was made, in base 36. */
  id: string;
  /** The name it's been given, if it's been renamed. */
  title: string | null;
  sources: SavedSource[];
  created: number;
};

const CHAT_ID = /^[a-z0-9]+$/;

const isAbsentOr = <Value>(value: unknown, isValue: (value: unknown) => value is Value): boolean =>
  value === undefined || isValue(value);

/** Whether something saved can be read at all. What's shown of a reply, its
    lines and the question to the owner is decided by readExchange. */
function isSavedSource(value: unknown): value is SavedSource {
  if (!isRecord(value)) return false;
  if (!("question" in value)) return isString(value.tab);
  return (
    isString(value.question) &&
    (value.answer === null || isAbsentOr(value.answer, isString)) &&
    isAbsentOr(value.cited, (cited): cited is string[] => isArrayOf(cited, isString)) &&
    isOptionalString(value.toOwner) &&
    isAbsentOr(value.blocked, (blocked): blocked is true => blocked === true) &&
    isAbsentOr(value.limited, isCount)
  );
}

const isTime = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(new Date(value).getTime());

/** One chat of what storage holds, or null for one that can't be read or
    has nothing in it that can. One saved without its time is given `now`. */
function readSavedChat(chat: unknown, now: number): SavedChat | null {
  if (!isRecord(chat) || !isString(chat.id) || !CHAT_ID.test(chat.id)) return null;
  const sources = Array.isArray(chat.sources) ? chat.sources.filter(isSavedSource) : [];
  if (!sources.length) return null;
  const title = isString(chat.title) ? chat.title : null;
  return { id: chat.id, title, sources, created: isTime(chat.created) ? chat.created : now };
}

/** The chats in what storage holds (the JSON under the chats' key, parsed).
    Of two with one id, the first is read. */
export function readSavedChats(saved: unknown, now: number): SavedChat[] {
  if (!Array.isArray(saved)) return [];
  const chats = new Map<string, SavedChat>();
  for (const entry of saved) {
    const chat = readSavedChat(entry, now);
    if (chat && !chats.has(chat.id)) chats.set(chat.id, chat);
  }
  return [...chats.values()];
}

/** The saved chats without one of them. */
export const withoutChat = (saved: SavedChat[], chatId: string): SavedChat[] =>
  saved.filter((chat) => chat.id !== chatId);

/** The saved chats with one of them as it is now, in place of how it was
    saved. A chat with nothing sent in it isn't saved. */
export function withChat(saved: SavedChat[], chat: SavedChat): SavedChat[] {
  const others = withoutChat(saved, chat.id);
  return chat.sources.length ? [...others, chat] : others;
}

const SAVED_OUTCOME: ByOutcome<Omit<SavedQuestion, "question">> = {
  unasked: () => ({}),
  answered: ({ outcome }) => ({ answer: outcome.answerId }),
  replied: ({ outcome: { answerId, reply, citedLines } }) => ({
    answer: answerId,
    reply,
    ...(citedLines.length ? { cited: citedLines } : {}),
  }),
  unanswered: ({ outcome }) => ({ answer: null, ...(outcome.toOwner ? { toOwner: outcome.toOwner } : {}) }),
  blocked: () => ({ blocked: true }),
  limited: ({ outcome }) => ({ limited: outcome.limit }),
};

/** An exchange as it's saved. */
export function toSaved(exchange: Exchange): SavedSource {
  if (exchange.kind === "thread") return { tab: exchange.tabId };
  return { question: exchange.question, ...byOutcome(exchange, SAVED_OUTCOME) };
}

/** What a saved question came to. A page writes one outcome with a question;
    should what's saved have more (it may have been edited), a limit is read
    before an answer, and an answer before the rest. A reply, its lines and
    the question to the owner are checked as /ask's are: any may have been
    edited too. */
function readOutcome(saved: SavedQuestion): Outcome {
  if (saved.limited) return { kind: "limited", limit: saved.limited };
  if (saved.answer) return readAnswer(saved.answer, saved);
  if (saved.blocked) return { kind: "blocked", isRemoved: false };
  return isQuestionToOwner(saved.toOwner) ? { kind: "unanswered", toOwner: saved.toOwner } : { kind: "unanswered" };
}

function readAnswer(answerId: string, { reply, cited }: SavedQuestion): Outcome {
  if (!isReplyText(reply)) return { kind: "answered", answerId };
  return { kind: "replied", answerId, reply, citedLines: isCitedLines(cited) ? cited : [] };
}

/** What was saved, as the exchange it was. */
export function readExchange(saved: SavedSource): Exchange {
  if (!("question" in saved)) return { kind: "thread", tabId: saved.tab };
  return { kind: "typed", question: saved.question, outcome: readOutcome(saved) };
}
