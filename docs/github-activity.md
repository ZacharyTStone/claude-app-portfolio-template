# GitHub activity (optional)

With `activity` in `site.config.ts`, the details panel ends with a small
section, "Recent public repos": the public repos you pushed to most
recently on GitHub, up to four, each a row that links to the repo, with
the day you last pushed to it. It says that the site is kept up, without
claiming more: it reads only your public activity, and calls it that.
Without `activity` there is no section, nothing is fetched, and the site
is as it was.

The build fetches it, so the panel lists the repos as they were at the
last build. A push you make today shows once the site is built again: on
your next push to the site's repo, or, on Cloudflare, by itself within a
day ([A rebuild each day](#a-rebuild-each-day)).

## Turning it on

1. In `site.config.ts`, add your GitHub user name, as your profile's
   address has it (`https://github.com/alex-example` is `alex-example`):

   ```ts
   activity: { github: "alex-example" },
   ```

2. A page in English has the section's heading already. A page in any
   other language states it in its `strings`, as `activityTitle`.
   `examples/ja.ts` has it in Japanese, and the build names it if it's
   missing.
3. `npm run build`, or `npm run dev`. The build prints how many repos it
   found.

## What it shows, and what it doesn't

Most of an engineer's work is private, and a portfolio shouldn't suggest
that a few public repos are all of it. So the section:

- is headed "Recent public repos", and llms.txt says "Private work isn't
  shown" over its list;
- shows no counts: no commits, no streaks, nothing that reads as a measure
  of how much you work;
- lists only a push, by you, to a public repo: yours, or someone else's
  you contributed to (named with its owner, `someone/tool`, where yours
  are named alone). A star, an issue or a pull request names no repo;
- lists each repo once, at your latest push to it, the latest first, and
  no more than four;
- shows the day, never "2 days ago": the build writes the page, and a
  relative time would be wrong the day after. The day is yours, by the
  config's `timezone`, in the page's language ("Nov 12, 2026" on an
  English page, "2026/11/12" on a Japanese one).

GitHub lists only your recent events (at most 300), so a repo you last
pushed to long ago drops off by itself, and a site whose owner has pushed
nothing public lately shows no section at all, rather than an empty one.

It's in the panel, where the screen is wide enough for one (1200 pixels
and up), with JavaScript on or off, and it folds and moves like the
panel's other sections. On a phone or a narrow window the panel isn't
drawn, so neither is this: nothing a visitor needs is only here.

## What the build fetches

Before it makes any page, the build asks GitHub's REST API for your
public events
(`https://api.github.com/users/<name>/events/public?per_page=100`), and
follows its link to the next page only while the pages so far name fewer
than four repos, three pages at most. Each request has 10 seconds, and
one that fails in a way that might pass (no connection, no answer in time,
GitHub's server failing) is tried once more, two seconds later.

What comes back is checked before any of it reaches a page
(`src/site/activity/github.ts`). An answer that isn't a list of events as
GitHub's API sends one, or an event whose repo isn't an owner and a name,
stops the build. An event that isn't public is left out, though that
address sends no other kind. Of each push only its repo and when it was
made are kept: never what was pushed.

### A token, if the build needs one

Without a token, GitHub answers 60 requests an hour from one address.
A build asks once, usually, but a build machine's address can be shared
with others' builds that ask GitHub too, and then the hour's 60 can be
used up before yours asks. To ask with room to spare, give the build a
token in the environment variable `GITHUB_TOKEN`:

- a fine-grained personal access token with read-only access to public
  repositories, and no other permission, is enough, since everything it
  reads is public (GitHub's settings, **Developer settings**, **Personal
  access tokens**);
- on Cloudflare's Workers Builds, add it to the build's variables and
  secrets, in the Worker's **Settings**, **Build**, as a secret; on your
  own machine, `GITHUB_TOKEN=… npm run build`.

The build reads it only to ask GitHub, and sends it to `api.github.com`
and nowhere else. It never goes into a page, a log line or an error. With
no `GITHUB_TOKEN`, the build asks without one, as before.

## When GitHub is down, or says no

The build stops and builds nothing. It says why, and at which address:
"GitHub answered 503", "no answer in 10 seconds", "GitHub has no user by
that name". When the hour's requests are used up, it says until when, and
what to do:

```text
GitHub's limit of 60 requests an hour without a token is used up for this machine's address until 14:05 UTC: build again then, or give the build a token in GITHUB_TOKEN
```

A host that builds from your repo deploys nothing from a build that
fails, so the site that's up stays as it was, with the repos of its last
build. That is the point: a panel whose activity went missing because
GitHub was busy for a minute would be worse. So nothing needs doing: the
next day's rebuild tries again, and so does a push. If the name was
wrong, the build said so: put it right. To build without the section,
remove `activity`.

The dev server says so too, and serves on, with no section. It fetches
once, as it starts.

## A rebuild each day

On Cloudflare, the Worker can ask Workers Builds for a build once a day,
with a deploy hook and a cron trigger: [Writing](writing.md#a-rebuild-each-day)
says how. The rebuild fetches everything a build fetches, so with it the
panel shows a push within a day, whether or not the site has a Writing
tab. A daily build asks GitHub once a day, far inside its limit.

## Ask and llms.txt

[Ask](ask.md) doesn't read the section. A repo's name isn't your own
words about yourself, as an answer or a post's title is, and Ask answers
only from what you say: "Is Alex active on GitHub?" gets an answer of
yours that says so, if one does, or the "Something else" reply.

llms.txt has a section, "Recent public activity on GitHub", that says the
repos are the public ones, as of the last build, and lists each with its
address and the day (in UTC) it was last pushed to.

## Japanese fonts

A repo's name is GitHub's, in Latin letters, and the day is figures, so
the Japanese fonts need nothing for them. Each row is still marked
`data-fetched`, as a Writing tab's posts are, so `npm run fonts` doesn't
cut for what changes from one build to the next
([Writing](writing.md#japanese-fonts)). The heading is your wording, and
is cut for as the rest is.

## Without GitHub, in the tests

No test reaches GitHub. Every build the tests make
(`tests/build/astro-build.ts`) sets the environment variable
`ACTIVITY_FIXTURE` to `tests/sample/github.json`, a file of what GitHub's
API would answer for the sample's made-up user, and the build asks that
file in place of GitHub (`src/site/activity/fixture.ts`), saying so as it
starts. It answers for that user alone: any other name gets the 404
GitHub gives a name it doesn't have, and the build stops, so the file's
repos can't stand in for a real site's. To build the sample as the tests
do:

```sh
SITE_CONFIG=tests/sample/site.config.ts WRITING_FIXTURE=tests/sample/qiita.json ACTIVITY_FIXTURE=tests/sample/github.json npm run build
```

The template's own `site.config.ts` has `activity` commented out, as it
has `writing`: a copy starts as that file, and would otherwise list
someone else's repos.
