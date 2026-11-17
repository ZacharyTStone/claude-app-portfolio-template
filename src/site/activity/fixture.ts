/* A stand-in for GitHub's API, so that no test reaches api.github.com: it
   answers from a file of what GitHub would send. A build uses it only when
   the environment variable ACTIVITY_FIXTURE names that file, which only the
   tests set, and then only for the user the file is for. Any other user
   gets the 404 GitHub gives a name it doesn't have, and the build stops:
   the file's made-up repos can't stand in for a real site's own. */
import { readFileSync } from "node:fs";
import * as v from "valibot";
import type { Fetch } from "../fetching.ts";
import { eventsAddress } from "./github.ts";

/** The environment variable that names the fixture's file, from the repo's
    root: "tests/sample/github.json". */
export const ACTIVITY_FIXTURE = "ACTIVITY_FIXTURE";

const FixtureSchema = v.object({
  /** The GitHub user name the events are for. */
  user: v.string(),
  /** Every public event GitHub would send for that user, in its order
      (newest first), as its API writes them: they're checked as GitHub's
      are. */
  events: v.array(v.unknown()),
});

export type Fixture = v.InferOutput<typeof FixtureSchema>;

/** Throws if the file isn't there, or isn't a fixture. */
export const readFixture = (file: string): Fixture => v.parse(FixtureSchema, JSON.parse(readFileSync(file, "utf8")));

const NOT_FOUND = { message: "Not Found", status: "404" };

/** Answers as GitHub's API would, from `fixture`: its user's events a page
    at a time, with a Link to the next page while there is one, and for any
    other address the 404 GitHub sends. */
export function fixtureFetch({ user, events }: Fixture): Fetch {
  const usersEvents = new URL(eventsAddress(user, 1));
  return async (address) => {
    const asked = new URL(address);
    const isTheUsersEvents = asked.origin === usersEvents.origin && asked.pathname === usersEvents.pathname;
    if (!isTheUsersEvents) return Response.json(NOT_FOUND, { status: 404 });
    const page = Number(asked.searchParams.get("page") ?? 1);
    const perPage = Number(asked.searchParams.get("per_page"));
    const hasMore = page * perPage < events.length;
    const link = `<${eventsAddress(user, perPage)}&page=${page + 1}>; rel="next"`;
    return Response.json(events.slice((page - 1) * perPage, page * perPage), {
      headers: hasMore ? { link } : {},
    });
  };
}
