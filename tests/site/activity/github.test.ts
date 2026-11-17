/* A GitHub user's recent public activity as the build asks for it
   (src/site/activity/github.ts), with GitHub stood in for: what's kept of
   its answer, the pages followed, and each way it can fail. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_REPOS } from "../../../src/config/activity.ts";
import { fixtureFetch } from "../../../src/site/activity/fixture.ts";
import { eventsAddress, GITHUB_TOKEN, recentRepos, type Repo } from "../../../src/site/activity/github.ts";
import type { Fetch } from "../../../src/site/fetching.ts";
import { sampleGitHub, sampleRepos } from "../../sample/github.ts";

const USER = "sam-sample";

/** A test has no time to wait before a request is tried again. */
const NO_WAIT = 0;

/** A push as GitHub's API writes one: the `n`th newest, to `repo`. */
const push = (n: number, repo: string, changes: Record<string, unknown> = {}) => ({
  id: String(n),
  type: "PushEvent",
  actor: { id: 1, login: USER },
  repo: { id: n, name: repo, url: `https://api.github.com/repos/${repo}` },
  payload: { ref: "refs/heads/main", head: "c0ffee", before: "beef00" },
  public: true,
  created_at: new Date(Date.UTC(2026, 10, 30 - n)).toISOString().replace(".000", ""),
  ...changes,
});

/** Pushes to `count` repos of the user's, one each, the newest first. */
const pushesToRepos = (count: number) =>
  Array.from({ length: count }, (_, index) => push(index + 1, `${USER}/repo-${index + 1}`));

/** GitHub, stood in for: each request gets the next of `answers` (an Error
    is thrown, as fetch() throws), and is kept in `asked`. */
function gitHubAnswering(...answers: Array<Response | Error>) {
  const asked: Array<{ address: string; init: RequestInit }> = [];
  const fetch: Fetch = async (address, init) => {
    asked.push({ address, init });
    const answer = answers[asked.length - 1] ?? answers.at(-1);
    if (answer instanceof Error) throw answer;
    if (!answer) throw new Error("the test gave GitHub nothing to say");
    return answer.clone();
  };
  return { fetch, asked };
}

/** What GitHub sends with a refusal, and the headers it sends it with. */
const refusal = (status: number, message: string, headers: Record<string, string> = {}) =>
  Response.json({ message, documentation_url: "https://docs.github.com/rest" }, { status, headers });

/** GitHub's answer once its hourly limit is used up: 14:05 UTC is when it resets. */
const RESET_AT = Date.UTC(2026, 10, 17, 14, 5) / 1000;
const rateLimited = (status = 403) =>
  refusal(status, "API rate limit exceeded for 203.0.113.7.", {
    "x-ratelimit-limit": "60",
    "x-ratelimit-remaining": "0",
    "x-ratelimit-reset": String(RESET_AT),
  });

/** Throws the error fetch() throws when there's no connection. */
const noConnection = () => new TypeError("fetch failed", { cause: new Error("getaddrinfo ENOTFOUND api.github.com") });

const reposOf = (fetch: Fetch, more: { perPage?: number; token?: string } = {}) =>
  recentRepos(USER, { fetch, retryAfterMs: NO_WAIT, ...more });

const FIRST_PAGE = eventsAddress(USER, 100);

test("the sample's repos are the public ones it pushed to, the latest first, each once, at its latest push", async () => {
  const expected: Repo[] = [
    { name: "sam-sample/notes", url: "https://github.com/sam-sample/notes", pushed: "2026-11-12T23:30:00Z" },
    {
      name: "sample-org/shared-tool",
      url: "https://github.com/sample-org/shared-tool",
      pushed: "2026-11-08T15:45:00Z",
    },
    { name: "sam-sample/dotfiles", url: "https://github.com/sam-sample/dotfiles", pushed: "2026-10-30T20:00:00Z" },
    { name: "sam-sample/site", url: "https://github.com/sam-sample/site", pushed: "2026-10-15T07:00:00Z" },
  ];
  assert.deepEqual(await sampleRepos(), expected);
});

test(`no more than ${ACTIVITY_REPOS} repos are listed, however many were pushed to`, async () => {
  const { fetch } = gitHubAnswering(Response.json(pushesToRepos(ACTIVITY_REPOS + 2)));
  assert.deepEqual(
    (await reposOf(fetch)).map((repo) => repo.name),
    pushesToRepos(ACTIVITY_REPOS).map((event) => event.repo.name),
  );
});

