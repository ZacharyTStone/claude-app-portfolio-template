/* What /ask replies, read from JSON that isn't trusted. Checked by hand:
   the schema the Worker's tests use (src/contracts/ask.ts) would add 5.6 KB
   to the page's script. A test holds this reader to that schema. */
import {
  isCitedLines,
  isQuestionToOwner,
  isReplyText,
  type AskBlocked,
  type AskLimited,
  type AskPicked,
  type AskReplied,
  type AskResponse,
  type AskUnanswered,
} from "../../contracts/ask.ts";
import { isCount, isRecord, isString } from "../../contracts/guards.ts";

// What's kept once /ask has said the visitor may ask no more: "blocked",
// or "limit:" and the day's limit ("limit:30").
const LOCK_BLOCKED = "blocked";
const LOCK_LIMIT_PREFIX = "limit:";

/** What /ask said when it locked this visit, from what was kept of it:
    every later question gets the same, with nothing sent. */
export function lockedResponse(lock: string | null): AskResponse | null {
  if (lock === LOCK_BLOCKED) return { blocked: true };
  const limit = lock?.startsWith(LOCK_LIMIT_PREFIX) ? Number(lock.slice(LOCK_LIMIT_PREFIX.length)) : null;
  return isCount(limit) ? { id: null, limited: true, limit } : null;
}

/** What to keep of a reply that ends the visit's asking: the visitor is
    blocked, or has asked all they may today. Null for any other reply. */
export function lockFor(response: AskResponse): string | null {
  if ("blocked" in response) return LOCK_BLOCKED;
  if ("limited" in response) return `${LOCK_LIMIT_PREFIX}${response.limit}`;
  return null;
}

/** /ask's reply, checked field by field. Anything unexpected is no pick. */
export function parseAskResponse(data: unknown): AskResponse {
  if (!isRecord(data)) return { id: null };
  return readTurnedAway(data) ?? readPick(data);
}

type Fields = Record<string, unknown>;

/** The visitor may ask no more: they're blocked, or past the day's questions. */
function readTurnedAway(data: Fields): AskBlocked | AskLimited | null {
  if (data.blocked === true) return data.flagged === true ? { blocked: true, flagged: true } : { blocked: true };
  if (data.limited === true) return { id: null, limited: true, limit: isCount(data.limit) ? data.limit : 0 };
  return null;
}

/** An answer or none. A reply is read only with an answer, the lines it was
    written from only with the reply, and the question as it's said to the
    owner only with no answer. */
function readPick(data: Fields): AskPicked | AskReplied | AskUnanswered {
  const questionsLeft = isCount(data.left) ? { left: data.left } : {};
  if (!isString(data.id)) {
    const toOwner = isQuestionToOwner(data.toOwner) ? { toOwner: data.toOwner } : {};
    return { id: null, ...toOwner, ...questionsLeft };
  }
  if (!isReplyText(data.reply)) return { id: data.id, ...questionsLeft };
  const cited = isCitedLines(data.cited) ? { cited: data.cited } : {};
  return { id: data.id, reply: data.reply, ...cited, ...questionsLeft };
}
