# Deploying

Nothing built is committed. Any host that can run `npm run build` and
publish `dist/` works: connect the repo, and the host builds the site from
source on every push. It needs Node 24, the version in `.node-version`.

Two fields in `site.config.ts` say where the site is going:

- `url` is the site's address. If the site is served under a path (a
  GitHub project site), put the path in it:
  `"https://you.github.io/portfolio/"`. Every link then starts with it.
- `host` is who serves it. It tells the build how the security headers
  ([Security](security.md)) reach the browser. Every page carries its
  Content-Security-Policy and referrer policy in `<meta>` tags, whatever
  the host; Cloudflare and Netlify also read a `_headers` file the build
  writes, with every header in it.
- Paths elsewhere in the config (`"/assets/og.png"`) are from the site's
  own root, wherever that is.

## Cloudflare (recommended)

The free plan covers it, `wrangler.jsonc` is the whole setup, and it is
the only host that runs [Ask](ask.md). Use an account on the free plan:
there Cloudflare refuses what it would otherwise bill, so the site can
never cost anything ([What Ask can cost](ask.md#what-ask-can-cost)).

Set `host: "cloudflare"` and give your Worker a name in `wrangler.jsonc`.
Then either connect the repo in the Cloudflare dashboard (**Workers &
Pages → Create → Import a repository**; it deploys on every push to
`main`), or deploy from your machine:

```sh
npm run deploy   # runs npm run build, then uploads dist/
```

`npm run deploy` runs one pinned version of Wrangler, Cloudflare's tool;
`npm run wrangler -- dev` serves the site locally as Cloudflare would.
With a custom domain, set `"workers_dev": false` in `wrangler.jsonc`, so
the site isn't also served at its `workers.dev` address.

## Netlify, Vercel, or any static host

| Host | `host` | Settings |
| --- | --- | --- |
| Netlify | `"netlify"` | Build command `npm run build`, publish directory `dist`. Node comes from `.node-version`. |
| Vercel | `"vercel"` | Detected as Astro: build `npm run build`, output `dist`. In the project's settings, set Node to the version in `.node-version`. |
| Anything else (S3, nginx, Caddy…) | `"static"` | Run `npm run build` and upload `dist/`. Set the headers in `src/site/security-headers.ts` on the server where you can. |

## GitHub Pages

Set `host: "github-pages"`, and `url` with the repo's path unless you use
a custom domain. In the repo's **Settings → Pages**, set the source to
**GitHub Actions**, and add a workflow:

```yaml
# .github/workflows/pages.yml
name: Pages
on:
  push:
    branches: [main]
permissions:
  contents: read
  pages: write
  id-token: write
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: github-pages
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@7b1f4a764d45c48632c6b24a0339c27f5614fb0b # v4.0.0
        with:
          path: dist
      - uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4.0.5
```
