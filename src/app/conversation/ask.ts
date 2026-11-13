/* Ask: a question typed in goes to /ask (the Worker; src/contracts/ask.ts has
   what it says), checked here, not trusted. Once it says the visitor is
   blocked or out of questions, this browser tab stops asking. */
import type { AskRequest, AskResponse } from "../../contracts/ask.ts";
import { STORAGE, TIMING } from "../constants.ts";
import { lockFor, lockedResponse, parseAskResponse } from "./ask-response.ts";
import { session } from "../lib/storage.ts";
import { askUrl, root } from "../page.ts";

/** What /ask says about a question; null when it can't be asked. */
export async function ask(question: string): Promise<AskResponse | null> {
  const locked = lockedResponse(session.get(STORAGE.askLock));
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
    const askResponse = parseAskResponse(data);
    const lock = lockFor(askResponse);
    if (lock !== null) session.set(STORAGE.askLock, lock);
    return askResponse;
  } catch {
    return null;
  }
}
