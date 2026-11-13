# Security

What protects a site made from the template, its visitors and its bill.
The numbers are the defaults, from `wrangler.jsonc`. To report a problem
in the code, see the security policy in the template's repository.

## The pages

- The Content-Security-Policy is `default-src 'none'`, with only the site's
  own scripts, styles, images and fonts. Nothing inline runs, the page may
  fetch only from the site itself, and only with Ask on, and there is no
  `<base>` and no form post. No other site can show the pages in a frame,
  and the pages show none themselves, unless you set `viewer`: then
  `frame-src` names the sites the viewer shows, and no other.
- Trusted Types is required with no policy, so the script can't turn a
  string into markup. It builds elements, and shows a reply from `/ask` as
  text.
- The other headers are in `src/site/security-headers.ts`: HTTPS only for
  two years (HSTS; subdomains and preloading if you ask for them with
  `hsts`); `nosniff`; `X-Frame-Options: DENY`; a referrer policy that gives
  another site the origin at most; a Permissions-Policy that turns off the
  camera, microphone, location, payments, USB and ad topics; and
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
- The one exception is the viewer, and only on a site that sets `viewer`
  ([What the site says](content.md#the-viewer)). When a visitor opens a
  link in it, that page loads from its own site, in a frame, and that site
  sees the visitor as any site they open does. The policy allows frames
  from the sites `viewer` names and no other; the frame is sandboxed so it
  can't navigate the page, is sent no referrer, and is thrown away when
  the viewer closes. A viewer address must be `https://` with a plain
  domain name as its host.
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
  and a question is cut to 300 characters.
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
- **Two rules are yours to set by hand** in the Cloudflare dashboard: a
  rate limit on `/ask`, and a block on requests the site has no use for
  ([Rules at the edge](ask.md#rules-at-the-edge)).

## The code

- `npm run verify` runs on each pull request
  (`.github/workflows/check.yml`): formatting, ESLint, knip, types, the
  unit tests (after a build), the HTML, the fonts, and the browser checks,
  which are served with the real security headers. The workflow's token
  can only read the repository, and each action it uses is pinned to a
  commit.
- Dependabot opens a pull request each month for the npm packages and the
  GitHub Actions. None of the packages reaches the browser: only Astro's
  build of the site does.
- Nothing built is committed. Your host builds the site from source.
- An update trusts the template commit it prints: its code runs on
  `npm ci` and in your Actions
  ([What an update trusts](updating.md#what-an-update-trusts)).
