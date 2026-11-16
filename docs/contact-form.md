# The contact form (optional)

Three things under a thread's answer: the visitor's email, their message,
and Send. The message arrives in your inbox from an address on your own
domain, with Reply going to the visitor, so you answer it as you would any
email. There's no name or subject to fill in, no captcha, and no service
but Cloudflare's own. A new site starts without it.

## How it works

- **Where it is.** Under the last answer of the thread `contactForm.tab`
  names, usually your Contact thread. It's drawn by
  `src/components/ContactForm.astro`; its words are the five strings that
  start `contact` in `strings`.
- **Without JavaScript** it's a plain form. Send posts it to `/contact`,
  the Worker emails you, and the browser comes back to the form's tab's
  page (`/contact/`) at a note under the form that says it went
  (`#message-sent`) or that it didn't (`#message-failed`), which `:target`
  shows.
- **With JavaScript** (`src/app/contact-form.ts`) it's sent without
  leaving the tab, and the same note shows under Send. Once it has gone
  the boxes are emptied; if it hasn't, what the visitor typed stays, and
  the note offers your email address instead.
- **The email** (`src/worker/contact/email.ts`) is from `portfolio@` and
  your domain, to your own address and no one else's. Its Reply-To is
  the visitor's address, its subject "Contact form: a message from" that
  address, and its text the message. The Worker's `send_email` binding is
  locked to your address, so the form can't be made to email anyone
  else.

## Turning it on

It needs `host: "cloudflare"`, where its Worker runs, and a domain of
your own on Cloudflare.

1. **In `site.config.ts`**, set the thread it goes under:

   ```ts
   contactForm: { tab: "contact" },
   ```

   An English page has the form's words already. A page in another
   language states them in its `strings`: `contactEmail`,
   `contactMessage`, `contactSend`, `contactSent` and `contactFailed`
   (`examples/ja.ts` has them in Japanese), and the build names one that's
   missing. With a Japanese page, cut its fonts again
   ([Languages and fonts](languages.md#japanese-fonts)).

2. **In `wrangler.jsonc`**, uncomment the Worker's block, the two lines
   marked "Worker" in `"assets"`, and the contact form's block. Then put
   your own address, the one you read, in two places: the binding's
   `destination_address`, which locks it to that address, and
   `CONTACT_TO` in `"vars"`, where the Worker sends.

   ```jsonc
   "send_email": [{ "name": "CONTACT_EMAIL", "destination_address": "you@gmail.com" }],
   ```

   ```jsonc
   "CONTACT_TO": "you@gmail.com",
   ```

   It can be on any domain. A site that has Ask on already has the
   Worker's block: add the `send_email` line, `CONTACT_TO`, and
   `"/contact"` to `"run_worker_first"`. `npm test` names anything
   `wrangler.jsonc` is missing while `site.config.ts` has the form, and
   says so if the two addresses differ.

3. **In the Cloudflare dashboard**, under **Compute → Email Service →
   Email Routing**:

   - **Onboard your site's domain.** This adds MX records to the
     domain's DNS (and SPF and DKIM records beside them), so from then on
     mail sent to any address at your domain goes to Cloudflare. The form
     sends from an address there, and Cloudflare sends only from a domain
     Email Routing is on for. If the domain already receives mail
     somewhere else (Google Workspace, say), onboarding stops rather than
     take that mail over: Cloudflare's Email Service docs say how to
     route a subdomain instead, and `CONTACT_FROM` (below) then names an
     address on it.
   - **Add your address under Destination addresses**, the one in
     `CONTACT_TO`, and open the link in the email Cloudflare sends to it.
     Until it's verified, nothing is sent there.

   Sending to a verified destination address is free on every plan, and
   doesn't count toward the Email Sending quota of a paid one.

4. **Deploy**: `npm run deploy`, or a push to a connected repo. Then send
   yourself a message from the site. (`npm run wrangler -- dev` runs the
   Worker on your machine, where Cloudflare doesn't send the email but
   prints it, and keeps its text under `.wrangler/`.)

To turn it off, remove `contactForm` from `site.config.ts`: the page then
has no form, and `/contact` is never sent anything from it.

## Its settings

The Worker reads them from `"vars"` in `wrangler.jsonc`, beside Ask's;
`src/worker/settings.ts` has the defaults.

| Variable | Default | What it is |
| --- | --- | --- |
| `CONTACT_TO` | none: nothing is sent | Your address, the binding's `destination_address` |
| `CONTACT_VISITOR_LIMIT` | `3` | Messages one visitor may send in a day (UTC) |
| `CONTACT_DAILY_LIMIT` | `20` | Messages the whole site sends in a day |
| `CONTACT_FROM` | `portfolio@` and your domain | The address the emails come from |

`CONTACT_FROM`, left out, is `portfolio@` and the domain the form was sent
from, less a leading `www.`. Set it when that isn't a domain Email Routing
is on for. On a `workers.dev` address the form can't send: use your own
domain.

## What keeps spam out

The form has no captcha, so the Worker does the work, before anything
is sent and mostly before anything is read (`src/worker/contact/`):

- **Only from your own pages.** A form posted from any other site is
  turned away unread: the request's `Origin` has to be your site's, and
  its `Sec-Fetch-Site`, where the browser sends one, `same-origin`.
- **Only a form, and a small one**: a POST of form fields, 24 KiB at
  most. The address has to look like one (no spaces, brackets or commas,
  and a domain with a dot in it), and the message has to be there, be
  2,000 characters at most, and have no control characters in it.
- **A field only a bot fills in.** The form has a box no visitor sees
  and the keyboard never reaches. A message with it filled in is dropped,
  and the bot is told it went, so it has no reason to try again.
- **A day's limits**, per visitor and for the site (above), kept in the
  Durable Object Ask uses (AskGuard). A visitor is counted by a hash of
  their address, salted with `ASK_SALT` and the day, as Ask counts them
  ([Security](security.md#ask)); what's kept under it is deleted at
  midnight UTC. A message is counted before it's sent, so one Cloudflare
  then refuses counts too. Without AskGuard, or with it down, nothing is
  sent.
- **Only ever to you**: the Worker sends to `CONTACT_TO` alone, and
  `destination_address` locks the binding to that address whatever the
  Worker asks.

The two [rules at the edge](ask.md#rules-at-the-edge) turn most of the
rest away before the Worker runs, and cover `/contact` as they do
`/ask`: set them as Ask's guide says, Ask or no Ask.

## Reading what it did

One line is logged per message, under the Worker's Observability tab:
what came of it, and never who sent it. The visitor's address, their
email and the message are never logged, and Cloudflare's own line for
each request is off (`invocation_logs` in `wrangler.jsonc`).

| Line | What happened |
| --- | --- |
| `{"contact":"sent"}` | It went |
| `{"contact":"trapped"}` | A bot filled in the field only a bot fills in: nothing was sent |
| `{"contact":"invalid","why":"email"}` | The address didn't look like one (or `"message"`: the message was empty, too long, or not text) |
| `{"contact":"refused","why":"limited"}` | The visitor had sent all they may today (`"spent"`: the site had; `"down"`: AskGuard, the binding or `CONTACT_TO` is missing, or AskGuard is down) |
| `{"contact":"error","error":"E_SENDER_NOT_VERIFIED"}` | Cloudflare didn't send it, with its code for why |

`E_SENDER_NOT_VERIFIED` means the address it's from isn't on a domain
Email Routing is on for: onboard the domain, or set `CONTACT_FROM`. An
unverified destination address, or a `CONTACT_TO` other than the
binding's `destination_address`, is another code: verify the address in
the dashboard, and make the two the same.
