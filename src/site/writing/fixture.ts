/* A stand-in for Qiita's API, so that no test reaches qiita.com: it answers
   from a file of what Qiita would send. A build uses it only when the
   environment variable WRITING_FIXTURE names that file, which only the
   tests set, and then only for the user the file is for. Any other user
   gets the 404 Qiita gives an id it doesn't have, and the build stops: the
   file's made-up posts can't stand in for a real site's own. */
import { readFileSync } from "node:fs";
import * as v from "valibot";
import type { Fetch } from "../fetching.ts";
import { qiitaItemsAddress } from "./qiita.ts";

/** The environment variable that names the fixture's file, from the repo's
    root: "tests/sample/qiita.json". */
export const WRITING_FIXTURE = "WRITING_FIXTURE";

const FixtureSchema = v.object({
  /** The Qiita user id the items are for. */
  user: v.string(),
  /** Every item Qiita would send for that user, in its order (newest
      first), as its API writes them: they're checked as Qiita's are. */
  items: v.array(v.unknown()),
});

export type Fixture = v.InferOutput<typeof FixtureSchema>;

/** Throws if the file isn't there, or isn't a fixture. */
export const readFixture = (file: string): Fixture => v.parse(FixtureSchema, JSON.parse(readFileSync(file, "utf8")));

const NOT_FOUND = { message: "Not found", type: "not_found" };

/** Answers as Qiita's API would, from `fixture`: its user's items a page at
    a time, and for any other address the 404 Qiita sends. */
export function fixtureFetch({ user, items }: Fixture): Fetch {
  const usersItems = new URL(qiitaItemsAddress(user, 1, 1));
  return async (address) => {
    const asked = new URL(address);
    const isTheUsersItems = asked.origin === usersItems.origin && asked.pathname === usersItems.pathname;
    if (!isTheUsersItems) return Response.json(NOT_FOUND, { status: 404 });
    const page = Number(asked.searchParams.get("page"));
    const perPage = Number(asked.searchParams.get("per_page"));
    return Response.json(items.slice((page - 1) * perPage, page * perPage));
  };
}
