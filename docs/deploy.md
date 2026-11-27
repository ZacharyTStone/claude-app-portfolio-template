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

## The pages

Each language's home page is a folder's `index.html`, and so is each of
its tabs' pages: `dist/index.html` and `dist/about/index.html` for the
main language, `dist/ja/index.html` and `dist/ja/about/index.html` for
another, served under the site's path if it has one. Every host here serves a folder's `index.html`
at the folder's path with its slash (`/about/`), the address the pages
link to and give as canonical. Asked for `/about`, Cloudflare, Netlify,
GitHub Pages and most static servers send the visitor on to `/about/`, and
Vercel serves the same page; the script then shows `/about/` all the same.
A path with nothing there gets the 404 page.

The build writes `_headers` for every path (`/*`), so on Cloudflare and
Netlify the tabs' pages have the same headers as the home page, and on any
host each page carries its own policy in `<meta>` tags. The build sets no
caching of its own: a host caches every page as it caches the home page.
`/ask`, which Ask's Worker answers, `/assets/` and a language's folder are
paths no tab can take (the build refuses a thread with one of those ids),
and nor is `/blog/`.

Beside the pages, the build writes `robots.txt`, `sitemap.xml`, `llms.txt`
and `/.well-known/security.txt` ([Security](security.md#securitytxt)).
The last is in a folder whose name starts with a dot. Cloudflare's and
Netlify's deploys publish that folder as any other; GitHub Pages' upload
leaves it out unless told not to, which the workflow below does; and a
server of your own may refuse paths with a dot-folder in them, as many
nginx setups do: let it serve `/.well-known/`.

## Cloudflare (recommended)

The free plan covers it, `wrangler.jsonc` is the whole setup, and it is
the only host that runs [Ask](ask.md) (the [contact form](contact-form.md)
runs here and on Netlify). Use an account on the free plan:
there Cloudflare refuses what it would otherwise bill, so the site can
never cost anything ([What Ask can cost](ask.md#what-ask-can-cost)).

Set `host: "cloudflare"` and give your Worker a name in `wrangler.jsonc`.
Then either connect the repo in the Cloudflare dashboard (**Workers &
Pages → Create → Import a repository**; it deploys on every push to
`main`), or deploy from your machine:

```sh
npm run deploy   # runs npm run build, then uploads dist/
```

With a [Writing tab](writing.md), each build fetches your posts first, and
stops if it can't: a build that fails deploys nothing, so the site that's
up stays as it was. [A rebuild each day](writing.md#a-rebuild-each-day)
brings in what you've posted since, with a deploy hook and a cron trigger.
The same goes for the panel's [activity](activity.md), whose build may
need a `GITHUB_TOKEN` for GitHub on a busy build machine.

`npm run deploy` runs one pinned version of Wrangler, Cloudflare's tool;
`npm run wrangler -- dev` serves the site locally as Cloudflare would.
With a custom domain, set `"workers_dev": false` in `wrangler.jsonc`, so
the site isn't also served at its `workers.dev` address.

On a custom domain Cloudflare can also add scripts of its own to every
page as it passes. The policy allows no script but the site's own, so
the browser refuses each one it isn't told about, logs a
Content-Security-Policy error in the console, and Lighthouse marks the
page down.

- **Web Analytics' automatic setup** adds its beacon, which measures each
  visit and the page's speed. To keep it, set `analytics: "cloudflare"`
  in `site.config.ts`: the policy then lets that one script load, from
  `static.cloudflareinsights.com`, and report to the site's own
  `/cdn-cgi/rum` ([Security](security.md)). It sets no cookie. Without
  it, Web Analytics measures nothing: turn its automatic setup to
  **Disable** (the **Web Analytics** page, **Manage site**), or set the
  field. The domain's **Analytics** tab counts visits at the edge with no
  script at all, either way.
- **Bot Fight Mode** challenges known bots before they reach the site, and
  that works whatever the policy. It also adds JavaScript Detections, an
  inline script whose content changes with every request, and that the
  policy can't let run: Cloudflare supports it only with a nonce made
  for each request in the policy's header and none in a `<meta>` tag,
  and it writes markup, which Trusted Types forbid. So with Bot Fight
  Mode on, each page logs two errors for it, and is otherwise as it
  was. It can also challenge the assistants that read `llms.txt` on
  someone's behalf. It's under **Security → Settings**, filtered by
  **Bot traffic**.

## Netlify, Vercel, or any static host

| Host | `host` | Settings |
| --- | --- | --- |
| Netlify | `"netlify"` | Build command `npm run build`, publish directory `dist`. Node comes from `.node-version`. With the contact form, turn on form detection: Netlify Forms takes its messages ([On Netlify](contact-form.md#on-netlify)). |
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
      - uses: actions/upload-pages-artifact@fc324d3547104276b827a68afc52ff2a11cc49c9 # v5.0.0
        with:
          path: dist
          # Or .well-known/security.txt is left out.
          include-hidden-files: true
      - uses: actions/deploy-pages@d6db90164ac5ed86f2b6aed7e0febac5b3c0c03e # v4.0.5
```
