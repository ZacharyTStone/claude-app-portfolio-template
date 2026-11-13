/* The chats a visitor's browser keeps, as they're saved: the one
   description of the stored format, and its reader. What's saved is
   checked, not trusted: it may be from an older version, or edited.

   The format only ever grows by optional fields. An older page open in
   another window rewrites the list from what it can read, so an entry it
   can't read would be lost; a field it doesn't know it writes back. */
import { isArrayOf, isCount, isOptionalString, isRecord, isString } from "../../contracts/guards.ts";

/** A question typed in. What /ask said about it is kept with it, so it's
    asked only once (a chat shown again doesn't ask again). */
export type TypedQuestion = {
  question: string;
  /** The answer /ask picked ("work.2"), or null for none. Left out
      until it's asked, and when Ask is off. */
  answer?: string | null;
  /** The reply /ask sent with that answer, if it sent one. */
  reply?: string;
  /** The site's own lines that reply was written from, which /ask sends
      with a reply it wrote itself: they're shown under it. */
  cited?: string[];
  /** The question as it's said to you ("Do you…?" for "Does Alex…?"),
      which /ask sends when it picked no answer and could say it so: it
      goes in the email and the message, where the question would. */
  toOwner?: string;
  /** The visitor is blocked: nothing they type is shown back. */
  blocked?: true;
  /** They're past the day's limit, of this many questions. */
  limited?: number;
};

/** What's sent: a thread chosen in the question card, or a question typed
    in. A chat is saved as a list of these. */
export type Source = { tab: string } | TypedQuestion;

/** A chat as it's saved. */
export type SavedChat = {
  /** The time it was made, in base 36. */
  id: string;
  /** The name it's been given, if it's been renamed. */
  title: string | null;
  sources: Source[];
  created: number;
};

const CHAT_ID = /^[a-z0-9]+$/;

function isSource(value: unknown): value is Source {
  if (!isRecord(value)) return false;
  if (!("question" in value)) return isString(value.tab);
  const { question, answer, cited, toOwner, blocked, limited } = value;
  return (
    isString(question) &&
    (answer === undefined || answer === null || isString(answer)) &&
    // The lines a reply cites are shown as text, and checked again when
    // they're shown (replies.ts): here, only that they're lines at all.
    (cited === undefined || isArrayOf(cited, isString)) &&
    // The same for the question as it's said to the owner: only that it's
    // text.
    isOptionalString(toOwner) &&
    (blocked === undefined || blocked === true) &&
    (limited === undefined || isCount(limited))
  );
}

const isTime = (value: unknown): value is number =>
  typeof value === "number" && !Number.isNaN(new Date(value).getTime());

/** The chats in what storage holds (the JSON under the chats' key, parsed).
    A chat that can't be read, or has nothing in it that can, is left out,
    as is a second one with an id already seen. One saved without its time
    is given `now`. */
export function readSavedChats(saved: unknown, now: number): SavedChat[] {
  if (!Array.isArray(saved)) return [];
  const seen = new Set<string>();
  return saved.flatMap((chat: unknown) => {
    if (!isRecord(chat) || !isString(chat.id) || !CHAT_ID.test(chat.id) || seen.has(chat.id)) return [];
    const sources = Array.isArray(chat.sources) ? chat.sources.filter(isSource) : [];
    if (!sources.length) return [];
    seen.add(chat.id);
    const title = isString(chat.title) ? chat.title : null;
    return [{ id: chat.id, title, sources, created: isTime(chat.created) ? chat.created : now }];
  });
}
