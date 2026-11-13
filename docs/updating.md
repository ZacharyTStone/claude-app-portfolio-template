# Taking the template's updates

A site made from the template keeps two kinds of file: its own, and the
ones it shares with the template. `npm run update-template` replaces the
shared ones with the template's latest and leaves yours alone.

```sh
npm run update-template
git status   # files it added or removed
git diff     # what it changed
npm ci
npm run verify
```

It needs git and a working tree with nothing uncommitted, and it commits
nothing: review what it did, then commit. Updates go one way only, from
the template to a site.

## What is yours, and what is shared

`SHARED` in `scripts/template.ts` is the list.

| Yours: an update never touches it | Shared: an update replaces it |
| --- | --- |
| `site.config.ts`, `wrangler.jsonc`, `README.md` | `src/` (the pages, the script, the Worker, the styles) |
| `src/styles/site.css`, your own styles | `scripts/`, `tests/`, and the guides in `docs/` |
| Your pictures in `public/assets/`, and your diagrams in `diagrams/` | The icons and bundled fonts in `public/assets/` |
| The Japanese font subsets, cut to your text | `package.json`, its lockfile, the tool configs, `AGENTS.md` |
| `tests/ask-questions.json` | `.github/workflows/check.yml`, `.github/dependabot.yml` |

Two things follow:

- **A change you make to a shared file is replaced by the next update.**
  `git diff` shows each one, to put back by hand if you still want it. A
  change every site would want belongs in the template: open a pull
  request there.
- **A file you add inside a shared folder is removed by an update**, so
  keep your own files outside `src/`, `docs/`, `public/assets/fonts/` and
  `public/assets/icons/`. The one exception is `src/styles/site.css`.

## What an update trusts

An update replaces your copy of the template's code, `package.json`
included, with whatever is on the template's main branch when you run it,
and it runs the template's `scripts/template.ts` to read the list. So an
update trusts the template's repository as installing a package trusts
its author. Before you commit, read what changed in `package.json` and in
`.github/workflows/check.yml`: those two decide what runs on your machine
at `npm ci` and in your repository's CI.

To update from a copy of the template you have looked over, give its
folder or address:

```sh
npm run update-template -- ../my-copy-of-the-template
```

## A site made before the command existed

Copy `scripts/template.ts` and `scripts/update-template.ts` from the
template, add `"update-template": "node scripts/update-template.ts"` to
the scripts in `package.json`, and run it.
