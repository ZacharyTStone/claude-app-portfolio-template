/* /contact: a message from the contact form, emailed to the site's owner.
   What came of it, a ContactOutcome, says what the visitor is told and
   what the log gets. Each check comes before anything dearer than it:
   nothing is read of a request that isn't the site's own form, nothing is
   counted for a message that won't be sent, and nothing is sent past the
   day's limits. */
import type { Env } from "../env.ts";
import { guardFor } from "../guard/client.ts";
import type { Fetch } from "../lib/http.ts";
import { utcDay } from "../lib/time.ts";
import { hashAddress, visitorAddress } from "../lib/visitor.ts";
import { readSettings, type Settings } from "../settings.ts";
import { whatIsWrong } from "./check.ts";
import { emailFor, senderFor } from "./email.ts";
import { lineFor, type ContactLogSink } from "./log.ts";
import { responseTo, type ContactOutcome, type Sending } from "./outcome.ts";
import { outboxFor } from "./outbox.ts";
import { pageToReturnTo, readContactForm, rejectionUnlessFormPost, type ContactForm } from "./request.ts";

/** What the Worker has to send a message with: its bindings and secrets,
    its settings, and fetch(), for a sender's API. */
type Given = { env: Env; settings: Settings; fetch: Fetch };

export async function handleContact(request: Request, env: Env, log: ContactLogSink, fetch: Fetch): Promise<Response> {
  const outcome = await outcomeOf(request, { env, settings: readSettings(env), fetch });
  const line = lineFor(outcome);
  if (line) log(line);
  return responseTo(outcome, request);
}

async function outcomeOf(request: Request, given: Given): Promise<ContactOutcome> {
  const notTheForm = rejectionUnlessFormPost(request);
  if (notTheForm) return { kind: "rejected", rejection: notTheForm };
  const form = await readContactForm(request);
  if ("error" in form) return { kind: "rejected", rejection: form };
  const page = pageToReturnTo(form.page, request);
  // A bot is told it worked, so it has no reason to try again otherwise.
  if (form.trap) return { kind: "trapped", page };
  const wrong = whatIsWrong(form);
  if (wrong) return { kind: "invalid", why: wrong, page };
  return { ...(await send(form, request, given)), page };
}

/** Takes the message from the day's allowances, the visitor's (as the hash
    of their address, as Ask counts them) and the site's, then sends it
    with the sender CONTACT_SENDER names. */
async function send(form: ContactForm, request: Request, { env, settings, fetch }: Given): Promise<Sending> {
  const outbox = outboxFor(env, settings, fetch);
  const { contactTo: to, contactFrom } = settings;
  if (!outbox || !to) return { kind: "refused", why: "down" };
  const visitorHash = await hashAddress(visitorAddress(request), settings.salt, utcDay(Date.now()));
  const gate = await guardFor(env.ASK_GUARD, settings).takeMessage(visitorHash);
  if (gate.state !== "ok") return { kind: "refused", why: gate.state };
  try {
    await outbox(emailFor(form, { from: senderFor(request, contactFrom), to }, request));
    return { kind: "sent" };
  } catch (error) {
    return { kind: "failed", error };
  }
}
