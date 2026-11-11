/* Ask: a question typed in goes to /ask (the Worker; src/shared/ask.ts has
   what it says), checked here, not trusted. Once it says the visitor is
   blocked or out of questions, this browser tab stops asking. */
import { isReplyText, type AskRequest, type AskResponse } from "../shared/ask.ts";
import { isCount, isRecord, isString } from "../shared/guards.ts";
import { STORAGE, TIMING } from "./constants.ts";
import { session } from "./lib/storage.ts";
import { askUrl, root } from "./page.ts";

// What's kept under STORAGE.askLock: "blocked", or "limit:" and the limit.
const BLOCKED = "blocked";
const LIMIT = "limit:";

// The reply this visit is locked to, if it is.
function locked(): AskResponse | null {
  const lock = session.get(STORAGE.askLock);
  if (lock === BLOCKED) return { blocked: true };
  const limit = lock?.startsWith(LIMIT) ? Number(lock.slice(LIMIT.length)) : null;
  return isCount(limit) ? { id: null, limited: true, limit } : null;
}

function lock(reply: AskResponse): void {
  if ("blocked" in reply) session.set(STORAGE.askLock, BLOCKED);
  else if ("limited" in reply) session.set(STORAGE.askLock, `${LIMIT}${reply.limit}`);
}

/** /ask's reply, checked field by field. Anything unexpected is no pick. */
function parseReply(data: unknown): AskResponse {
  if (!isRecord(data)) return { id: null };
  if (data.blocked === true) return data.flagged === true ? { blocked: true, flagged: true } : { blocked: true };
  if (data.limited === true) return { id: null, limited: true, limit: isCount(data.limit) ? data.limit : 0 };
  const id = isString(data.id) ? data.id : null;
  // A reply only ever comes with an answer.
  const reply = id !== null && isReplyText(data.reply) ? { reply: data.reply } : {};
  // With few questions left today it also says how many.
  return { id, ...reply, ...(isCount(data.left) ? { left: data.left } : {}) };
}

/** What /ask says about a question; null when it can't be asked. */
export async function ask(question: string): Promise<AskResponse | null> {
  const lockedTo = locked();
  if (lockedTo) return lockedTo;
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
    const reply = parseReply(data);
    lock(reply);
    return reply;
  } catch {
    return null;
  }
}
