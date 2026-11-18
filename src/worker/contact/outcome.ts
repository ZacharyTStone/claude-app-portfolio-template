/* What came of a request to /contact, and what the visitor is told of it:
   JSON for the page's script, which asks for it, and otherwise a redirect
   back to the page, at the note that says how it went. The line the log
   gets is in log.ts. */
import { CONTACT_JSON, CONTACT_NOTE_IDS, type ContactNote, type ContactReply } from "../../contracts/contact.ts";
import { HTTP_STATUS, json, seeOther, type Rejection } from "../lib/http.ts";

/** What came of sending a message that was right: turned away before
    the sender was asked (the visitor's or the site's day is used up, or
    AskGuard, the binding or the API's key, or CONTACT_TO is missing, or
    AskGuard is down), sent, or failed (the sender said no, or failed). */
export type Sending =
  { kind: "refused"; why: "down" | "limited" | "spent" } | { kind: "sent" } | { kind: "failed"; error: unknown };

export type ContactOutcome =
  /** The request isn't a form posted from one of the site's pages. */
  | { kind: "rejected"; rejection: Rejection }
  /** The field only a bot fills in was filled in. Nothing is sent, and the
      bot is told it was. `page` is where the form was, for each kind from
      here on. */
  | { kind: "trapped"; page: string }
  /** The address doesn't look like one, or the message is empty or isn't
      text (check.ts). */
  | { kind: "invalid"; why: "email" | "message"; page: string }
  | (Sending & { page: string });

type Answered = Exclude<ContactOutcome, { kind: "rejected" }>;

/** Each outcome but a rejection says it went, or that it didn't, and with
    the status a reply to the page's script has. */
function noteFor(outcome: Answered): { note: ContactNote; status: number } {
  switch (outcome.kind) {
    case "trapped":
    case "sent":
      return { note: "sent", status: HTTP_STATUS.ok };
    case "invalid":
      return { note: "failed", status: HTTP_STATUS.badRequest };
    case "refused":
      return {
        note: "failed",
        status: outcome.why === "down" ? HTTP_STATUS.serviceUnavailable : HTTP_STATUS.tooManyRequests,
      };
    case "failed":
      return { note: "failed", status: HTTP_STATUS.serviceUnavailable };
  }
}

/** The page's script asks for JSON; a form posted without it asks for a
    page. */
const wantsJson = (request: Request): boolean => (request.headers.get("Accept") ?? "").includes(CONTACT_JSON);

/** What the visitor is told: a 4xx for a request that isn't the form, a
    ContactReply to the page's script, or else a redirect to the note on
    the page the form was on. */
export function responseTo(outcome: ContactOutcome, request: Request): Response {
  if (outcome.kind === "rejected") {
    const { error, status, headers } = outcome.rejection;
    return json({ error }, status, headers);
  }
  const { note, status } = noteFor(outcome);
  if (wantsJson(request)) return json({ sent: note === "sent" } satisfies ContactReply, status);
  return seeOther(new URL(`${outcome.page}#${CONTACT_NOTE_IDS[note]}`, new URL(request.url).origin).href);
}
