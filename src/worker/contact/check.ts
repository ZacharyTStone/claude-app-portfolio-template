/* Whether a message is one to send: an address that could be someone's, to
   reply to, and something to read. Plausible, not proven: only a reply
   proves an address. */
import { MAX_EMAIL_LENGTH, MAX_MESSAGE_LENGTH } from "../../contracts/contact.ts";
import type { ContactForm } from "./request.ts";

/** Before the @: up to 64 characters, none of them a space or what would
    end an address in a header (a quote, a bracket, a comma, a colon). */
const LOCAL_PART = String.raw`[^\s@"()<>[\]\\,;:]{1,64}`;
/** A name in a domain: letters and digits, with hyphens inside. */
const LABEL = String.raw`[\p{L}\p{N}](?:[\p{L}\p{N}-]{0,61}[\p{L}\p{N}])?`;
/** The domain's last name: letters ("com", "jp"), or one in punycode. */
const TOP_LEVEL = String.raw`(?:\p{L}{2,63}|xn--[a-z0-9-]{1,59})`;
const PLAUSIBLE_EMAIL = new RegExp(`^${LOCAL_PART}@(?:${LABEL}\\.)+${TOP_LEVEL}$`, "iu");

/** Nothing hidden or reordered, and no line break: an address goes into
    the email's Reply-To and its subject. */
const HIDDEN = /[\p{Cc}\p{Cf}\u2028\u2029]/u;

const isPlausibleEmail = (email: string): boolean =>
  email.length <= MAX_EMAIL_LENGTH && !HIDDEN.test(email) && PLAUSIBLE_EMAIL.test(email);

/** A control character but a tab and a line break. (A joiner, which an
    emoji can be made with, is a format character, and stays.) */
const CONTROL = /[^\P{Cc}\t\n]/u;

const isSendableMessage = (message: string): boolean =>
  message !== "" && message.length <= MAX_MESSAGE_LENGTH && !CONTROL.test(message);

/** What's wrong with a form a visitor sent, if anything. */
export function whatIsWrong({ email, message }: ContactForm): "email" | "message" | undefined {
  if (!isPlausibleEmail(email)) return "email";
  return isSendableMessage(message) ? undefined : "message";
}
