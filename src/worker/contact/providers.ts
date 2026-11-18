/* The senders with an API, Resend and Postmark, which a site whose domain
   has its mail elsewhere can send from (docs/contact-form.md). Each is
   asked to send one email, to CONTACT_TO alone, with the site's key (the
   secret CONTACT_API_KEY) in the header it reads, within a time limit. The
   key is in that request and nowhere else. A refusal is kept as the status
   the API answered with and its own code for why, never its message, which
   could name an address. */
import type { Fetch } from "../lib/http.ts";
import { get } from "../lib/shape.ts";
import type { ContactSender } from "../settings.ts";
import type { Email } from "./email.ts";

/** How long a sender's API may take to say it has the email, in
    milliseconds: well within the 15 seconds the page waits for /contact. */
const ANSWER_WITHIN_MS = 10_000;

/** Who's asking. Resend turns away a request without a User-Agent; this
    one names no site. */
const USER_AGENT = "portfolio-contact-form";

/** A code an API gives for why it said no, as it gives it ("validation_error",
    406): letters, digits and underscores, so nothing it says of the email
    gets into the log. */
const A_CODE = /^\w{1,64}$/;

export type ApiSender = Exclude<ContactSender, "cloudflare">;

type Provider = {
  /** Where its API takes an email. */
  address: string;
  /** The header the key goes in, and any other it asks for. */
  headers: (key: string) => Record<string, string>;
  /** The email, as its API takes it. */
  body: (email: Email) => Record<string, string>;
  /** Where its answer to a request it refused has its code for why. */
  codeIn: (answer: unknown) => unknown;
};

const PROVIDERS: Record<ApiSender, Provider> = {
  // resend.com/docs/api-reference/emails/send-email; errors are
  // { statusCode, message, name }.
  resend: {
    address: "https://api.resend.com/emails",
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    body: ({ from, to, replyTo, subject, text }) => ({ from, to, reply_to: replyTo, subject, text }),
    codeIn: (answer) => get(answer, "name"),
  },
  // postmarkapp.com/developer/user-guide/send-email-with-api; errors are
  // { ErrorCode, Message }.
  postmark: {
    address: "https://api.postmarkapp.com/email",
    headers: (key) => ({ "X-Postmark-Server-Token": key, Accept: "application/json" }),
    body: ({ from, to, replyTo, subject, text }) => ({
      From: from,
      To: to,
      ReplyTo: replyTo,
      Subject: subject,
      TextBody: text,
      // The stream for transactional mail, which every Postmark server has.
      MessageStream: "outbound",
    }),
    codeIn: (answer) => get(answer, "ErrorCode"),
  },
};

/** A sender's API said no: the status it answered with, and its own code
    for why ("validation_error", "406"), or "unknown" where it gave none
    this can read. */
export class Refusal extends Error {
  override readonly name = "Refusal";
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(`refused with ${status} (${code})`);
    this.status = status;
    this.code = code;
  }
}

function codeOf(said: unknown): string {
  const code = typeof said === "string" || typeof said === "number" ? String(said) : "";
  return A_CODE.test(code) ? code : "unknown";
}

/** Asks `sender`'s API to send `email`, with `key`. Throws a Refusal for an
    answer that isn't a 2xx, and as fetch() throws for none in time
    ("TimeoutError") or none at all. */
export async function sendWith(sender: ApiSender, key: string, email: Email, fetch: Fetch): Promise<void> {
  const provider = PROVIDERS[sender];
  const response = await fetch(provider.address, {
    method: "POST",
    headers: { ...provider.headers(key), "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify(provider.body(email)),
    signal: AbortSignal.timeout(ANSWER_WITHIN_MS),
  });
  if (response.ok) return void (await response.body?.cancel());
  const answer: unknown = await response.json().catch(() => undefined);
  throw new Refusal(response.status, codeOf(provider.codeIn(answer)));
}
