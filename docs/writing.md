# The Writing tab (optional)

With `writing` in `site.config.ts`, the site has a Writing tab: your
public posts on Qiita, newest first, each a card that links to the post,
with the day it was posted, its LGTMs and its tags. Every language's page
has the same tab, in its own wording around one list of posts, each as you
wrote it, in whatever language. Without `writing` there is no tab, nothing
is fetched, and the site is as it was.

The build fetches the posts, so the tab lists them as they were at the
last build. A post you write today shows once the site is built again: on
your next push, or, on Cloudflare, by itself within a day
([A rebuild each day](#a-rebuild-each-day)).

## Turning it on

1. In `site.config.ts`, add your Qiita user id, as your profile's address
   has it (`qiita.com/alex-example` is `alex-example`):

   ```ts
   writing: { qiita: "alex-example" },
   ```

2. A page in English has the tab's wording already. A page in any other
   language states it in its `strings`: `writingTitle` (the tab's name),
   `writingQuestion` (the visitor's question in it), `writingIntro` (the
   line over the posts) and `writingEmpty` (what it says with none).
   `examples/ja.ts` has them in Japanese, and the build names one that's
   missing.
3. `npm run build`, or `npm run dev`. The build prints how many posts it
   found, and the tab has a page of its own at `/writing/` (`/ja/writing/`
   on a Japanese page).

## Where it is

- Its row in the sidebar comes last of the rows at the top, with a pen for
  its icon and `writingTitle` for its name. To put it somewhere else, give
  it a row of your own, in `sidebar.nav` or in a group, with
  `tab: "writing"`: the build then adds none.
- Anything that opens a thread can open it: a topic in the question card,
  a step in the panel, a link in an answer (`[what I write](#writing)`). A
  home prompt can name its answer, `writing.1`.
- `writing` is its id, so a thread of yours can't have that one too: the
  build stops and says so.

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
out. Of each post only its title, its address, when it was posted, its
LGTMs and its tags are kept: never its body.

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

The dev server says so too, and serves on, with the tab saying there are
no posts. It fetches once, as it starts: start it again to see a post
you've just written.

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
A page in another language shows a Japanese title in the system's font
too. The tab's own wording is yours, and is cut for as the rest is.

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
address, day and tags, and the tab's answer among the questions.

## Without Qiita, in the tests

No test reaches Qiita. Every build the tests make
(`tests/build/astro-build.ts`) sets the environment variable
`WRITING_FIXTURE` to `tests/sample/qiita.json`, a file of what Qiita's API
would answer for the sample's made-up user, and the build asks that file
in place of Qiita (`src/site/writing/fixture.ts`), saying so as it starts.
It answers for that user alone: any other id gets the 404 Qiita gives an
id it doesn't have, and the build stops, so the file's posts can't stand
in for a real site's. To build the sample as the tests do:

```sh
SITE_CONFIG=tests/sample/site.config.ts WRITING_FIXTURE=tests/sample/qiita.json npm run build
```

The template's own `site.config.ts` has `writing` commented out, as it
has Ask: a copy starts as that file, and would otherwise ask Qiita for
someone else's posts.