test("an event that isn't public is left out, though the endpoint has only public ones", async () => {
  const hidden = sampleGitHub().events.filter((event) => !(event as { public: boolean }).public);
  assert.equal(hidden.length, 1, "the fixture has an event that isn't public");
  const hiddenRepo = (hidden[0] as { repo: { name: string } }).repo.name;
  assert.ok(!(await sampleRepos()).some((repo) => repo.name === hiddenRepo));
});

test("only a push counts: a star, an issue or a pull request names no repo", async () => {
  const { fetch } = gitHubAnswering(
    Response.json([
      push(1, "someone/starred", { type: "WatchEvent", payload: { action: "started" } }),
      push(2, "someone/issues", { type: "IssuesEvent" }),
      push(3, "someone/pulls", { type: "PullRequestEvent" }),
      push(4, `${USER}/pushed`),
    ]),
  );
  assert.deepEqual(
    (await reposOf(fetch)).map((repo) => repo.name),
    [`${USER}/pushed`],
  );
});

test("the latest push comes first, whatever order GitHub sends them in", async () => {
  const { fetch } = gitHubAnswering(Response.json([push(3, "a/three"), push(1, "a/one"), push(2, "a/two")]));
  assert.deepEqual(
    (await reposOf(fetch)).map((repo) => repo.name),
    ["a/one", "a/two", "a/three"],
  );
});

test("a user with no public pushes lately has no repos, and that's no failure", async () => {
  const { fetch } = gitHubAnswering(Response.json([]));
  assert.deepEqual(await reposOf(fetch), []);
});

test("a build asks for a hundred events a page, as GitHub's API asks to be asked, with a time limit", async () => {
  const { fetch, asked } = gitHubAnswering(Response.json(pushesToRepos(1)));
  await reposOf(fetch);
  assert.equal(asked[0]?.address, `https://api.github.com/users/${USER}/events/public?per_page=100`);
  const headers = new Headers(asked[0]?.init.headers);
  assert.equal(headers.get("accept"), "application/vnd.github+json");
  assert.equal(headers.get("x-github-api-version"), "2022-11-28");
  assert.equal(headers.get("authorization"), null);
  assert.ok(asked[0]?.init.signal instanceof AbortSignal);
});

test(`with a token from ${GITHUB_TOKEN}, it asks with the token`, async () => {
  const { fetch, asked } = gitHubAnswering(Response.json(pushesToRepos(1)));
  await reposOf(fetch, { token: "a-token" });
  assert.equal(new Headers(asked[0]?.init.headers).get("authorization"), "Bearer a-token");
});

test("the pages are followed, by GitHub's Link to the next, until they name enough repos", async () => {
  // Two events a page, each repo pushed to twice: a page names one repo.
  const twice = pushesToRepos(ACTIVITY_REPOS).flatMap((event) => [event, { ...event, id: `${event.id}b` }]);
  const asked: string[] = [];
  const fixture = fixtureFetch({ user: USER, events: [...twice, ...pushesToRepos(2)] });
  const fetch: Fetch = (address, init) => {
    asked.push(address);
    return fixture(address, init);
  };
  const repos = await reposOf(fetch, { perPage: 2 });
  assert.equal(repos.length, Math.min(ACTIVITY_REPOS, 3));
  assert.deepEqual(asked, [
    eventsAddress(USER, 2),
    `${eventsAddress(USER, 2)}&page=2`,
    `${eventsAddress(USER, 2)}&page=3`,
  ]);
});

test("no page is asked for once the first names enough repos", async () => {
  const { fetch, asked } = gitHubAnswering(
    Response.json(pushesToRepos(ACTIVITY_REPOS), { headers: { link: `<${FIRST_PAGE}&page=2>; rel="next"` } }),
  );
  await reposOf(fetch);
  assert.equal(asked.length, 1);
});

test("a Link to anywhere but GitHub's API isn't followed, so a token goes nowhere else", async () => {
  const { fetch, asked } = gitHubAnswering(
    Response.json(pushesToRepos(1), { headers: { link: '<https://example.com/events?page=2>; rel="next"' } }),
  );
  assert.equal((await reposOf(fetch, { token: "a-token" })).length, 1);
  assert.equal(asked.length, 1);
});

test("a user GitHub doesn't have stops it at once, saying so and where", async () => {
  const fetch = fixtureFetch({ user: "someone-else", events: [] });
  await assert.rejects(reposOf(fetch), {
    message: `GitHub has no user by that name (Not Found), at ${FIRST_PAGE}`,
  });
});

