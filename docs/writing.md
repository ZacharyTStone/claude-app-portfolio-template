# The Writing tab (optional)

With `writing` in `site.config.ts`, the site has a Writing tab: your
public posts on Qiita, newest first, each a card that links to the post,
with the day it was posted, its LGTMs and its tags. Every language's page
has the same tab, in its own wording around one list of posts, each as you
wrote it, in whatever language. Without `writing` there is no tab, nothing
is fetched, and the site is as it was. With `viewer: true` a post opens
beside the conversation instead of in a new tab, as a page of the site's
own ([Reading a post on the site](#reading-a-post-on-the-site)).

The build fetches the posts, so the tab lists them as they were at the
last build. A post you write today shows once the site is built again: on
your next push, or, on Cloudflare, by itself within a day
([A rebuild each day](#a-rebuild-each-day)).

The tab comes with your first post. Until then the site has no Writing
tab: no row in the sidebar, no page at `/writing/`, nothing in the
sitemap, `llms.txt` or [Ask](ask.md), and a visitor finds nothing that
leads nowhere ([Before your first post](#before-your-first-post)).

## Turning it on

1. In `site.config.ts`, add your Qiita user id, as your profile's address
   has it (`qiita.com/alex-example` is `alex-example`):

   ```ts
   writing: { qiita: "alex-example" },
   ```

2. A page in English has the tab's wording already. A page in any other
   language states it in its `strings`: `writingTitle` (the tab's name),
   `writingQuestion` (the visitor's question in it) and `writingIntro` (the
   line over the posts). `examples/ja.ts` has them in Japanese, and the
   build names one that's missing.
3. `npm run build`, or `npm run dev`. The build prints how many posts it
   found, and the tab has a page of its own at `/writing/` (`/ja/writing/`
   on a Japanese page). With none yet, it says so, and that the site has
   no Writing tab until the first.

## Where it is

- Its row in the sidebar comes last of the rows at the top, with a pen for
  its icon and `writingTitle` for its name. To put it somewhere else, give
  it a row of your own, in `sidebar.nav` or in a group, with
  `tab: "writing"`: the build then adds none.
- Anything that opens a thread can open it: a topic in the question card,
  a step in the panel, a link in an answer (`[what I write](#writing)`). A
  home prompt can name its answer, `writing.1`. Each of these needs the
  tab to be there before your first post too, so it needs `showWhenEmpty`
  ([Before your first post](#before-your-first-post)): without it, the
  build stops and says so, as it does for a link to a thread you don't
  have.
- `writing` is its id, so a thread of yours can't have that one too: the
  build stops and says so.

## Reading a post on the site

A post's card opens the post on Qiita, in a new tab. To have it open
beside the conversation instead (over the whole screen on a phone), in the
site's viewer, as a document does ([The viewer](content.md#the-viewer)):

```ts
writing: { qiita: "alex-example", viewer: true },
```

Qiita lets no other site show its pages in a frame, so the viewer can't
show the post itself. The build keeps each post's text instead, as you
wrote it, and makes a page of the site's own of it, at
`/writing/<the post's id>/`: its title, the day you posted it, a link to
the post on Qiita, then its text. The viewer shows that page in its frame,
and its "Open in a new tab" goes to the post on Qiita, as the card itself
does with JavaScript off or a modifier key held. The build says how many
posts it found, "each with a page of its own for the viewer".

- **It's one page for every language**: it has your words, and none of
  the site's. It's marked as Japanese if it has kana in it, and as the
  main language's otherwise.
- **Its text is read from your Markdown, never as HTML**
  (`src/site/writing/body.ts`). It shows headings, paragraphs and the line
  breaks in them, lists, boxes to tick, code under its file's name,
  quotes, Qiita's notes (`:::note`), tables, rules, footnotes, bold,
  italics, struck-out words and links to web addresses. HTML in a post is
  left out, but for a picture written as `<img>`. A link to anything but
  a web address is just its words. Mathematics and an embedded card show
  as the text you typed.
- **A picture is a link to it**, called by its description, since the
  pages load nothing from another site: it opens in a new tab. A post
  that leans on its pictures reads better on Qiita, one click away.
- **It names the post on Qiita as its canonical address**, so a search
  engine takes the one on Qiita for the original, and it's in neither the
  sitemap nor llms.txt.
- **It's as the post was at the last build**, as the tab is: an edit on
  Qiita shows once the site is built again.
- **Each language needs the viewer's two strings**, `viewerOpen` and
  `viewerClose`. English has them, and the build names one that's missing.
- **It changes what the site's policy allows**: the pages may show the
  site's own pages in a frame, and be shown in one by the site itself and
  by no other ([Security](security.md)). If your site says nothing can
  show its pages in a frame, make that sentence true again.

Ask and llms.txt read a post's title, as they do without `viewer`, and
nothing of its text.

## Before your first post

A site with `writing` and no public posts on Qiita yet is built without
the tab, as if it had no `writing`, and the build says so. The tab, its
row, its page and its answer come with the first build after your first
post: with [a rebuild each day](#a-rebuild-each-day), by themselves. A
page someone kept from
when you had posts (if you take them all down) gets the 404 page, and a
chat a visitor kept that was answered from the tab answers "Something
else", as it does for any answer the site no longer has.

To have the tab there before the first post, saying so, set
`showWhenEmpty`:

```ts
writing: { qiita: "alex-example", showWhenEmpty: true },
```

It then says `writingEmpty` ("Nothing posted yet."), which a page in a
language other than English states in its `strings` too. It's what lets
the rest of the config open the tab ([Where it is](#where-it-is)), since
the config's checks can't know whether you'll have posts at the next
build, and nothing of yours should lead to a tab that isn't there.

## What the build fetches

Before it makes any page, the build asks Qiita's API for your posts
(`https://qiita.com/api/v2/users/<id>/items`), a hundred at a time,
following the pages until one comes back short. It asks with no token:
Qiita answers one address about 60 times an hour that way, and a build
asks once for each hundred posts. Each request has 10 seconds, and one
that fails in a way that might pass (no connection, no answer in time,
Qiita's server failing, too many requests at once) is tried once more,
two seconds later.

What comes back is checked before any of it reaches a page
(`src/site/writing/qiita.ts`). An answer that isn't a list of posts as
Qiita's API sends one, or a post that links anywhere but `qiita.com`,
stops the build. A post shared by link only (private, on Qiita) is left
out. Of each post only its id, its title, its address, when it was posted,
its LGTMs and its tags are kept. Its text is kept only with `viewer: true`
([Reading a post on the site](#reading-a-post-on-the-site)), as the
Markdown you wrote: never Qiita's own HTML of it.

The day on a card is the day you posted it by your own clock, in the
page's language ("Oct 1, 2026" on an English page, "2026/10/01" on a
Japanese one). A title with kana in it is marked as Japanese on a page in
another language, so a browser draws its kanji in their Japanese forms.

## When Qiita is down

The build stops and builds nothing. It says why, and at which address:
"Qiita answered 503", "no answer in 10 seconds", "Qiita has no user by
that id". A host that builds from your repo deploys nothing from a build
that fails, so the site that's up stays as it was, with the posts of its
last build. That is the point: a site whose Writing tab went empty, or
missing, because Qiita was down for a minute would be worse.

So nothing needs doing: the next day's rebuild tries again, and so does
a push. If the id was wrong, the build said so: put it right. To build
without the tab, remove `writing`.

The dev server says so too, and serves on, as it would with no posts:
without the tab, or with it empty if you set `showWhenEmpty`. It fetches
once, as it starts: start it again to see a post you've just written.

## A rebuild each day

On Cloudflare, with the repo connected to Workers Builds
([Deploying](deploy.md#cloudflare-recommended)), the Worker can ask for a
build once a day by itself, so a new post shows within a day without a
push:

1. **Make a deploy hook.** In the Cloudflare dashboard: **Workers &
   Pages**, your Worker, **Settings**, **Builds**, **Deploy Hooks**. Name
   it ("Daily rebuild"), choose the branch `main`, select **Create**, and
   copy its address.
2. **Give it to the Worker as a secret.** It's a credential: anyone with
   the address can start a build, so it never goes in the repo. Run this
   and paste the address when asked:

   ```sh
   npm run wrangler -- secret put DEPLOY_HOOK_URL
   ```

3. **Turn on the trigger.** In `wrangler.jsonc`, uncomment the line in
   "The daily rebuild":

   ```jsonc
   "triggers": { "crons": ["17 21 * * *"] },
   ```

   That's 21:17 UTC every day; any time of day works (minute, hour, then
   `* * *` for every day). The trigger runs the Worker's script
   (`src/worker/rebuild.ts`), so the script has to be there: with Ask on,
   it is. With Ask off, also uncomment the Ask block's line with `"main"`
   in it, and the line with `"binding": "ASSETS"` in `"assets"`.
4. **Push.** The deploy sets the trigger up.

Each day the Worker POSTs to the hook, and Workers Builds builds the site
and deploys it, as a push would. The Worker logs one line under its
Observability tab: `{"rebuild":"started","status":200}`; or `"refused"`
with the status Workers Builds answered (a hook that has been deleted);
or `"error"` with the kind of error (`"TimeoutError"`). It never logs the
hook's address, or an error's message, which could have the address in
it. With no `DEPLOY_HOOK_URL` the trigger does nothing, and logs nothing.

On the Workers Free plan a daily build is well inside Workers Builds'
3,000 build minutes a month, and an account has five cron triggers. To
stop the rebuilds, comment the trigger out again and deploy, or delete the
hook in the dashboard.

On another host, the same is a job that POSTs to the host's own build
hook once a day (Netlify's build hooks, Vercel's deploy hooks), or a
scheduled GitHub Actions workflow that builds and deploys.

## Japanese fonts

The Japanese fonts are cut to the characters the Japanese page uses
([Languages and fonts](languages.md#japanese-fonts)). The posts change
from one build to the next, and a font cut for today's titles would be
out of date at tomorrow's build, so `npm run fonts` doesn't cut for them
and `npm run fonts:check` doesn't ask for them: each post's card is marked
`data-fetched`, and `scripts/fonts/characters.ts` leaves out what's in
those. The stylesheet sets them in the system's Japanese font instead
(`src/styles/japanese.css`), which every system that shows Japanese has.
A post's own page is all fetched text, so the whole of it is marked and
set the same way.
A page in another language shows a Japanese title in the system's font
too. The tab's own wording is yours, and is cut for as the rest is, even
before your first post, while the page doesn't show it: `npm run fonts`
takes it from the config, and `npm run fonts:check` asks for it, so the
build that brings the tab, a daily rebuild with no one at hand perhaps,
needn't cut the fonts again.

## Ask and llms.txt

[Ask](ask.md) reads the tab as one answer, `writing.1`: the line over the
posts, then each post's title as a line of its own. A title is your own
words, so Ask may quote it as it quotes your sentences, where any other
link card is only a label it reads. "Does Alex write?" or "What has Alex
written about?" gets a reply written from the titles, with the ones it was
written from quoted under it. Every title is read for every question, so
many posts make each question cost more
([What Ask can cost](ask.md#what-ask-can-cost)).

llms.txt has a Writing section listing each post by its title, with its
address, day and tags, and the tab's answer among the questions. Before
your first post there's neither, nor anything for Ask to answer from.

## Without Qiita, in the tests

No test reaches Qiita. Every build the tests make
(`tests/build/astro-build.ts`) sets the environment variable
`WRITING_FIXTURE` to `tests/sample/qiita.json`, a file of what Qiita's API
would answer for the sample's made-up user, and the build asks that file
in place of Qiita (`src/site/writing/fixture.ts`), saying so as it starts.
It answers for that user alone: any other id gets the 404 Qiita gives an
id it doesn't have, and the build stops, so the file's posts can't stand
in for a real site's. The sample has `viewer: true`, and its first post
has every kind of Markdown a page shows and some it leaves out, so the
tests hold each post's own page too. To build the sample as the tests do:

```sh
SITE_CONFIG=tests/sample/site.config.ts WRITING_FIXTURE=tests/sample/qiita.json npm run build
```

`tests/sample/qiita-no-posts.json` is the same user before their first
post, and `tests/build/sample-site.test.ts` builds the sample with it too:
no Writing tab, and nothing on the site that points at one.

The template's own `site.config.ts` has `writing` commented out, as it
has Ask: a copy starts as that file, and would otherwise ask Qiita for
someone else's posts.
