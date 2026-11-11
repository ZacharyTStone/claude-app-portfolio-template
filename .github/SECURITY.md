# Security policy

The site is static: no analytics, no third-party requests, and a strict
Content Security Policy with Trusted Types. With Ask off there is no server
code at all. The optional Ask Worker (`src/worker`, POST `/ask`) replies
only with the id of one of the site's own answers and sentences quoted
from it, within the limits in `wrangler.jsonc`. If you find a way around
any of that (markup injection through the config, a CSP bypass, a header
that doesn't do what `src/shared/headers.ts` says, a way to make `/ask` say
anything else or get past its limits), please report it.

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
