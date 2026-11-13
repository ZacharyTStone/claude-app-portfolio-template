# Deploying

Nothing built is committed. Any host that can run `npm run build` and
publish `dist/` works: connect the repo, and the host builds the site from
source on every push. It needs the Node version in `.node-version`.

Two fields in `site.config.ts` say where the site is going:

- `url` is the site's address. If the site is served under a path (a
  GitHub project site), put the path in it:
  `"https://you.github.io/portfolio/"`. Every link then starts with it.
- `host` is who serves it. It tells the build how the security headers
  ([Security](security.md)) reach the browser: Cloudflare and Netlify read
  a `_headers` file the build writes; on any other host, each page carries
  its Content-Security-Policy and referrer policy in `<meta>` tags.

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
npx wrangler deploy   # runs npm run build, then uploads dist/
```

`npx wrangler dev` serves it locally as Cloudflare would.

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
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version-file: .node-version
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
      - uses: actions/deploy-pages@v4
```
