# Ask (optional)

With Ask off, as a new site starts, a question typed into the site gets
the "Something else" reply: how to reach you, with the question in an
email and a LinkedIn message to copy. Everything else works the same on
any host, and there is no server code at all.

With Ask on, a small model on Cloudflare Workers AI answers a typed
question from what your site already says, and the page shows the lines it
answered from.

## How a question is answered

1. **It picks.** The model reads every answer on your site, notes what the
   visitor wants to know, then names one of your answers, from a fixed
   list, and at most two of its lines (a sentence, an item of a list, a
   row of a card). A pick has to cover the question: one that doesn't name
   the tool, company or place the question names is dropped, so a near
   miss doesn't read as a "no".
2. **It writes.** From those lines a second, small call answers the
   question as it was asked, in its own words, in a sentence or two: "Does
   Alex know React?" gets "Yes, Alex knows React.", not the row of the
   card React is in.
3. **The Worker checks.** Before anyone sees the reply, the Worker
   (`src/worker`) checks the names, numbers and addresses in it
   (`src/worker/ask/grounded.ts`). Each has to be in the lines it was
   written from, their tab's name, your site's own question or your name,
   and never only in what the visitor typed. A reply that fails is asked
   for once more, then thrown away: the lines are quoted as they are if
   they're sentences, and otherwise the page shows the whole answer.
4. **The page shows its source.** The reply is shown as text, 240
   characters at most, with the lines it was written from quoted under
   it, then a link to the tab they're in. Lines of more than 800
   characters together are too long to quote: the reply then has only the
   link.

