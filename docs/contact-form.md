# The contact form (optional)

Three things under a thread's answer: the visitor's email, their message,
and Send. The message arrives in your inbox from an address on your own
domain, with Reply going to the visitor, so you answer it as you would any
email. There's no name or subject to fill in, and no captcha. On
Cloudflare, the site's Worker sends it, with Cloudflare's Email Routing or
[a sender of your choosing](#choosing-a-sender); on Netlify, Netlify Forms
takes it ([On Netlify](#on-netlify)). A new site starts without it.

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
  else. (With [Resend or Postmark](#choosing-a-sender) the lock is the
  Worker's own code.)

## A question Ask can't answer

On a site with [Ask](ask.md) on too, the "Something else" reply to a
question Ask has no answer for starts with a link to the form: "Send it
with the contact form" (`strings.askForm`), with the form's tab's name
under it.

- **A plain click** opens the form's tab in place, puts the question in
  the message box, as it was said to you where Ask said it ("Do you…?"),
  otherwise as it was typed, and puts the cursor in the email box, the one
  left to fill. Nothing is sent until the visitor presses Send.
- **What the visitor had typed in the box stays.** The question goes
  after it, in a paragraph of its own, unless the box has it already, or
  it would take the message past its 2,000 characters.
- **A modifier-click** (a new tab) opens the form's tab's page, empty: the
  question isn't put in its address. Ask needs JavaScript, so without it
  there is no reply to have the link.
- **A blocked visitor** gets no link, as they get no message to copy:
  nothing they typed is shown back.
- **The email and LinkedIn stay**, after the form: your `asked.answer`
  may name them, and some visitors would rather not give a form their
  address.

On a site without Ask, or without the form, "Something else" is as it
was. Ask's log line is the same either way: it says whether the question
was said to you (`toOwner`), and the form is the page's to offer.

## Turning it on

On Cloudflare, it needs a domain of your own there. These steps send with
Email Routing, the default; to send with Resend or Postmark instead, see
[Choosing a sender](#choosing-a-sender), and on Netlify,
[On Netlify](#on-netlify).

1. **In `site.config.ts`**, set the thread it goes under:

   ```ts
   contactForm: { tab: "contact" },
   ```

   An English page has the form's words already. A page in another
   language states them in its `strings`: `contactEmail`,
   `contactMessage`, `contactSend`, `contactSent` and `contactFailed`,
   and with Ask on, `askForm` (`examples/ja.ts` has them in Japanese), and
   the build names one that's missing. With a Japanese page, cut its fonts again
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
     address on it. Or [send with Resend or Postmark](#choosing-a-sender),
     which leave your domain's mail where it is.
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

## Choosing a sender

`CONTACT_SENDER` in `"vars"` says who sends the Worker's emails. Each
sends the same email, from `CONTACT_FROM`, to `CONTACT_TO` alone, with
Reply going to the visitor, past the same checks and the same day's
limits.

| `CONTACT_SENDER` | Who sends | What it needs |
| --- | --- | --- |
| `"cloudflare"` (the default) | The `send_email` binding | Email Routing on your domain, and your address verified there (above) |
| `"resend"` | [Resend](https://resend.com)'s API | A domain verified with Resend, and an API key |
| `"postmark"` | [Postmark](https://postmarkapp.com)'s API | A domain or sender signature confirmed with Postmark, and a server API token |

Resend and Postmark are for a domain whose mail is elsewhere, which Email
Routing won't take over. They send for your domain from DNS records of
their own (DKIM, and a return path on a subdomain), beside the MX records
you have, so your inbox stays where it is. Each has a free plan with a
monthly allowance; `CONTACT_DAILY_LIMIT` keeps the form well inside it.

1. **With the provider**, add your site's domain (or the subdomain you'll
   send from), and add the DNS records it gives you, in Cloudflare's DNS
   for the domain. Wait until it says the domain is verified: until then
   it refuses every email, and the log says so (below).
2. **Make a key that only sends.** In Resend, an API key with sending
   access, for that one domain. In Postmark, a server's API token (the
   server's **API Tokens** tab). A new Postmark account sends only to
   addresses on the domain it sends from until Postmark approves it, so
   ask for approval if `CONTACT_TO` is on another domain.
3. **Give the Worker the key as a secret**, never in `wrangler.jsonc`,
   which is in your repo:

   ```sh
   npm run wrangler -- secret put CONTACT_API_KEY
   ```

   It's sent to the provider's API, in the header it reads, and nowhere
   else: not to a page, not to the log. `npm test` fails if
   `CONTACT_API_KEY` is in `"vars"`.
4. **In `wrangler.jsonc`**, uncomment the Worker's block and the two lines
   marked "Worker" in `"assets"`, as above, but leave the `send_email`
   line commented out. In `"vars"`, set your address and the sender, and
   `CONTACT_FROM` if `portfolio@` and your site's domain isn't on the
   domain you verified:

   ```jsonc
   "CONTACT_TO": "you@gmail.com",
   "CONTACT_SENDER": "resend",
   "CONTACT_FROM": "portfolio@mail.example.com",
   ```

5. **Deploy**, and send yourself a message from the site.
   (`npm run wrangler -- dev` asks the provider for real, with the key in
   `.dev.vars`, which git ignores; without it there, the form says it
   couldn't send.)

**What locks it to you.** The `send_email` binding is locked to your
address in `wrangler.jsonc`, whatever the Worker asks of it. An API key
isn't: it can send to anyone, from your verified domain. With Resend or
Postmark, what keeps the form to your address is the Worker's code
(`src/worker/contact/providers.ts`), which names `CONTACT_TO` as the one
recipient and takes nothing a visitor sends as an address but Reply-To. So
keep the key a secret, give it no more than sending, and if it's ever
seen, revoke it with the provider and put a new one.

## On Netlify

With `host: "netlify"`, the form is a Netlify form, and there's no Worker:
Netlify Forms takes each message, keeps it under the site's **Forms**, and
emails you a notification, from Netlify, with Reply going to the visitor.

- **Each language's pages have a form of their own**, `contact-en`,
  `contact-fr` and so on (`src/components/contact-form.ts`), which Netlify
  finds in the built HTML at each deploy: the form says `data-netlify`,
  its name, a hidden `form-name` with that name, and `netlify-honeypot`,
  the field only a bot fills in.
- **Without JavaScript**, Send posts it to the form's own tab's page, at
  the note that says it went (`/contact/#message-sent`). Netlify takes the
  message and answers with that page, and `:target` shows the note, as it
  does when the Worker sends a visitor back. There's no note that it
  didn't: Netlify has no page of the site's to send a visitor to when it
  doesn't take one, so they see Netlify's error instead.
- **With JavaScript** it's sent without leaving the tab, to the same page,
  and the same notes show under Send: any answer Netlify gives in the 200s
  says it went, and anything else, or none, that it didn't.
- **No Ask.** Ask runs only on Cloudflare, so a site on Netlify has none,
  and "Something else" has no link to the form.

To turn it on:

1. **In `site.config.ts`**, set `host: "netlify"` and the thread the form
   goes under, as on Cloudflare: `contactForm: { tab: "contact" }`.
   `wrangler.jsonc` isn't read.
2. **In the Netlify UI**, under **Forms**, select **Enable form
   detection**, then deploy: Netlify only looks for forms in a deploy made
   once it's on. The forms are then listed under **Forms**.
3. **Under Forms → Submission notifications**, add an email
   notification to your address, for any form. An address that isn't
   your Netlify team's gets an email from Netlify to confirm it first, and
   nothing until it's confirmed. The form's `email` box is what Netlify
   sets the notification's Reply-To to.
4. **Send yourself a message**, with JavaScript off too. Netlify's docs
   say a form's `action` is a path on the site, and say nothing of one
   that ends at a note (`#message-sent`); a browser keeps it. If Netlify
   shows a page of its own that says it got the message, in place of the
   form's tab, the message went all the same.

What keeps spam out there is Netlify's: the honeypot, which drops a
message with the hidden field filled in, and Akismet, which files what it
reads as spam under **Spam submissions**, where a real message may be
too. The Worker's checks and its limits per visitor and per day aren't
there: Netlify counts submissions against the site's plan instead. And
Netlify keeps each message, the visitor's address with it, until you
delete it under **Forms**, where the Worker keeps nothing.

## Its settings

The Worker reads them from `"vars"` in `wrangler.jsonc`, beside Ask's;
`src/worker/settings.ts` has the defaults.

| Variable | Default | What it is |
| --- | --- | --- |
| `CONTACT_TO` | none: nothing is sent | Your address, the binding's `destination_address` |
| `CONTACT_SENDER` | `"cloudflare"` | Who sends: `"cloudflare"`, `"resend"` or `"postmark"` ([Choosing a sender](#choosing-a-sender)) |
| `CONTACT_VISITOR_LIMIT` | `3` | Messages one visitor may send in a day (UTC) |
| `CONTACT_DAILY_LIMIT` | `20` | Messages the whole site sends in a day |
| `CONTACT_FROM` | `portfolio@` and your domain | The address the emails come from |

`CONTACT_FROM`, left out, is `portfolio@` and the domain the form was sent
from, less a leading `www.`. Set it when that isn't a domain Email Routing
is on for, or the one you verified with Resend or Postmark. On a
`workers.dev` address the form can't send: use your own domain.

With Resend or Postmark, the Worker also needs `CONTACT_API_KEY`, a secret
(`npm run wrangler -- secret put CONTACT_API_KEY`), never a variable in
`"vars"`. None of these is read on Netlify.

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
  midnight UTC. A message is counted before it's sent, so one the sender
  then refuses counts too. Without AskGuard, or with it down, nothing is
  sent.
- **Only ever to you**: the Worker sends to `CONTACT_TO` alone, and
  `destination_address` locks the binding to that address whatever the
  Worker asks. With Resend or Postmark there's no binding to lock: the
  Worker's code is what names the one recipient.

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
| `{"contact":"refused","why":"limited"}` | The visitor had sent all they may today (`"spent"`: the site had; `"down"`: AskGuard, the binding, `CONTACT_API_KEY` or `CONTACT_TO` is missing, or AskGuard is down) |
| `{"contact":"error","error":"E_SENDER_NOT_VERIFIED"}` | Cloudflare didn't send it, with its code for why |
| `{"contact":"error","error":"validation_error","status":403}` | Resend or Postmark didn't, with the status its API answered and its own code for why |
| `{"contact":"error","error":"TimeoutError"}` | The sender didn't answer within 10 seconds (or `"TypeError"`: couldn't be reached) |

`E_SENDER_NOT_VERIFIED` means the address it's from isn't on a domain
Email Routing is on for: onboard the domain, or set `CONTACT_FROM`. An
unverified destination address, or a `CONTACT_TO` other than the
binding's `destination_address`, is another code: verify the address in
the dashboard, and make the two the same.

A code from Resend is the `name` in its answer, and one from Postmark the
`ErrorCode`, as each one's API docs list them: Resend's
`validation_error` with 403 is most often a `CONTACT_FROM` that isn't on
the domain you verified, and with 401 a key it doesn't know. Postmark's
`10` is a token it doesn't know, `406` a `CONTACT_TO` it has marked
inactive (after a bounce), `412` an account still waiting for approval,
and `300` an email it couldn't send as it was. Neither one's message is
logged: it can name an address.

On Netlify, the Worker logs nothing: Netlify lists each submission under
**Forms**.
