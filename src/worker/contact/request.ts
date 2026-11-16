/* What /contact accepts: the contact form's fields, posted from a page of
   the site itself as a form posts them, in at most MAX_CONTACT_BYTES.
   Anything else is turned away with a 4xx before anything is read or
   counted. */
import { CONTACT_FIELDS, MAX_CONTACT_BYTES } from "../../contracts/contact.ts";
import { HTTP_STATUS, readBodyText, type Rejection } from "../lib/http.ts";

/** How a form posts its fields, and how the page's script sends them too. */
const FORM_TYPE = "application/x-www-form-urlencoded";

/** What a browser says, in Sec-Fetch-Site, of a request from a page with the
    same origin as where it goes. */
const SAME_ORIGIN = "same-origin";

/** Whether a request comes from a page of this site. A page on any other
    site can post a form here, and no browser stops it, but none lets that
    page make the request's Origin this site's, or its Sec-Fetch-Site
    "same-origin". Every browser sends Origin with a POST, so one without
    it isn't a visitor's. */
function isFromTheSite(request: Request): boolean {
  const fetchedFrom = request.headers.get("Sec-Fetch-Site");
  if (fetchedFrom !== null && fetchedFrom !== SAME_ORIGIN) return false;
  return request.headers.get("Origin") === new URL(request.url).origin;
}

export function rejectionUnlessFormPost(request: Request): Rejection | undefined {
  if (request.method !== "POST") {
    return { status: HTTP_STATUS.methodNotAllowed, error: "POST only", headers: { Allow: "POST" } };
  }
  if (!isFromTheSite(request)) return { status: HTTP_STATUS.forbidden, error: "not from this site" };
  const isForm = (request.headers.get("Content-Type") ?? "").startsWith(FORM_TYPE);
  return isForm ? undefined : { status: HTTP_STATUS.unsupportedMediaType, error: "a form only" };
}

/** The form as it was sent: each field as text, "" for one that's missing.
    The address is trimmed, and the message too, with its line breaks as
    "\n" (a form sends them as "\r\n"). */
export type ContactForm = Record<keyof typeof CONTACT_FIELDS, string>;

const TOO_LONG: Rejection = { status: HTTP_STATUS.payloadTooLarge, error: "too long" };

export async function readContactForm(request: Request): Promise<ContactForm | Rejection> {
  if (Number(request.headers.get("Content-Length") ?? 0) > MAX_CONTACT_BYTES) return TOO_LONG;
  let text: string | null;
  try {
    // Measured as it comes, too: Content-Length can be missing.
    text = await readBodyText(request, MAX_CONTACT_BYTES);
  } catch {
    return { status: HTTP_STATUS.badRequest, error: "unreadable" };
  }
  if (text === null) return TOO_LONG;
  const fields = new URLSearchParams(text);
  const field = (name: string) => fields.get(name) ?? "";
  return {
    email: field(CONTACT_FIELDS.email).trim(),
    message: field(CONTACT_FIELDS.message).replaceAll("\r\n", "\n").trim(),
    page: field(CONTACT_FIELDS.page),
    trap: field(CONTACT_FIELDS.trap),
  };
}

/** The page to send a visitor back to: the path the form gave, if it's one
    on this site ("/", "/ja/"); otherwise the site's root. Never another
    site, whatever the field says. */
export function pageToReturnTo(written: string, request: Request): string {
  const { origin } = new URL(request.url);
  if (!written.startsWith("/")) return "/";
  try {
    const address = new URL(written, origin);
    return address.origin === origin && address.pathname === written ? written : "/";
  } catch {
    return "/";
  }
}