No good fit, or Ask over its limits, and the reply is "Something else".
There the visitor's question goes into the email and the message the page
offers. One more small call says it to you ("Do you…?" for "Does
Alex…?"), and its wording is used only if the Worker finds it the same
question, give or take who it is about; otherwise the question goes in as
it was typed.

### What isn't checked

The reply's ordinary words are not checked, and neither is what the check
can't tell from one: a name that only starts a sentence, a name in kana or
kanji, a number in kanji. Keeping to what the lines say is only the
model's instruction (`src/worker/ask/write.ts`), so a reply can still put
something wrongly: "No" where the lines mean yes. That is why the page
quotes the lines under every reply: what your site itself says is beside
what the model made of it.

The check reads English and Japanese. On a page in another language no
reply is written, and the lines are quoted.

### Questions it turns away

Two models read every question. The picker flags a rude one, or one that
tries to give it other orders, and Llama Guard reads each question too.
Either blocks that visitor from Ask for 24 hours.

## Write answers Ask can use

Ask finds what your site says, so write full sentences that make sense on
their own ("Alex joined Acme in 2024", not "Joined in 2024"), and state the
facts people ask about (dates, titles, tools) somewhere in words. A
picture is an illustration: Ask reads only its caption, so a fact belongs
in the answer's text too.

## Turning it on

First check which plan your Cloudflare account is on:
[What Ask can cost](#what-ask-can-cost).

1. In `site.config.ts`, set `ask: { role: "a software engineer" }`, with
   who you are in a few words. It needs `host: "cloudflare"`.
2. In `wrangler.jsonc`, uncomment the Ask block and the two lines marked
   "Ask" in `"assets"`.
3. Set a salt for hashing visitors' addresses:
   `npx wrangler secret put ASK_SALT`. Without it, a salt anyone can read
   in the code is used.
4. Deploy. Workers AI, the rate limit and the Durable Object are set up
   from `wrangler.jsonc`.

To pause it without a code change, set `ASK_ENABLED` to `"false"` in
`wrangler.jsonc` and deploy.

## Reading what it did

One line is logged per question, under the Worker's Observability tab:
which answer was picked and what it cost in Neurons, or why the question
was turned away. The visitor's address is never logged. What was asked,
what the model made of it and what was sent back are logged only if you
set `ASK_LOG_QUESTIONS` to `"true"`; if you do, say so on your site. With
it on, the `thought` in a line tells you why Ask answered as it did.

To see how well it picks, put questions about you in
`tests/ask-questions.json`, raise `ASK_VISITOR_LIMIT` above their number,
and run the eval (`tests/ask-eval.ts`) against your site:

```sh
node tests/ask-eval.ts https://your-site.example
```

It prints each reply the model wrote with the lines it was written from,
to read one against the other. The questions that should be blocked run
last, and block your address for a day.

## What Ask can cost

Ask keeps count of what the day's questions cost. Each question makes two
model calls (the pick with GLM-4.7-Flash, and Llama Guard) and, when
there's a reply to write, one or two more. The calls are kept small: the
picker may write 512 tokens, the reply's writer 320 a try, two tries at
most, and Llama Guard 10. Each reports the tokens it used, and the Worker prices them in
Neurons. Past `ASK_DAILY_NEURONS` (9,000, inside Workers AI's free 10,000
a day) no more are asked until midnight UTC. What one question costs
depends on how much your site says, since the model reads every answer:
each log line has it, as `neurons`. The site also takes at most 200
questions a day (`ASK_DAILY_LIMIT`), and one visitor 10 a minute and 30 a
day. All of these are in `wrangler.jsonc`.

Ask fails closed. With the rate limiter, the Durable Object or a model
missing or failing, no model is called, and the visitor gets the
"Something else" reply.

Those limits are the Worker's own. What happens to whatever they don't
cover depends on the Cloudflare plan your account is on:

- **Workers Free (recommended): nothing can be charged.** Past a limit,
  Cloudflare refuses instead of billing: 100,000 Worker requests a day,
  10,000 Neurons a day, and the Durable Object's free limits. A refused
  question gets the "Something else" reply, and the pages keep loading,
  because requests for files are free, unlimited and never run the Worker.
- **Workers Paid: the same flood is billed, and no account setting caps
  it.** Workers AI costs $0.011 per 1,000 Neurons past 10,000 a day,
  counted across the whole account: Ask stops at its own budget, but
  shares that allowance with everything else in the account. Worker
  requests (every `/ask`, and every address that isn't a file) cost $0.30
  per million past 10 million a month, and Durable Object requests past
  the plan's are billed too. Cloudflare's budget alerts only send an
  email, a day later.

If your account is on Workers Paid, make a charge impossible in one of two
ways:

1. **Give the site a free account of its own.** In the Cloudflare
   dashboard, **Accounts → Create Account** adds a Free account under the
   same login (up to five, once your login is a week old). Switch to it
   before you connect the repo, or deploy to it from your machine:

   ```sh
   CLOUDFLARE_ACCOUNT_ID=<the new account's id> npx wrangler deploy
   ```

2. **Or leave Ask off.** Then there is no Worker at all, every request is
   for a file, and those are free on every plan.

If you run Ask in a paid account anyway, keep `ASK_DAILY_NEURONS` at 9,000
or less and set a $1 budget alert (**Manage Account → Billing → Billable
Usage**), so that you at least hear about it.

## Rules at the edge

Ask's limits are checked by the Worker, so a request it turns away has
still run it, and so has every address that isn't a file. On Workers Free
those use up the 100,000 requests a day, after which Ask and the 404 page
stop until midnight UTC (your pages keep loading); on Workers Paid they
are billed. Two rules on your domain's zone turn the commonest of that
traffic away before the Worker runs. Both are free, and both are set in
the Cloudflare dashboard, under **Security → Security rules**.

1. **A rate limiting rule** (the Free plan has one), for a flood of
   questions from one address:

   - When incoming requests match: `(http.request.uri.path eq "/ask")`
   - With the same characteristics: IP
   - When rate exceeds: 5 requests per 10 seconds
   - Then take action: Block, for 10 seconds

2. **A custom rule**, action Block, for requests the site has no use for:
   anything but a `POST` to `/ask`, anything but `GET` or `HEAD` to the
   rest, and the paths scanners try.

   ```txt
   (http.request.uri.path eq "/ask" and http.request.method ne "POST")
   or (http.request.uri.path ne "/ask" and not (http.request.method in {"GET" "HEAD"}))
   or (http.request.uri.path contains ".php")
   or (http.request.uri.path contains "/wp-")
   or (http.request.uri.path contains "/.env")
   or (http.request.uri.path contains "/.git")
   or (http.request.uri.path contains "/cgi-bin/")
   ```

A site served under a path has that path before `/ask` in both rules.
**Security → Events** shows what each rule has matched.
