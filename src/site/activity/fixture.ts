/* A stand-in for GitHub's, GitLab's and Codeberg's APIs, so that no test
   reaches any of them: it answers from a file of what each would send,
   under the place's name in `activity` ("github", "gitlab", "codeberg"),
   and takes each request to the place its origin is. A build uses it only
   when the environment variable ACTIVITY_FIXTURE names that file, which
   only the tests set, and then only for the users the file is for. Any
   other address gets what the place sends for a user it doesn't have, and
   the build stops: the file's made-up repos can't stand in for a real
   site's own. */
import { readFileSync } from "node:fs";
import * as v from "valibot";
import type { Fetch } from "../fetching.ts";
import { CODEBERG, feedAddress } from "./codeberg.ts";
import { eventsAddress, GITHUB_API } from "./github.ts";
import { GITLAB, projectAddress, pushesAddress, userAddress } from "./gitlab.ts";

/** The environment variable that names the fixture's file, from the repo's
    root: "tests/sample/activity.json". */
export const ACTIVITY_FIXTURE = "ACTIVITY_FIXTURE";

/** What each place would send is written as its API writes it: it's
    checked as theirs is. */
const FixtureSchema = v.strictObject({
  github: v.optional(
    v.object({
      /** The GitHub user name the events are for. */
      user: v.string(),
      /** Every public event GitHub would send for that user, newest first. */
      events: v.array(v.unknown()),
    }),
  ),
  gitlab: v.optional(
    v.object({
      /** The user as GitLab lists one: { "id": 31337, "username": "…", … }. */
      user: v.looseObject({ id: v.number(), username: v.string() }),
      /** Every push GitLab would send for that user, newest first. */
      events: v.array(v.unknown()),
      /** Each project GitLab would show anyone: { "id": 501, … }. */
      projects: v.array(v.looseObject({ id: v.number() })),
    }),
  ),
  codeberg: v.optional(
    v.object({
      /** The Codeberg user name the activities are for. */
      user: v.string(),
      /** Every activity Codeberg would send for what that user did, newest
          first. */
      activities: v.array(v.unknown()),
    }),
  ),
});

export type Fixture = v.InferOutput<typeof FixtureSchema>;

/** Throws if the file isn't there, or isn't a fixture. */
export const readFixture = (file: string): Fixture => v.parse(FixtureSchema, JSON.parse(readFileSync(file, "utf8")));

/** The page `asked` asks for, of `list`, by its `page` and by `sizeName`
    ("per_page", "limit"), and whether there's another after it. */
function pageOf(list: unknown[], asked: URL, sizeName: string): { page: unknown[]; hasMore: boolean } {
  const page = Number(asked.searchParams.get("page") ?? 1);
  const size = Number(asked.searchParams.get(sizeName));
  return { page: list.slice((page - 1) * size, page * size), hasMore: page * size < list.length };
}

const pathOf = (address: string): string => new URL(address).pathname;

/** As GitHub's API: the user's events a page at a time, with a Link to the
    next page while there is one, and for any other address the 404 GitHub
    sends. */
function githubAnswer(asked: URL, github: Fixture["github"]): Response {
  if (!github || asked.pathname !== pathOf(eventsAddress(github.user, 1))) {
    return Response.json({ message: "Not Found", status: "404" }, { status: 404 });
  }
  const { page, hasMore } = pageOf(github.events, asked, "per_page");
  const perPage = Number(asked.searchParams.get("per_page"));
  const pageNumber = Number(asked.searchParams.get("page") ?? 1);
  const link = `<${eventsAddress(github.user, perPage)}&page=${pageNumber + 1}>; rel="next"`;
  return Response.json(page, { headers: hasMore ? { link } : {} });
}

/** The users GitLab has of the name `asked` gives: the fixture's, or none. */
function gitlabUsers(asked: URL, gitlab: Fixture["gitlab"]): Response {
  const name = asked.searchParams.get("username")?.toLowerCase();
  return Response.json(gitlab && name === gitlab.user.username.toLowerCase() ? [gitlab.user] : []);
}

/** As gitlab.com's API: the user, when asked for by name (and for any other
    name, a list of none); their pushes, a page at a time; the projects it
    shows anyone; and for any other address the 404 GitLab sends. */
function gitlabAnswer(asked: URL, gitlab: Fixture["gitlab"]): Response {
  const { pathname } = asked;
  if (pathname === pathOf(userAddress(""))) return gitlabUsers(asked, gitlab);
  if (gitlab && pathname === pathOf(pushesAddress(gitlab.user.id, 1))) {
    return Response.json(pageOf(gitlab.events, asked, "per_page").page);
  }
  const project = gitlab?.projects.find((one) => pathname === pathOf(projectAddress(one.id)));
  if (project) return Response.json(project);
  const notFound = /\/projects\/\d+$/.test(pathname) ? "Project" : "User";
  return Response.json({ message: `404 ${notFound} Not Found` }, { status: 404 });
}

/** As Codeberg's API: what the user did, a page at a time, and for any
    other address the 404 Codeberg sends for a user it doesn't have. */
function codebergAnswer(asked: URL, codeberg: Fixture["codeberg"]): Response {
  if (codeberg && asked.pathname === pathOf(feedAddress(codeberg.user, 1))) {
    return Response.json(pageOf(codeberg.activities, asked, "limit").page);
  }
  // "/api/v1/users/<name>/activities/feeds"
  const name = decodeURIComponent(asked.pathname.split("/")[4] ?? "");
  const message = `user redirect does not exist [name: ${name}]`;
  return Response.json({ message, url: `${CODEBERG}/api/swagger` }, { status: 404 });
}

/** Answers as each place's API would, from `fixture`, by the origin of the
    address asked; and for an origin that's none of theirs, a 404. */
export function fixtureFetch(fixture: Fixture): Fetch {
  const answerFor = new Map<string, (asked: URL) => Response>([
    [GITHUB_API, (asked) => githubAnswer(asked, fixture.github)],
    [GITLAB, (asked) => gitlabAnswer(asked, fixture.gitlab)],
    [CODEBERG, (asked) => codebergAnswer(asked, fixture.codeberg)],
  ]);
  return async (address) => {
    const asked = new URL(address);
    return answerFor.get(asked.origin)?.(asked) ?? Response.json({ message: "Not Found" }, { status: 404 });
  };
}
