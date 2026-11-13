/* What /ask replies, read from JSON that isn't trusted. Checked by hand:
   the schema the Worker's tests use (src/contracts/ask.ts) would add 5.6 KB
   to the page's script. A test holds this reader to that schema. */
import { isCitedLines, isQuestionToOwner, isReplyText, type AskResponse } from "../../contracts/ask.ts";
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
  if (data.blocked === true) return data.flagged === true ? { blocked: true, flagged: true } : { blocked: true };
  if (data.limited === true) return { id: null, limited: true, limit: isCount(data.limit) ? data.limit : 0 };
  const id = isString(data.id) ? data.id : null;
  // A reply only ever comes with an answer, and the lines a reply was
  // written from only ever with the reply.
  const reply = id !== null && isReplyText(data.reply) ? data.reply : undefined;
  const cited = reply !== undefined && isCitedLines(data.cited) ? data.cited : undefined;
  // The question as it's said to the owner only ever comes with no answer.
  const toOwner = id === null && isQuestionToOwner(data.toOwner) ? data.toOwner : undefined;
  // With few questions left today it also says how many.
  const left = isCount(data.left) ? data.left : undefined;
  const withLeft = left !== undefined ? { left } : {};
  if (id === null) return { id, ...(toOwner !== undefined ? { toOwner } : {}), ...withLeft };
  if (reply === undefined) return { id, ...withLeft };
  return { id, reply, ...(cited !== undefined ? { cited } : {}), ...withLeft };
}
