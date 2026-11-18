# Activity (optional)

With `activity` in `site.config.ts`, the details panel ends with a small
section, "Recent public repos": the public repos you pushed to most
recently on GitHub, GitLab or Codeberg, up to four, each a row that links
to the repo, with the day you last pushed to it. It says that the site is
kept up, without claiming more: it reads only your public activity, and
calls it that. Without `activity` there is no section, nothing is fetched,
and the site is as it was.

The build fetches it, so the panel lists the repos as they were at the
last build. A push you make today shows once the site is built again: on
your next push to the site's repo, or, on Cloudflare, by itself within a
day ([A rebuild each day](#a-rebuild-each-day)).

## Turning it on

1. In `site.config.ts`, add your user name on each place you push to, as
   your profile's address has it (`https://github.com/alex-example` is
   `alex-example`). One is enough:

   ```ts
   activity: { github: "alex-example" },
   ```

   Any of the three, or all of them, each with your name there:

   ```ts
   activity: { github: "alex-example", gitlab: "alex-example", codeberg: "alexe" },
   ```

   GitLab is gitlab.com, and Codeberg is codeberg.org: a GitLab or a
   Forgejo of your own isn't asked. An `activity` that names none of the
   three stops the build, and says so.

2. A page in English has the section's heading already. A page in any
   other language states it in its `strings`, as `activityTitle`.
   `examples/ja.ts` has it in Japanese, and the build names it if it's
   missing.
3. `npm run build`, or `npm run dev`. The build prints how many repos it
   found, and whose, where.

## What it shows, and what it doesn't

Most of an engineer's work is private, and a portfolio shouldn't suggest
that a few public repos are all of it. So the section:

- is headed "Recent public repos", and llms.txt says "Private work isn't
  shown" over its list;
- shows no counts: no commits, no streaks, nothing that reads as a measure
  of how much you work;
- lists only a push, by you, to a public repo: yours, or someone else's
  you contributed to (named with its owner, `someone/tool`, where yours
  are named alone; a GitLab project in a subgroup is named by its whole
  path, `a-group/a-subgroup/tool`). A star, an issue, a pull or merge
  request, or a push that only deletes a branch names no repo;
- lists each repo once, at your latest push to it, the latest first, and
  no more than four of all the places together: four on GitHub, or two on
  GitLab and two on Codeberg, as your pushes fell. A repo you keep on two
  places, as a mirror, is a repo on each: each row links to the one it
  names, on its own place, and nowhere else;
- with more than one place in `activity`, says on each row which it's on,
  before the day: "GitLab · Nov 12, 2026". Every row says it, even when
  the four latest are on one place, so the rows read the same from one
  build to the next. With one place, a row has the day alone;
- shows the day, never "2 days ago": the build writes the page, and a
  relative time would be wrong the day after. The day is yours, by the
  config's `timezone`, in the page's language ("Nov 12, 2026" on an
  English page, "2026/11/12" on a Japanese one).

Each place lists only your recent activity (GitHub, your last 300 events
at most), and the build reads no more than three pages of it, so a repo
you last pushed to long ago drops off by itself, and a site whose owner
has pushed nothing public lately shows no section at all, rather than an
empty one.

It's in the panel, where the screen is wide enough for one (1200 pixels
and up), with JavaScript on or off, and it folds and moves like the
panel's other sections. On a phone or a narrow window the panel isn't
drawn, so neither is this: nothing a visitor needs is only here.

## What the build fetches

Before it makes any page, the build asks each place `activity` names, all
at once:

- **GitHub**: your public events
  (`https://api.github.com/users/<name>/events/public?per_page=100`). A
  push names its repo, and says whether it's public.
- **GitLab**: your user's number, by your name
  (`https://gitlab.com/api/v4/users?username=<name>`), then your pushes
  (`https://gitlab.com/api/v4/users/<number>/events?action=pushed&per_page=100`).
  A push names its project by number alone, so the build then asks for
  each project the panel lists (`https://gitlab.com/api/v4/projects/<number>`),
  four at most, and another only for one that isn't public: GitLab
  answers 404 for a project it shows no one but its members, and says of
  any other whether it's public.
- **Codeberg**: what you did yourself, as Forgejo's API, which is
  Codeberg's, lists it
  (`https://codeberg.org/api/v1/users/<name>/activities/feeds?only-performed-by=true&limit=50`).
  A push of commits or of a tag counts; a mirror's sync is the mirror's
  doing, not yours, and doesn't.

