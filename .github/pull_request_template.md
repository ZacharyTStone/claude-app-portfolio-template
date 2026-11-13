## What this changes

<!-- A sentence or two. Link an issue if there is one. -->

## Checklist

- [ ] `npm run verify` passes (it's what CI runs; see AGENTS.md)
- [ ] If this changes what a guide in `docs/` or AGENTS.md describes, the guide says the new thing
- [ ] If I changed Japanese text: ran `npm run build`, `npm run fonts`, and committed the fonts
- [ ] Nothing inline and no HTML from strings (the CSP and Trusted Types depend on it)
- [ ] Still works with JavaScript off, and on a phone
- [ ] No real personal data in the sample, and none in the shared code (`SHARED` in `scripts/template.ts`)
