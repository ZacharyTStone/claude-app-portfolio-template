# Security policy

The site is static: no analytics, and a strict Content Security Policy
with Trusted Types. It loads nothing from another site, except a page its
owner lists in `viewer`, shown in a sandboxed frame once a visitor opens
it. With Ask off there is no server code at all. The optional Ask Worker
(`src/worker/`, POST `/ask`) replies with the id of one of the site's own
answers and a sentence or two a model wrote from its lines, with those
lines to quote under it, within the limits in `wrangler.jsonc`. The
Worker checks the reply's names, numbers and addresses against the lines
(`src/worker/ask/checks/grounded.ts`); its ordinary words are the
model's, and are not checked. [Security](../docs/security.md) has each protection.

If you find a way around any of that (markup injection through the
config, a CSP bypass, a frame from a site `viewer` doesn't name, a header
that doesn't do what `src/site/security-headers.ts` says, a way to make
`/ask` name something the site doesn't, show markup or get past its
limits), please report it.

## What an update trusts

Every site made from this template takes its code from this repository's
main branch, with `npm run update-template`. An update replaces the site's
shared files (the `shared` list in `scripts/shared-files.json`),
`package.json` and the CI workflow among them. It reads that list as data
and runs none of this repository's code, but an update trusts the template
commit it prints: its code runs on `npm ci` and in your Actions. Updates
go one way, from the template to each site. So every site that updates
trusts this repository's main branch, and these are in scope too:

- a way to get a change onto main without review;
- a way to make an update write or delete a file outside the shared list,
  or run code before the site's owner has seen what changed;
- a package or a GitHub Action the template uses that isn't what it claims
  to be.

The checks (`.github/workflows/check.yml`) run on pull requests with a
token that can only read the repository, and with no secret in reach.

## Reporting

- **Sensitive:** use [Report a vulnerability](https://github.com/ZacharyTStone/claude-app-portfolio-template/security/advisories/new)
  (GitHub's private reporting) instead of opening a public issue.
- **Not sensitive** (a hardening idea, a header that could be stricter):
  open an issue.

Please include what you found, how to reproduce it, and the browser or
host you saw it on.

## Supported versions

Only the latest commit on `main`. A site made from an older copy takes a
fix with `npm run update-template` ([Updating](../docs/updating.md)).