Each follows to the next page only while the pages so far name fewer than
four repos, three pages at most. Each request has 10 seconds, and one
that fails in a way that might pass (no connection, no answer in time,
the place's server failing) is tried once more, two seconds later.

What comes back is checked before any of it reaches a page
(`src/site/activity/`, a file for each place). An answer that isn't what
the place's API sends, or a push whose repo isn't a path on that place,
stops the build. A push to a repo that isn't public is left out, though
none of these addresses sends one to a build that asks without signing
in. Of each push only its repo and when it was made are kept: never what
was pushed.

GitLab and Codeberg are asked without a token, and answer one address far
more often than a build asks. What they show anyone is all the panel
reads.

### A token for GitHub, if the build needs one

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
and nowhere else: not to GitLab, not to Codeberg. It never goes into a
page, a log line or an error. With no `GITHUB_TOKEN`, the build asks
without one, as before.

## When a place is down, or says no

The build stops and builds nothing. It says why, and at which address:
"GitHub answered 503", "no answer in 10 seconds", "GitLab has no user by
that name", "Codeberg has no user by that name". When GitHub's hour of
requests is used up, it says until when, and what to do:

```text
GitHub's limit of 60 requests an hour without a token is used up for this machine's address until 14:05 UTC: build again then, or give the build a token in GITHUB_TOKEN
```

One place of several that can't be read stops the build all the same:
the others' repos alone would be listed as your latest, which they
aren't. When more than one fails, the build names the first of them in
the order `github`, `gitlab`, `codeberg`.

A host that builds from your repo deploys nothing from a build that
fails, so the site that's up stays as it was, with the repos of its last
build. That is the point: a panel whose activity went missing because a
place was busy for a minute would be worse. So nothing needs doing: the
next day's rebuild tries again, and so does a push. If a name was wrong,
the build said so: put it right. To build without a place, remove its
name from `activity`; to build without the section, remove `activity`.

The dev server says so too, and serves on, with no section. It fetches
once, as it starts.

## A rebuild each day

On Cloudflare, the Worker can ask Workers Builds for a build once a day,
with a deploy hook and a cron trigger: [Writing](writing.md#a-rebuild-each-day)
says how. The rebuild fetches everything a build fetches, so with it the
panel shows a push within a day, whether or not the site has a Writing
tab. A daily build asks each place once a day, far inside any limit.

## Ask and llms.txt

[Ask](ask.md) doesn't read the section. A repo's name isn't your own
words about yourself, as an answer or a post's title is, and Ask answers
only from what you say: "Is Alex active on GitHub?" gets an answer of
yours that says so, if one does, or the "Something else" reply.

llms.txt has a section, "Recent public activity on GitHub" (or "on GitHub
and Codeberg", naming each place `activity` names), that says the repos
are the public ones, as of the last build, and lists each with its
address and the day (in UTC) it was last pushed to.

## Japanese fonts

A repo's name is its place's, in Latin letters, the place's name is too,
and the day is figures, so the Japanese fonts need nothing for them. Each
row is still marked `data-fetched`, as a Writing tab's posts are, so
`npm run fonts` doesn't cut for what changes from one build to the next
([Writing](writing.md#japanese-fonts)). The heading is your wording, and
is cut for as the rest is.

## Without GitHub, GitLab or Codeberg, in the tests

No test reaches any of them. Every build the tests make
(`tests/build/astro-build.ts`) sets the environment variable
`ACTIVITY_FIXTURE` to `tests/sample/activity.json`, a file of what each
place's API would answer for the sample's made-up users, under the
place's name in `activity`:

```json
{
  "github": { "user": "…", "events": […] },
  "gitlab": { "user": { "id": …, "username": "…" }, "events": […], "projects": […] },
  "codeberg": { "user": "…", "activities": […] }
}
```

The build asks that file in place of each, taking a request to the place
its address is on (`src/site/activity/fixture.ts`), and says so as it
starts. It answers for those users alone: any other name gets what its
place sends for a name it doesn't have (GitHub's 404, GitLab's empty
list, Codeberg's 404), and so does a place the file has nothing for. The
build stops, so the file's repos can't stand in for a real site's. The
sample names all three places, with another name on Codeberg, so the
tests hold a panel of rows from each. To build the sample as the tests
do:

```sh
SITE_CONFIG=tests/sample/site.config.ts WRITING_FIXTURE=tests/sample/qiita.json ACTIVITY_FIXTURE=tests/sample/activity.json npm run build
```

The template's own `site.config.ts` has `activity` commented out, as it
has `writing`: a copy starts as that file, and would otherwise list
someone else's repos.
