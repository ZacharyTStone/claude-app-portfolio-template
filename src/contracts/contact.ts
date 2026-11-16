/* The contact form's wire format. The page's form POSTs its fields to
   /contact as any form does, and the Worker emails them to the site's
   owner. With JavaScript the page sends the same fields and asks for JSON
   back (a ContactReply); without it, the Worker sends the visitor back to
   the page, at the note that says how it went (CONTACT_NOTE_IDS). */

import { isRecord } from "./guards.ts";
import { PAGE_IDS } from "./page-ids.ts";

/** wrangler.jsonc runs the Worker first at this path, under the site's own. */
export const CONTACT_PATH = "/contact";

/** The form's fields, by what each holds: the names the page gives its
    inputs and the Worker reads. `page` is the page the form is on, to send
    the visitor back to; `trap` is the field only a bot fills in. */
export const CONTACT_FIELDS = { email: "email", message: "message", page: "page", trap: "website" } as const;

/** The longest an email address can be (RFC 5321's 256, less the brackets
    around it). */
export const MAX_EMAIL_LENGTH = 254;

/** The longest a message can be, in characters: a few paragraphs. */
export const MAX_MESSAGE_LENGTH = 2000;

/** The most a request's body may be, in bytes: room for the longest
    message in any script, percent-encoded as a form sends it (9 bytes for
    a character of Japanese), and the rest of the fields. */
export const MAX_CONTACT_BYTES = 24 * 1024;

/** What the page asks for, in Accept, to be answered with a ContactReply
    instead of being sent back to the page. */
export const CONTACT_JSON = "application/json";

/** What the Worker says to a form sent with JavaScript. */
export type ContactReply = { sent: boolean };

/** Whether a reply, whatever it is, says the message went. */
export const isSent = (reply: unknown): boolean => isRecord(reply) && reply.sent === true;

/** The two notes under the form: it went, or it didn't. */
export type ContactNote = "sent" | "failed";

/** The id of each note, which the Worker sends a visitor without
    JavaScript back to: the address names it, and :target shows it. */
export const CONTACT_NOTE_IDS: Record<ContactNote, string> = {
  sent: PAGE_IDS.contactSent,
  failed: PAGE_IDS.contactFailed,
};
