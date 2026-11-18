/* The line /contact logs for a message. It says what came of it, and never
   who sent it or what it says: not the visitor's address, not their email,
   not a word of the message. docs/contact-form.md tells a site's owner
   what's in it, and they read these names in Workers Logs: the names stay
   as they are. */
import type { ContactOutcome } from "./outcome.ts";
import { Refusal } from "./providers.ts";

export type ContactLogLine = {
  /** What came of the message: "sent", "trapped" (it filled in the field
      only a bot fills in), "invalid", "refused" (turned away before it was
      sent) or "error". */
  contact: "sent" | "trapped" | "invalid" | "refused" | "error";
  /** With "invalid": which field wasn't, "email" or "message". With
      "refused": the limit it was turned away at, or "down". */
  why?: string;
  /** With "error": the email binding's code for it
      ("E_SENDER_NOT_VERIFIED"), a sender's API's ("validation_error",
      "406"), or the kind of error ("TimeoutError"). */
  error?: string;
  /** With "error" from a sender's API: the HTTP status it answered with. */
  status?: number;
};

export type ContactLogSink = (line: ContactLogLine) => void;

/** The email binding's code ("E_SENDER_NOT_VERIFIED"), or the kind of
    error. Never its message, which could name an address. */
function errorCode(error: unknown): string {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  if (typeof code === "string" && /^E_[A-Z_]+$/.test(code)) return code;
  return error instanceof Error && /^\w+Error$/.test(error.name) ? error.name : "unknown";
}

/** What a send that failed leaves in the log: a sender's API's status and
    code, or the binding's code or the error's kind. */
const errorFields = (error: unknown): Pick<ContactLogLine, "error" | "status"> =>
  error instanceof Refusal ? { error: error.code, status: error.status } : { error: errorCode(error) };

/** The line the outcome leaves in the log, if it leaves one. A request
    that isn't the form leaves none, as one that isn't a question leaves
    /ask's none. */
export function lineFor(outcome: ContactOutcome): ContactLogLine | null {
  switch (outcome.kind) {
    case "rejected":
      return null;
    case "trapped":
    case "sent":
      return { contact: outcome.kind };
    case "invalid":
    case "refused":
      return { contact: outcome.kind, why: outcome.why };
    case "failed":
      return { contact: "error", ...errorFields(outcome.error) };
  }
}
