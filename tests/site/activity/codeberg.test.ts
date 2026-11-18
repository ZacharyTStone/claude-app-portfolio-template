/* A Codeberg user's recent public activity as the build asks for it
   (src/site/activity/codeberg.ts), with Codeberg stood in for: what's kept
   of its answer, the pages followed, and each way it can fail. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_REPOS } from "../../../src/config/activity.ts";
import { codebergRepos, feedAddress } from "../../../src/site/activity/codeberg.ts";
import { fixtureFetch } from "../../../src/site/activity/fixture.ts";
import type { Repo } from "../../../src/site/activity/repo.ts";
import type { Fetch } from "../../../src/site/fetching.ts";
import { sampleActivity } from "../../sample/activity.ts";

const USER = "sams";
const USER_ID = 4242;

/** A test has no time to wait before a request is tried again. */
const NO_WAIT = 0;

/** A push as Forgejo's API writes one: the `n`th newest, to `repo`, at
    noon in Berlin's winter time. */
const push = (n: number, repo: string, changes: Record<string, unknown> = {}) => ({
  id: n,
  user_id: USER_ID,
  op_type: "commit_repo",
  act_user_id: USER_ID,
  act_user: { id: USER_ID, login: USER },
  repo_id: n,
  repo: { id: n, name: repo.split("/")[1], full_name: repo, private: false, html_url: `https://codeberg.org/${repo}` },
  ref_name: "refs/heads/main",
  is_private: false,
  content: '{"Commits":[{"Sha1":"c0ffee","Message":"A change"}]}',
  created: `2026-11-${String(30 - n).padStart(2, "0")}T12:00:00+01:00`,
  ...changes,
});

/** Pushes to `count` repos of the user's, one each, the newest first. */
const pushesToRepos = (count: number) =>
  Array.from({ length: count }, (_, index) => push(index + 1, `${USER}/repo-${index + 1}`));

/** Codeberg, stood in for by the fixture, with every address asked kept. */
function codebergWith(activities: unknown[]) {
  const asked: string[] = [];
  const answer = fixtureFetch({ codeberg: { user: USER, activities } });
  const fetch: Fetch = (address, init) => {
    asked.push(address);
    return answer(address, init);
  };
  return { fetch, asked };
}

/** Codeberg, stood in for: each request gets the next of `answers`. */
function codebergAnswering(...answers: Response[]) {
  const asked: string[] = [];
  const fetch: Fetch = async (address) => {
    asked.push(address);
    const answer = answers[asked.length - 1] ?? answers.at(-1);
    if (!answer) throw new Error("the test gave Codeberg nothing to say");
    return answer.clone();
  };
  return { fetch, asked };
}

const reposOf = (fetch: Fetch, more: { perPage?: number } = {}) =>
  codebergRepos(USER, { fetch, retryAfterMs: NO_WAIT, ...more });

const FIRST_PAGE = feedAddress(USER, 50);

test("the sample's repos are the public ones it pushed to, the latest first, each once, at its latest push in UTC", async () => {
  const codeberg = (name: string, pushed: string): Repo => ({
    service: "codeberg",
    name,
    url: `https://codeberg.org/${name}`,
    pushed,
  });
  assert.deepEqual(await codebergRepos(USER, { fetch: fixtureFetch(sampleActivity()) }), [
    codeberg("sams/zine", "2026-11-09T20:00:00Z"),
    codeberg("friends/garden", "2026-10-25T06:00:00Z"),
  ]);
});

test("a build asks for fifty of what the user did themselves, a page, with a time limit", async () => {
  const { fetch, asked } = codebergAnswering(Response.json(pushesToRepos(1)));
  await reposOf(fetch);
  assert.deepEqual(asked, [
    `https://codeberg.org/api/v1/users/${USER}/activities/feeds?only-performed-by=true&limit=50`,
  ]);
});

