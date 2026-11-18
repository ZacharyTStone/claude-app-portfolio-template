/* Where the contact form's emails go out: the sender CONTACT_SENDER names.
   Cloudflare's send_email binding is locked to the owner's address by
   wrangler.jsonc, whatever the Worker asks of it. An API sender sends
   wherever it's asked, so there the lock is this Worker's own code: each
   email it asks for goes to CONTACT_TO alone (email.ts). */
import type { Env } from "../env.ts";
import type { Fetch } from "../lib/http.ts";
import type { Settings } from "../settings.ts";
import type { Email } from "./email.ts";
import { sendWith } from "./providers.ts";

/** Sends one email, or throws: the binding's error, fetch()'s, or a
    Refusal from a sender's API. */
export type Outbox = (email: Email) => Promise<void>;

/** The way out CONTACT_SENDER names, or undefined where what it needs
    isn't there: the binding, or the API's key. */
export function outboxFor(env: Env, { contactSender }: Settings, fetch: Fetch): Outbox | undefined {
  if (contactSender === "cloudflare") {
    const binding = env.CONTACT_EMAIL;
    return binding ? async (email) => void (await binding.send(email)) : undefined;
  }
  const key = env.CONTACT_API_KEY;
  return key ? (email) => sendWith(contactSender, key, email, fetch) : undefined;
}
