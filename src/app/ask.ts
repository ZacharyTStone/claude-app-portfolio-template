/* Ask: a question typed in goes to /ask (the Worker; src/contracts/ask.ts has
   what it says), checked here, not trusted. Once it says the visitor is
   blocked or out of questions, this browser tab stops asking. */
import { isCitedLines, isQuestionToOwner, isReplyText, type AskRequest, type AskResponse } from "../contracts/ask.ts";
import { isCount, isRecord, isString } from "../contracts/guards.ts";
import { STORAGE, TIMING } from "./constants.ts";
import { session } from "./lib/storage.ts";
import { askUrl, root } from "./page.ts";

// What's kept under STORAGE.askLock once /ask has said the visitor may ask
// no more: "blocked", or "limit:" and the day's limit ("limit:30").
const LOCK_BLOCKED = "blocked";
const LOCK_LIMIT_PREFIX = "limit:";

// What /ask said when it locked this visit, if it has: every later question
// gets the same, with nothing sent.
function lockedResponse(): AskResponse | null {
  const lock = session.get(STORAGE.askLock);
  if (lock === LOCK_BLOCKED) return { blocked: true };
  const limit = lock?.startsWith(LOCK_LIMIT_PREFIX) ? Number(lock.slice(LOCK_LIMIT_PREFIX.length)) : null;
  return isCount(limit) ? { id: null, limited: true, limit } : null;
}

// Locks the visit, if /ask said the visitor is blocked or has asked all
// they may today.
function lockIfTurnedAway(response: AskResponse): void {
  if ("blocked" in response) session.set(STORAGE.askLock, LOCK_BLOCKED);
  else if ("limited" in response) session.set(STORAGE.askLock, `${LOCK_LIMIT_PREFIX}${response.limit}`);
}

/** /ask's reply, checked field by field. Anything unexpected is no pick.
    Checked by hand, where the Worker checks what it's sent with a valibot
    schema: the schema here would add 5.6 KB to the page's script. */
function parseResponse(data: unknown): AskResponse {
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
  return {
    id,
    ...(reply !== undefined ? { reply } : {}),
    ...(cited !== undefined ? { cited } : {}),
    ...(toOwner !== undefined ? { toOwner } : {}),
    ...(left !== undefined ? { left } : {}),
  };
}

/** What /ask says about a question; null when it can't be asked. */
export async function ask(question: string): Promise<AskResponse | null> {
  const locked = lockedResponse();
  if (locked) return locked;
  const request: AskRequest = { question, lang: root.lang };
  try {
    const response = await fetch(askUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      credentials: "omit",
      signal: AbortSignal.timeout(TIMING.askTimeout),
    });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    const askResponse = parseResponse(data);
    lockIfTurnedAway(askResponse);
    return askResponse;
  } catch {
    return null;
  }
}
