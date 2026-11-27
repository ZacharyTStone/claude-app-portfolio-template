# Security

What protects a site made from the template, its visitors and its bill.
The numbers are the defaults, from `wrangler.jsonc`. To report a problem
in the code, see the security policy in the template's repository.

## The pages

- The Content-Security-Policy is `default-src 'none'`, with only the site's
  own scripts, styles, images and fonts. Nothing inline runs, the page may
  fetch only from the site itself, and only with Ask or the contact form
  on, and there is no `<base>`, and no form post but the contact form's,
  to the site itself. No other site can show the pages in a frame,
  and the pages show none themselves, unless you set `viewer`: then
  `frame-src` names the sites the viewer shows, and no other. With
  `writing.viewer`, the viewer shows the site's own pages of your posts:
  `frame-src` then has `'self'` too, and the pages let the site itself
  show them in a frame (`frame-ancestors 'self'`), and still no other.
- Trusted Types is required with no policy, so the script can't turn a
  string into markup. It builds elements, and shows a reply from `/ask` as
  text.
- The other headers are in `src/site/security-headers.ts`: HTTPS only for
  two years (HSTS; subdomains and preloading if you ask for them with
  `hsts`); `nosniff`; `X-Frame-Options: DENY` (`SAMEORIGIN` with
  `writing.viewer`); a referrer policy that gives another site the origin
  at most; a Permissions-Policy that turns off the camera, microphone,
  location, payments, USB and ad topics; and
  `Cross-Origin-Opener-Policy: same-origin`.
- Every page carries its Content-Security-Policy and referrer policy in
  `<meta>` tags, whatever `host` the config names, so a site deployed
  somewhere else still has them. Hosts that read `_headers` (Cloudflare,
  Netlify) also send them as headers, adding `frame-ancestors`, which
  only works as a header; on any other host the rest are yours to set
  ([Deploying](deploy.md)).
- The four policies, and each header's name and value, are written out in
  the tests (`tests/site/security-headers.test.ts`), so a change that
  weakens one fails a test.
- The site has no analytics and no cookies, and loads nothing from another
  site by itself: the fonts and icons are its own files. Chats and layout
  are kept in `localStorage`, in the visitor's browser only. A link to
  another site opens with `noopener noreferrer`.
- The one exception for scripts is Cloudflare Web Analytics, and only on a
  site that sets `analytics: "cloudflare"` ([Deploying](deploy.md)).
  Cloudflare adds its beacon to each page as it passes; the policy then
  lets that one script load, from `https://static.cloudflareinsights.com`,
  and send what it measures to the site's own `/cdn-cgi/rum`. Nothing
  inline is allowed, Trusted Types still hold, and the beacon sets no
  cookie. A site that has it should say so where it says what it
  collects.