for (const status of [403, 429]) {
  test(`GitHub's hourly limit, used up (${status}), stops it at once, saying when it resets and what to do`, async () => {
    const { fetch, asked } = gitHubAnswering(rateLimited(status));
    await assert.rejects(reposOf(fetch), {
      message: `GitHub's limit of 60 requests an hour without a token is used up for this machine's address until 14:05 UTC: build again then, or give the build a token in ${GITHUB_TOKEN}, at ${FIRST_PAGE}`,
    });
    assert.equal(asked.length, 1);
  });
}

test("the limit, used up for a token, says it's the token's", async () => {
  const { fetch } = gitHubAnswering(rateLimited());
  await assert.rejects(reposOf(fetch, { token: "a-token" }), {
    message: `GitHub's limit of requests for the token in ${GITHUB_TOKEN} is used up until 14:05 UTC: build again then, at ${FIRST_PAGE}`,
  });
});

test("a token GitHub refuses stops it, saying it's the token, and never what it is", async () => {
  const { fetch, asked } = gitHubAnswering(refusal(401, "Bad credentials"));
  await assert.rejects(reposOf(fetch, { token: "a-secret-token" }), (error: Error) => {
    assert.equal(
      error.message,
      `GitHub refused the token in ${GITHUB_TOKEN} (Bad credentials): fix it, or unset it, at ${FIRST_PAGE}`,
    );
    assert.ok(!error.message.includes("a-secret-token"));
    return true;
  });
  assert.equal(asked.length, 1);
});

test("a 403 that isn't the hourly limit says what GitHub said, and isn't tried again", async () => {
  const { fetch, asked } = gitHubAnswering(refusal(403, "You have exceeded a secondary rate limit."));
  await assert.rejects(
    reposOf(fetch),
    /^Error: GitHub answered 403 \(You have exceeded a secondary rate limit\.\), at /,
  );
  assert.equal(asked.length, 1);
});

test("a server error is tried once more, and the second answer is the one that counts", async () => {
  const { fetch, asked } = gitHubAnswering(refusal(503, "Service Unavailable"), Response.json(pushesToRepos(1)));
  assert.equal((await reposOf(fetch)).length, 1);
  assert.equal(asked.length, 2);
});

test("a server that fails twice stops it, saying how", async () => {
  const { fetch, asked } = gitHubAnswering(new Response("Bad gateway", { status: 502 }));
  await assert.rejects(reposOf(fetch), /^Error: GitHub answered 502, at https:\/\/api\.github\.com\//);
  assert.equal(asked.length, 2);
});

test("no connection, twice, stops it, saying why", async () => {
  const { fetch, asked } = gitHubAnswering(noConnection());
  await assert.rejects(reposOf(fetch), {
    message: `GitHub couldn't be reached: fetch failed (getaddrinfo ENOTFOUND api.github.com), at ${FIRST_PAGE}`,
  });
  assert.equal(asked.length, 2);
});

test("no answer in time, twice, stops it, saying so", async () => {
  const { fetch, asked } = gitHubAnswering(new DOMException("The operation timed out.", "TimeoutError"));
  await assert.rejects(reposOf(fetch), /^Error: no answer in 10 seconds, at /);
  assert.equal(asked.length, 2);
});

for (const [wrong, answer, where] of [
  ["an object, not a list", { events: [] }, "the answer"],
  ["an event that doesn't say whether it's public", [push(1, "a/b", { public: undefined })], "0.public"],
  ["an event whose date isn't one", [push(1, "a/b", { created_at: "yesterday" })], "0.created_at"],
  ["an event whose repo isn't an owner and a name", [push(1, "../../evil")], "0.repo.name"],
  ["an event with no repo", [push(1, "a/b", { repo: undefined })], "0.repo"],
] as const) {
  test(`an answer with ${wrong} stops it, saying where, and isn't asked for again`, async () => {
    const { fetch, asked } = gitHubAnswering(Response.json(answer));
    await assert.rejects(reposOf(fetch), (error: Error) => {
      assert.match(error.message, /^GitHub's answer isn't a list of events as its API sends one \(/);
      assert.ok(error.message.includes(`(${where}: `), error.message);
      return true;
    });
    assert.equal(asked.length, 1);
  });
}

test("an answer that isn't JSON stops it, as one that isn't a list of events", async () => {
  const { fetch } = gitHubAnswering(new Response("<html>Unicorn!</html>", { status: 200 }));
  await assert.rejects(reposOf(fetch), /isn't a list of events/);
});
