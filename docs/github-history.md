# GitHub history (optional)

With `githubHistory` in `site.config.ts`, the build fetches your whole
history of contributions on GitHub, and an answer can show it in four
parts: the totals, a calendar of every week, the languages you write in,
and the days of the week you work on. Each part is a block of its own,
which you place where it fits the conversation: the calendar under "what
have you been building?", the languages under your stack. Unlike the
panel's quiet [activity](activity.md), it shows numbers, so
it says what they are and what they leave out. Without `githubHistory`
nothing is fetched, and the site is as it was.

The build fetches it, so the parts show your history as it was at the
last build. On Cloudflare a build each day keeps it a day old at most
([A rebuild each day](#a-rebuild-each-day)).

## Turning it on

1. Make a token, and give it to the build in the environment variable
   `GITHUB_TOKEN` ([A token](#a-token)). GitHub's GraphQL API, which the
   history comes from, answers nothing without one.
2. In `site.config.ts`, add your GitHub user name, as your profile's
   address has it (`https://github.com/alex-example` is `alex-example`),
   and, if you like, the moments to mark on the calendar
   ([Marks](#marks)):

   ```ts
   githubHistory: {
     user: "alex-example",
     marks: [
       { at: "2022-04", label: "Rapptr Labs" },
       { at: "2025-01", label: "Sellfire" },
     ],
   },
   ```

3. Put the parts in your answers, each where it belongs, with your own
   words around them:

   ```ts
   a: [
     "Most of Alex's work is in private repos for clients, but GitHub counts it:",
     { github: "stats" },
     { github: "calendar" },
     "Day to day it's TypeScript:",
     { github: "languages" },
   ],
   ```

4. A page in English has the parts' wording already. A page in any other
   language states it in its `strings`, as the `history…` strings
   (`examples/ja.ts` has them in Japanese), and the build names any that
   are missing. Numbers, days, months and the days of the week are the
   page's language's own, from the browser's platform: no string says
   them.
5. `npm run build`, or `npm run dev`. The build prints whose history it
   fetched, how much it comes to, and the day it runs to.

A `github` block on a site without `githubHistory` is a problem the build
names, as a link to a thread that isn't there is.

## The parts

**`{ github: "stats" }`**: a row of tiles, each a label over a number set
large in the serif. Every contribution GitHub counts; the year the
history starts; the longest streak, the most days in a row with a
contribution on each, with its first day and its last; and the busiest
day, its count and its date. When GitHub counts private work, a note
under the tiles says how much of the count it is ([Private
work](#private-work)). On a phone the tiles are two by two.

**`{ github: "calendar" }`**: every week of your history, a row a year,
oldest at the top. A row is 52 weeks from January 1, the last taking the
year's last day or two as well, so a column is the same week in every
year and the years compare cell for cell. Each week is a rounded square
shaded in five steps of the site's own accent (`--heat-0` to `--heat-4`
in `src/styles/tokens.css`, made from `--accent`, so a site's own colour
shades it too): no contributions, then the four quarters of all your busy
weeks across the whole history, so a quiet year looks quiet beside a busy
one. Weeks before your account was made (or before your first
contribution, if a commit is dated earlier), or after the day of the
build, are left empty. The year is at the left and its total at the
right, and your marks sit at their weeks. A key, "Less" to "More", is under it. The
cells shrink to fit a phone, and narrow to slivers there, so the page
never scrolls sideways. Hovering a week shows its days and its count.

Scrolled to, the calendar's rows come in one after another, each swept
in from the left, and each year's total once its row has. Without
JavaScript, or for a visitor who has asked for less motion, it's simply
there, whole, as it is printed.

**`{ github: "languages" }`**: the share of the code in each language
across your own public repos, as the site's other bars are drawn: the
five you write most, the first in the accent, and the rest together as
"Other".

**`{ github: "rhythm" }`**: the share of your contributions made on each
day of the week, a bar a day, in the order the page's language has its
week (from Sunday in English and Japanese, from Monday in French), with
the busiest in the accent.

## What it shows, and what it doesn't

The counts are GitHub's. A contribution is what GitHub counts as one: a
commit to a repo's default branch, an issue or a pull request opened, a
review. The page doesn't recount them, and calls them contributions, not
work done.

### Private work

Most of an engineer's work is private, so a public history alone would
make it look like little. GitHub counts private work only if you turn on
**Include private contributions on my profile** (on your profile, under
the contribution graph, **Contribution settings**). Then the counts and
the calendar include it, and the stats say how much of the count it is:
"Includes 1,099 contributions to private repos, in every count and in the
calendar. The repos stay private." The page never
says which repos they were, or what was done: GitHub doesn't say either.
With the setting off, everything is public work only, there's no note,
and a quiet stretch on the calendar may be a busy stretch in private:
say so in your answer's words if it matters.

### What else it leaves out

- **No current streak, and no "today".** The page is built once and read
  for days after, when a streak it called current may be over. The
  longest streak has its dates, and stays true.
- **The languages are your own public repos' only.** Forks, private
  repos and others' repos you contributed to are left out, and a share is
  of bytes of code, not of time.
- **The days are GitHub's**, which counts a contribution on its day in
  UTC, and the page writes them as such wherever it's read.
- **Nothing is a ranking**: no followers, no stars, no comparison with
  anyone.

## Marks

A mark names a moment on the calendar: where a job or a project began.
`at` is its month, `"YYYY-MM"`, and `label` its name, the same in every
language. It's drawn as a thin tick at the week its month starts in,
with its name beside it, to the right of the tick in the first half of
the row and to the left in the second, so it stays in the row. A row
with a mark has room over it for the name. One or two a year read best;
two in the same few weeks overlap.

The build checks that a mark's month is a month, and its label not
empty, before it fetches anything; once it has the history, that the
mark is in one of its years. A mark in no year of it stops the build,
and says which:

```text
githubHistory.marks has "Rapptr Labs" at 2012-04, but alex-example's history on GitHub runs from 2019 to 2026: a mark goes in one of its years
```

The dev server says so and serves on, with the calendar leaving that mark
out.

## What the build fetches

Before it makes any page, the build asks GitHub's GraphQL API
(`https://api.github.com/graphql`) two kinds of query
(`src/site/history/queries.ts`):

- the user's `createdAt`, the years with a contribution
  (`contributionsCollection { contributionYears }`), and the languages of
  their own public repos that aren't forks
  (`repositories(ownerAffiliations: OWNER, privacy: PUBLIC, isFork: false)`),
  each repo's ten largest by size, a hundred repos a page;
- each year's calendar, from the first year with a contribution to the
  last: a `contributionsCollection` per year, from January 1 to the
  year's last second (or to the moment of the build, this year), since
  the API gives a year at most of each, four years to a request. Each has
  `restrictedContributionsCount`, the private work counted, and
  `contributionCalendar`, each day's count.

Each request has 10 seconds, and one that fails in a way that might pass
(no connection, no answer in time, GitHub's server failing, a query
GitHub couldn't finish) is tried once more, two seconds later. What
comes back is checked before any of it is kept (`valibot`, in
`src/site/history/graphql.ts`), and only what the parts draw is kept:
each day's count, each year's total and private count, the account's
first day, and each language's size. Nothing else of your repos is
read: not their names, nor what's in them.

## A token

The GraphQL API answers no request without a token. A fine-grained
personal access token that reads public repositories, and has no other
permission, is enough: in GitHub's settings, **Developer settings**,
**Personal access tokens**, **Fine-grained tokens**, **Generate new
token**, with its repository access set to public repositories, read
only. It counts your private work all the same, if your profile does
([Private work](#private-work)). Give it an expiry you'll remember, and
make a new one before it runs out: a build with a token that has expired
stops, and says GitHub refused it.

Give the build the token in the environment variable `GITHUB_TOKEN`:

- on Cloudflare's Workers Builds, in the Worker's **Settings**,
  **Build**, **Variables and secrets**, as a secret;
- on Netlify or Vercel, in the project's environment variables;
- in a GitHub Actions workflow of your own that builds the site (GitHub
  Pages, [Deploying](deploy.md#github-pages)), as a repository secret
  passed to its build step: `env: GITHUB_TOKEN: ${{ secrets.BUILD_GITHUB_TOKEN }}`;
- for the repo's own checks (`.github/workflows/check.yml`, which runs
  `npm run verify` and so builds the site), as the repository secret
  `BUILD_GITHUB_TOKEN`, which the workflow passes on. GitHub doesn't
  give a secret to a pull request from a fork, so such a request's
  checks fail at the build;
- on your own machine, `GITHUB_TOKEN=… npm run build`.

The same token is the one the panel's [GitHub
activity](activity.md) asks with, if the site has both. The
build sends it to `api.github.com` and nowhere else, and it never goes
into a page, a log line or an error. Without one, the build stops before
asking anything, and says how to give it one; the dev server says so and
serves on, without the parts.

## When GitHub is down, or says no

The build stops and builds nothing. It says why, and at which address:
"GitHub answered 502", "no answer in 10 seconds", "GitHub has no user by
that name", "GitHub refused the token in GITHUB_TOKEN (Bad credentials)".
When the token's hourly limit is used up, it says until when:

```text
GitHub's limit for the token in GITHUB_TOKEN is used up until 14:05 UTC: build again then
```

A host that builds from your repo deploys nothing from a build that
fails, so the site that's up stays as it was, with the history of its
last build: answers whose parts went missing because GitHub was busy for
a minute would be worse. So nothing needs doing: the next day's rebuild
tries again, and so does a push. If the name or the token was wrong, the
build said so: put it right. To build without the history, remove
`githubHistory` and the `github` blocks.

The dev server says so too, and serves on, with the parts left out of
their answers. It fetches once, as it starts.

## A rebuild each day

On Cloudflare, the Worker can ask Workers Builds for a build once a day,
with a deploy hook and a cron trigger: [Writing](writing.md#a-rebuild-each-day)
says how. The rebuild fetches everything a build fetches, so with it the
history is never more than a day old, and the day's contributions show
by the next. A build asks GitHub a few times (once for the overview,
once for every four years of calendars), far inside a token's hourly
limit.

## Ask and llms.txt

[Ask](ask.md) reads each part as a line of plain text, so that its model
knows what the answer shows, but as a label it never quotes: the counts
are GitHub's, not your own words about yourself, and Ask answers only
from what you say. "Is Alex active on GitHub?" gets a sentence of yours
that says so, if one does. The line says what the part counts, in
English, and that it's as of the site's last build:

```text
(GitHub: 5,002 contributions on GitHub since 2019, 1,099 of them in private repos (counted, not shown), as of the site's last build. Longest streak: 41 days, 2023-10-02 to 2023-11-11. Busiest day: 2023-03-18, with 31.)
```

llms.txt has the same line under the answer, as it has every answer's
lines.

## Japanese fonts

The parts change from one build to the next, and a font cut for today's
dates and weekdays would be out of date at tomorrow's build. So each
part is marked `data-fetched`, as the Writing tab's posts are, labels and
all: `npm run fonts` doesn't cut for it, and the stylesheet sets the
whole part in the system's Japanese font, rather than its labels in one
font and its dates in another ([Writing](writing.md#japanese-fonts)).
The large numbers are figures, which the Latin serif has.

## Without GitHub, in the tests

No test reaches GitHub. Every build the tests make
(`tests/build/astro-build.ts`) sets the environment variable
`GITHUB_HISTORY_FIXTURE` to `tests/sample/github-history.json`, a
made-up history of the sample's user: a quiet start in 2019, growth, a
new job marked in 2021 and another in 2024, weekday work with quiet
weekends, a few long runs, private work counted from 2024. The build asks
it in place of GitHub (`src/site/history/fixture.ts`), saying so as it
starts, and needs no token for it. It answers for that user alone: any
other name gets the error GitHub gives a name it doesn't have, and the
build stops, so the file's history can't stand in for a real site's. Each
year's days are a line of characters, a day each from January 1, `0` to
`9` and then `a` to `z` for 10 to 35, which the stand-in writes out as
GitHub's calendar would. To build the sample as the tests do:

```sh
SITE_CONFIG=tests/sample/site.config.ts WRITING_FIXTURE=tests/sample/writing.json ACTIVITY_FIXTURE=tests/sample/activity.json GITHUB_HISTORY_FIXTURE=tests/sample/github-history.json npm run build
```

The template's own `site.config.ts` has `githubHistory` commented out, as
it has `activity`: a copy starts as that file, and would otherwise show
someone else's history.