- The one exception is the viewer, and only on a site that sets `viewer`
  ([What the site says](content.md#the-viewer)). When a visitor opens a
  link in it, that page loads from its own site, in a frame, and that site
  sees the visitor as any site they open does. The policy allows frames
  from the sites `viewer` names and no other; the frame is sandboxed so it
  can't navigate the page, is sent no referrer, and is thrown away when
  the viewer closes. A viewer address must be `https://` with a plain
  domain name as its host. A post's own page
  ([Writing](writing.md#reading-a-post-on-the-site)) is the site's, not
  another's: its frame may load the site's stylesheet and fonts and open
  a link in a new tab, and it may run no script, so nothing in the frame
  can reach the page around it.
- With a [Writing tab](writing.md), it's the build that asks Qiita, Zenn,
  DEV or a blog's feed for your posts, not a visitor's browser: the pages
  still load nothing from another site. What each sends is checked before
  any of it reaches a page, only what a card shows is kept, a card links
  to the place the post is on and nowhere else (a feed's post, to the
  blog's own site), and a title is text, never markup. A feed is read as
  XML that declares no entities of its own, and nothing of a post's text
  in it is read. With `writing.viewer` a Qiita post's text is kept too,
  and read from its Markdown into the parts of a page, never as HTML: no
  markup in a post reaches a page, a link in it goes to a web address or
  is just its words, and a picture is a link, so the page loads nothing
  from another site either. No other place's post has a page, since every
  other place gives a post's text only as HTML.
- With [activity](activity.md) in the panel, it's the build too that asks
  GitHub, GitLab or Codeberg, for public activity only. What each sends is
  checked, only a repo's name and a day are kept, a row links to the
  repo's own place (`github.com`, `gitlab.com` or `codeberg.org`) and
  nowhere else, and a name is text. A `GITHUB_TOKEN` the build is given is
  sent to GitHub's API alone, never to GitLab or Codeberg, and never
  reaches a page or a log.
- The build checks the config. It stops on a link that isn't a web, mailto,
  #tab or site address (so no `javascript:`; and `//host`, `\\host` and
  `/\host` are other sites, not the site's own), and on a value that doesn't
  look like what it's used as. The config's Markdown is bold, italic, code
  and links, never HTML.

## Ask

Ask is off as a new site starts: then there is no Worker, and nothing in
this section to protect. [Ask](ask.md) says how it works; this is what
holds it.

- **Its requests are small.** Ask takes only a small JSON POST. Another
  method, another content type (which a page on another site can't send)
  or a body over 2,048 bytes is refused before anything is spent on it,
  and a question is cut to 300 characters, as is each of the two earlier
  ones of its chat it may come with. An earlier answer is named by its id,
  and read from the site's own answers.
- **A reply is held to your site**, by a fixed list of answers to pick
  from, a check of every name, number and address in it (which also
  refuses a character no reader can see, and a letter from a script the
  page's language doesn't use), and the quoted lines under it: [How a question is answered](ask.md#how-a-question-is-answered),
  and [what isn't checked](ask.md#what-isnt-checked).
- **Rude questions block the asker's address**, for an hour:
  [Questions it turns away](ask.md#questions-it-turns-away).
- **Visitors aren't identified.** A visitor is counted by a salted hash of
  their address (an IPv6 address by its /64), with the day in the hash:
  tomorrow's is another, and midnight UTC deletes what was kept under
  today's. Set your own salt as a secret (`ASK_SALT`): with the public
  default, a stored hash can still be worked back to its address that day.
  The address is never stored or logged, and Cloudflare's invocation logs,
  which would keep it beside a logged question, are off in
  `wrangler.jsonc`. What was asked is logged only if you turn
  `ASK_LOG_QUESTIONS` on, and an error is logged by its number or kind,
  never its message.
- **Its cost is capped**, per visitor, per day and in Neurons, and it
  fails closed: [What Ask can cost](ask.md#what-ask-can-cost). On Workers
  Free, Cloudflare refuses what it would otherwise bill.
- **The daily rebuild's hook is a secret.** The address of the deploy
  hook a Writing tab's rebuild POSTs to is a credential, since anyone with
  it can start a build: it's kept as a secret (`DEPLOY_HOOK_URL`), never in
  the repo, and the Worker logs neither it nor an error's message, which
  could have it in it ([A rebuild each day](writing.md#a-rebuild-each-day)).
- **Two rules are yours to set by hand** in the Cloudflare dashboard: a
  rate limit on `/ask`, and a block on requests the site has no use for
  ([Rules at the edge](ask.md#rules-at-the-edge)).

## The contact form

The [contact form](contact-form.md) is off as a new site starts, like Ask.
With it on:

- **It takes only the site's own form.** A POST of form fields from one
  of the site's own pages (its `Origin` the site's, and its
  `Sec-Fetch-Site`, where a browser sends one, `same-origin`), of 24 KiB
  at most. A page on another site can post a form to any address, but
  this one turns it away unread.
- **It emails only you.** The Worker sends to one address,
  `CONTACT_TO`, and its `send_email` binding is locked to that address in
  `wrangler.jsonc`, whatever the Worker asks. With Resend or Postmark as
  the sender there's no binding: the Worker's code names `CONTACT_TO` as
  the one recipient, and the key, which could send anywhere, is a secret
  (`CONTACT_API_KEY`) that goes to that API alone, in no page and no log.
  The visitor's address goes in the email's Reply-To and subject only
  once it looks like an address, with nothing in it that could start
  another line.
- **Its sending is capped**, per visitor and per day for the site, in the
  Durable Object Ask uses, with visitors counted by the same salted,
  daily hash of their address. A field only a bot fills in drops what a
  bot sends. Without the binding (or the API key) or the Durable Object,
  nothing is sent.
- **Nothing a visitor sent is logged**: not their address, their email or
  the message, only what came of it. A sender's refusal is logged by its
  status and code, never its message.
- **On Netlify, Netlify Forms takes it**, with no Worker: the pages and
  their policy are the same, the form posts to the site itself, and
  Netlify's honeypot and spam filter stand where the Worker's checks and
  limits do. Netlify keeps each message, with the visitor's address, until
  you delete it ([On Netlify](contact-form.md#on-netlify)).

## security.txt

Every build writes `/.well-known/security.txt`
([RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)), which tells someone
who finds a security problem with the site where to report it:

- `Contact`: your `links.email`, the address the site gives for everything
  else, so the file says nothing the pages don't. There's no setting for
  it: a report about your site goes to you. A problem in the shared code
  is the template's, and its security policy says where that goes.
- `Expires`: 364 days after the build. RFC 9116 asks for less than a year,
  so that a file nobody keeps up says it's out of date. Each build writes
  it again: every push, and on a site with a Writing tab
  [the daily rebuild](writing.md#a-rebuild-each-day). A site that goes a
  year without a build has a file past its date, which a reader is to
  treat as stale.
- `Preferred-Languages`: the site's languages, the main one first.
- `Canonical`: its own address. On a site served under a path, the file
  is under that path too
  (`https://you.github.io/portfolio/.well-known/security.txt`), where no
  one looks: RFC 9116 reads only the one at the host's root.

Its folder's name starts with a dot, and some deploys leave such a folder
out: GitHub Pages' upload does unless told not to
([Deploying](deploy.md#github-pages)).

## The code

- What `npm run verify` runs, runs on each pull request
  (`.github/workflows/check.yml`): formatting, ESLint, knip, types, the
  unit tests (after a build), the HTML and the fonts in one job, and the
  browser checks, which are served with the real security headers, split
  across three more beside it. The workflow's token
  can only read the repository, and each action it uses is pinned to a
  commit.
- Dependabot opens a pull request each month for the npm packages and the
  GitHub Actions. None of the packages reaches the browser: only Astro's
  build of the site does.
- Nothing built is committed. Your host builds the site from source.
- An update trusts the template commit it prints: its code runs on
  `npm ci` and in your Actions
  ([What an update trusts](updating.md#what-an-update-trusts)).