test("a push of commits or of a tag counts; a star, a deleted branch or a mirror's sync doesn't", async () => {
  const { fetch } = codebergWith([
    push(1, "someone/starred", { op_type: "star_repo" }),
    push(2, `${USER}/deleted`, { op_type: "delete_branch" }),
    push(3, `${USER}/mirror`, { op_type: "mirror_sync_push" }),
    push(4, `${USER}/tagged`, { op_type: "push_tag", ref_name: "refs/tags/v1" }),
    push(5, `${USER}/pushed`),
  ]);
  assert.deepEqual(
    (await reposOf(fetch)).map((repo) => repo.name),
    [`${USER}/tagged`, `${USER}/pushed`],
  );
});

test("a push to a private repo is left out, and so is one by anyone else", async () => {
  const { fetch } = codebergWith([
    push(1, `${USER}/private`, { is_private: true }),
    push(2, `${USER}/also-private`, { repo: { full_name: `${USER}/also-private`, private: true } }),
    push(3, "someone/theirs", { act_user_id: 1 }),
    push(4, `${USER}/public`),
  ]);
  assert.deepEqual(
    (await reposOf(fetch)).map((repo) => repo.name),
    [`${USER}/public`],
  );
});

test(`no more than ${ACTIVITY_REPOS} repos are listed, however many were pushed to`, async () => {
  const { fetch } = codebergWith(pushesToRepos(ACTIVITY_REPOS + 2));
  assert.equal((await reposOf(fetch)).length, ACTIVITY_REPOS);
});

test("the pages are followed while they're full and name too few repos", async () => {
  const twice = pushesToRepos(3).flatMap((event) => [event, { ...event, id: event.id + 100 }]);
  const { fetch, asked } = codebergWith(twice);
  assert.equal((await reposOf(fetch, { perPage: 2 })).length, 3);
  assert.deepEqual(asked, [feedAddress(USER, 2), `${feedAddress(USER, 2)}&page=2`, `${feedAddress(USER, 2)}&page=3`]);
});

test("a user Codeberg doesn't have stops it at once, saying so and where", async () => {
  const { fetch, asked } = codebergWith([]);
  await assert.rejects(codebergRepos("someone-else", { fetch, retryAfterMs: NO_WAIT }), {
    message: `Codeberg has no user by that name (user redirect does not exist [name: someone-else]), at ${feedAddress("someone-else", 50)}`,
  });
  assert.equal(asked.length, 1);
});

test("a server error is tried once more; a server that fails twice stops it, saying how", async () => {
  const { fetch, asked } = codebergAnswering(new Response("Bad gateway", { status: 502 }));
  await assert.rejects(reposOf(fetch), { message: `Codeberg answered 502, at ${FIRST_PAGE}` });
  assert.equal(asked.length, 2);
});

test("no connection, twice, stops it, saying why", async () => {
  const asked: string[] = [];
  const fetch: Fetch = async (address) => {
    asked.push(address);
    throw new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND codeberg.org") });
  };
  await assert.rejects(reposOf(fetch), {
    message: `Codeberg couldn't be reached: fetch failed (getaddrinfo ENOTFOUND codeberg.org), at ${FIRST_PAGE}`,
  });
  assert.equal(asked.length, 2);
});

for (const [wrong, answer, where] of [
  ["an object, not a list", { data: [] }, "the answer"],
  ["an activity that doesn't say whether it's private", [push(1, "a/b", { is_private: undefined })], "0.is_private"],
  [
    "an activity whose repo isn't an owner and a name",
    [push(1, "a/b", { repo: { full_name: "a/..", private: false } })],
    "0.repo.full_name",
  ],
  ["an activity whose date isn't one", [push(1, "a/b", { created: "yesterday" })], "0.created"],
] as const) {
  test(`an answer with ${wrong} stops it, saying where, and isn't asked for again`, async () => {
    const { fetch, asked } = codebergAnswering(Response.json(answer));
    await assert.rejects(reposOf(fetch), (error: Error) => {
      assert.ok(
        error.message.startsWith(`Codeberg's answer isn't a list of activities as its API sends one (${where}: `),
        error.message,
      );
      return true;
    });
    assert.equal(asked.length, 1);
  });
}
