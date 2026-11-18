# The Writing tab (optional)

With `writing` in `site.config.ts`, the site has a Writing tab: your
public posts, wherever you post them, newest first, each a card that
links to the post, with the day it was posted, its likes and its tags.
It can list posts from Qiita, Zenn, DEV, note, Medium, Substack, Hatena
Blog and any other blog with an RSS or Atom feed, together in one list.
Every language's page has the same tab, in its own wording around one
list of posts, each as you wrote it, in whatever language. Without
`writing` there is no tab, nothing is fetched, and the site is as it was.
With `viewer: true` a Qiita post opens beside the conversation instead of
in a new tab, as a page of the site's own
([Reading a post on the site](#reading-a-post-on-the-site)).

The build fetches the posts, so the tab lists them as they were at the
last build. A post you write today shows once the site is built again: on
your next push, or, on Cloudflare, by itself within a day
([A rebuild each day](#a-rebuild-each-day)). The tab has a feed of its
own too, so a reader can follow everything you post in one place
([The tab's feed](#the-tabs-feed)).

The tab comes with your first post. Until then the site has no Writing
tab: no row in the sidebar, no page at `/writing/`, nothing in the
sitemap, `llms.txt` or [Ask](ask.md), and a visitor finds nothing that
leads nowhere ([Before your first post](#before-your-first-post)).

## Turning it on

1. In `site.config.ts`, name where your posts are: one place, or several.

   ```ts
   writing: { qiita: "alex-example" },
   ```

   ```ts
   writing: {
     zenn: "alex_example",
     note: "alex_example",
     feeds: [{ url: "https://blog.alex.example/rss/", name: "Alex's blog" }],
   },
   ```

   Each place is in [The places](#the-places), with what it wants.

2. A page in English has the tab's wording already. A page in any other
   language states it in its `strings`: `writingTitle` (the tab's name),
   `writingQuestion` (the visitor's question in it), `writingIntro` (the
   line over the posts), and, with Zenn or DEV, `writingLikes` (the word
   after a count of likes: "12 likes"). `examples/ja.ts` has them in
   Japanese, and the build names one that's missing.
3. `npm run build`, or `npm run dev`. The build prints how many posts it
   found, and where: "the Writing tab lists 14 posts: 9 on Qiita, 5 on
   Zenn". The tab has a page of its own at `/writing/` (`/ja/writing/` on
   a Japanese page). With none yet, it says so, and that the site has no
   Writing tab until the first.

## The places

| Field | Where | What it is | What's listed | Likes |
| --- | --- | --- | --- | --- |
| `qiita` | Qiita | Your user id: `qiita.com/alex-example` is `"alex-example"` | Every public post | Its LGTMs ("12 LGTM") |
| `zenn` | Zenn | Your user name: `zenn.dev/alex_example` is `"alex_example"` | Every article | Its likes |
| `dev` | DEV (dev.to) | Your user name: `dev.to/alex-example` is `"alex-example"` | Every published article | Its reactions |
| `note` | note | Your id: `note.com/alex_example` is `"alex_example"` | The posts in its feed, the latest | None |
| `medium` | Medium | Your user name without its "@": `medium.com/@alex-example` is `"alex-example"` | The posts in its feed, the latest ten | None |
| `substack` | Substack | Your Substack's name: `alexexample.substack.com` is `"alexexample"` | The posts in its feed, the latest twenty | None |
| `hatena` | Hatena Blog | Your blog's address, without "https://": `"alex-example.hatenablog.com"` | The posts in its feed, the latest | None |
| `feeds` | Any blog | `[{ url, name? }]`: each feed's address, RSS or Atom, and what to call it | The posts in each feed | None |

- **Qiita, Zenn and DEV** have an API that lists every post of yours, so
  the tab lists all of them. **The others** are read from the blog's own
  feed, which has only its latest posts, as many as the platform puts in
  it: an older post drops off the tab as new ones come.
- **`feeds`** takes any blog's RSS or Atom feed: Ghost, WordPress,
  Blogger, Ameba (`https://rssblog.ameba.jp/<id>/rss20.xml`), Tumblr,
  Hashnode, a site of your own. `name` is what a card calls it; left out,
  it's the feed's host (`blog.alex.example`).
- **How many**: every post, unless `latest` says how many the tab lists
  at most (`latest: 30`, the newest thirty, from every place together). A
  long list makes a long page, and Ask reads every title for every
  question ([Ask and llms.txt](#ask-and-llmstxt)), so a prolific writer
  may want one.
- **More than one place**: the posts are one list, newest first, and each
  card names where its post is ("Oct 1, 2026 · Zenn · 12 likes · Astro").
  With one place, a card doesn't name it. A post two feeds both list is
  listed once.
- **Likes**: Qiita's are its own word, "LGTM", in every language. Zenn's
  likes and DEV's reactions are counted in the page's own word,
  `writingLikes`. A feed doesn't say how many liked a post, so a card of
  one shows none.
- **The day** is yours, by the config's `timezone`: a post written late in
  the evening in Tokyo is that day's, whatever zone the place keeps its
  times in. (Qiita's times have your own offset already, and are kept as
  they are.)

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

A post's card opens the post where it was posted, in a new tab. To have a
Qiita post open beside the conversation instead (over the whole screen on
a phone), in the site's viewer, as a document does
([The viewer](content.md#the-viewer)):

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
posts it found, "each Qiita post with a page of its own for the viewer".

**Only a Qiita post has a page**, since only Qiita gives a post as you
wrote it, in Markdown. Zenn's API and every feed give a post as HTML, and
no HTML of anyone else's reaches a page of the site
([Security](security.md)). So on a site with Qiita and somewhere else, a
Qiita post opens in the viewer and any other opens where it was posted.

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

A site with `writing` and no public posts anywhere it names yet is built
without the tab, as if it had no `writing`, and the build says so. The
tab, its row, its page, its feed and its answer come with the first build
after your first post: with [a rebuild each day](#a-rebuild-each-day), by
themselves. A page someone kept from when you had posts (if you take them
all down) gets the 404 page, and a chat a visitor kept that was answered
from the tab answers "Something else", as it does for any answer the site
no longer has.

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

## The tab's feed

A site with the tab has an Atom feed of it at `/writing/feed.xml`, beside
the tab's page (`src/site/files/writing-feed.ts`), and every page's head
points at it, so a feed reader finds it from the site's address. It's
called by your name and `writingTitle` ("Alex Example: Writing"), and has
each post the tab lists, newest first: its title, a link to it where it
was posted, when, and its tags. Nothing of a post's text is in it. A
reader that follows it sees each post you write anywhere the tab lists,
from the build after you post it. Before your first post there's no feed,
as there's no tab; with `showWhenEmpty`, there's an empty one.

## What the build fetches

Before it makes any page, the build asks each place you name for your
posts, all at once. Each request has 10 seconds, and one that fails in a
way that might pass (no connection, no answer in time, the place's server
failing, too many requests at once) is tried once more, two seconds
later. None is asked with a token.

- **Qiita**: its API (`https://qiita.com/api/v2/users/<id>/items`), a
  hundred posts at a time, following the pages until one comes back
  short. Qiita answers one address about 60 times an hour without a
  token, and a build asks once for each hundred posts. A post shared by
  link only (private, on Qiita) is left out.
- **Zenn**: first the user (`https://zenn.dev/api/users/<name>`), then
  their articles (`https://zenn.dev/api/articles?username=<name>`), page
  after page. Zenn's list of articles has a trap: for a name it doesn't
  have, it doesn't say so, but lists everyone's latest. So the build asks
  for the user first, which Zenn answers with a 404 if there's no such
  one, and a list with anyone else's article in it stops the build.
- **DEV**: first the user
  (`https://dev.to/api/users/by_username?url=<name>`), since DEV lists a
  name it doesn't have as one with no articles, then their articles
  (`https://dev.to/api/articles?username=<name>`), a thousand at a time.
- **note, Medium, Substack, Hatena Blog and `feeds`**: the feed itself,
  once (`https://note.com/<id>/rss`, `https://medium.com/feed/@<name>`,
  `https://<name>.substack.com/feed`, `https://<blog>/feed`, or the
  address you gave). RSS 2.0, RSS 1.0 and Atom are read
  (`src/site/writing/feed-xml.ts`).

What comes back is checked before any of it reaches a page
(`src/site/writing/`). An answer that isn't what the place's API sends,
or a post that links anywhere but the place itself, stops the build. A
feed's post has to link to the blog (the feed's own site, the site the
feed says it's for, or a subdomain of either; a Medium post may link to
a publication's own domain, and loses the `?source=` Medium adds), and
has to have a title and a time it was posted; a feed that declares
entities of its own is refused unread. Of each post only its id, its
title, its address, when it was posted, its likes and its tags are kept.
Its text is kept only from Qiita, with `viewer: true`
([Reading a post on the site](#reading-a-post-on-the-site)), as the
Markdown you wrote: never anyone's HTML of it.

The day on a card is the day you posted it by your own clock, in the
page's language ("Oct 1, 2026" on an English page, "2026/10/01" on a
Japanese one). A title with kana in it is marked as Japanese on a page in
another language, so a browser draws its kanji in their Japanese forms.

## When a place is down

The build stops and builds nothing. It says why, and at which address:
"Qiita answered 503", "no answer in 10 seconds", "Zenn has no user by
that name", "Alex's blog's feed has a post, "…", with no link". One place
that can't be had stops it, though the others answered: a tab with one
place's posts gone would say less than it should. A host that builds from
your repo deploys nothing from a build that fails, so the site that's up
stays as it was, with the posts of its last build. That is the point: a
site whose Writing tab went empty, or missing, because a place was down
for a minute would be worse.

So nothing needs doing: the next day's rebuild tries again, and so does
a push. If a name or an address was wrong, the build said so: put it
right. To build without a place, remove it; without the tab, remove
`writing`.

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
address, day and tags (and where it was posted, on a site with more than
one place), and the tab's answer among the questions. Before your first
post there's neither, nor anything for Ask to answer from.

## Without the places, in the tests

No test reaches Qiita, Zenn, DEV or a blog. Every build the tests make
(`tests/build/astro-build.ts`) sets the environment variable
`WRITING_FIXTURE` to `tests/sample/writing.json`, a file of what each
place would answer for the sample's made-up user, keyed by place
(`qiita`, `zenn`, `dev`, each a `user` and their `posts` as the place's
API writes them; `feeds`, each feed's address and the file in
`tests/sample/feeds/` it sends), and the build asks that file in place of
the places (`src/site/writing/fixture.ts`), saying so as it starts. It
answers for those users and feeds alone: any other user gets what the
place gives a user it doesn't have, any other feed a 404, and the build
stops, so the file's posts can't stand in for a real site's. The sample
has posts on Qiita, Zenn and note, and `viewer: true`, and its first post
has every kind of Markdown a page shows and some it leaves out, so the
tests hold each post's own page too. To build the sample as the tests do:

```sh
SITE_CONFIG=tests/sample/site.config.ts WRITING_FIXTURE=tests/sample/writing.json npm run build
```

`tests/sample/writing-no-posts.json` is the same user before their first
post anywhere, and `tests/build/sample-site.test.ts` builds the sample
with it too: no Writing tab, no feed, and nothing on the site that points
at one.

The template's own `site.config.ts` has `writing` commented out, as it
has Ask: a copy starts as that file, and would otherwise ask Qiita for
someone else's posts.
