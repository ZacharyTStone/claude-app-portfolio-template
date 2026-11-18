/* The email the site's owner gets for a message: from an address on the
   site's own domain, to theirs, with Reply going to the visitor. */
import type { ContactForm } from "./request.ts";

/** Who the email is from, before the site's domain, where CONTACT_FROM
    doesn't say. */
const SENDER = "portfolio";

/** A site's address with "www." before its domain is the domain's. */
const WWW = /^www\./;

/** CONTACT_FROM, or portfolio@ and the domain the form was sent from: the
    site's, as Cloudflare serves it ("portfolio@example.com"). */
export const senderFor = (request: Request, contactFrom: string): string =>
  contactFrom || `${SENDER}@${new URL(request.url).hostname.replace(WWW, "")}`;

/** Who an email is from, and the one address it goes to. */
type Addresses = { from: string; to: string };

/** The email a message is sent as, whichever sender sends it
    (outbox.ts): to one address, with Reply going to the visitor. */
export type Email = Addresses & { replyTo: string; subject: string; text: string };

/** The email for a message a visitor sent. The visitor's address has been
    checked (check.ts), so it can't add a line to the subject, or another
    recipient: the email goes to `to` alone. */
export function emailFor({ email, message }: ContactForm, { from, to }: Addresses, request: Request): Email {
  const site = new URL(request.url).hostname;
  return {
    to,
    from,
    replyTo: email,
    subject: `Contact form: a message from ${email}`,
    text: `${message}\n\n(Sent with the contact form on ${site}. Reply, and it goes to ${email}.)\n`,
  };
}
