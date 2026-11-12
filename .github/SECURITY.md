# Security policy

The site is static: no analytics, and a strict Content Security Policy
with Trusted Types. It loads nothing from another site, except a page its
owner lists in `viewer`, shown in a sandboxed frame once a visitor opens
it. With Ask off there is no server code at all. The optional Ask Worker
(`src/worker`, POST `/ask`) replies with the id of one of the site's own
answers and a sentence or two a model wrote from its lines, with those
lines to quote under it, within the limits in `wrangler.jsonc`. The
Worker checks the reply's names, numbers and addresses against the lines
(`src/worker/ask/grounded.ts`); its ordinary words are the model's, and
are not checked. If you find a way around any of that (markup injection
through the config, a CSP bypass, a frame from a site `viewer` doesn't
name, a header that doesn't do what `src/shared/headers.ts` says, a way to
make `/ask` name something the site doesn't, show markup or get past its
limits), please report it.

## Reporting

- **Sensitive:** use [Report a vulnerability](https://github.com/ZacharyTStone/claude-app-portfolio-template/security/advisories/new)
  (GitHub's private reporting) instead of opening a public issue.
- **Not sensitive** (a hardening idea, a header that could be stricter):
  open an issue.

Please include what you found, how to reproduce it, and the browser or
host you saw it on.

## Supported versions

Only the latest commit on `main`. A site made from an older copy takes a
fix with `npm run update-template` (see the README).
