/* A GitLab user's recent public activity as the build asks for it
   (src/site/activity/gitlab.ts), with GitLab stood in for: the user's
   number by their name, their pushes, and a project for each repo the
   panel lists; what's kept of the answers, and each way it can fail. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_REPOS } from "../../../src/config/activity.ts";
import { fixtureFetch, type Fixture } from "../../../src/site/activity/fixture.ts";
import { gitlabRepos, projectAddress, pushesAddress, userAddress } from "../../../src/site/activity/gitlab.ts";
import type { Repo } from "../../../src/site/activity/repo.ts";
import type { Fetch } from "../../../src/site/fetching.ts";
import { sampleActivity } from "../../sample/activity.ts";

const USER = { id: 31337, username: "sam-sample" };

/** A test has no time to wait before a request is tried again. */
const NO_WAIT = 0;

/** A push as GitLab's API writes one: the `n`th newest, to the project numbered `project`. */
const push = (n: number, project: number, changes: Record<string, unknown> = {}) => ({
  id: n,
  project_id: project,
  action_name: "pushed to",
  author_id: USER.id,
  author: { id: USER.id, username: USER.username },
  push_data: { commit_count: 1, action: "pushed", ref_type: "branch", ref: "main", commit_title: "A change" },
  created_at: new Date(Date.UTC(2026, 10, 30 - n)).toISOString(),
  ...changes,
});

/** A project as GitLab's API writes one, numbered `id`. */
const project = (id: number, path: string, visibility = "public") => ({
  id,
  name: path.split("/").at(-1),
  path_with_namespace: path,
  web_url: `https://gitlab.com/${path}`,
  visibility,
});

/** GitLab, stood in for by the fixture, with every address asked kept. */
function gitLabWith(gitlab: Omit<NonNullable<Fixture["gitlab"]>, "user">) {
  const asked: string[] = [];
  const answer = fixtureFetch({ gitlab: { user: USER, ...gitlab } });
  const fetch: Fetch = (address, init) => {
    asked.push(address);
    return answer(address, init);
  };
  return { fetch, asked };
}

/** GitLab, stood in for: each request gets the next of `answers`. */
function gitLabAnswering(...answers: Response[]) {
  const asked: string[] = [];
  const fetch: Fetch = async (address) => {
    asked.push(address);
    const answer = answers[asked.length - 1] ?? answers.at(-1);
    if (!answer) throw new Error("the test gave GitLab nothing to say");
    return answer.clone();
  };
  return { fetch, asked };
}

const reposOf = (fetch: Fetch, more: { perPage?: number } = {}) =>
  gitlabRepos(USER.username, { fetch, retryAfterMs: NO_WAIT, ...more });

const theUser = () => Response.json([USER]);

test("the sample's repos are the public projects it pushed to, the latest first, each once, at its latest push", async () => {
  const gitlab = (name: string, pushed: string): Repo => ({
    service: "gitlab",
    name,
    url: `https://gitlab.com/${name}`,
    pushed,
  });
  const repos = await gitlabRepos("sam-sample", { fetch: fixtureFetch(sampleActivity()) });
  assert.deepEqual(repos, [
    gitlab("sample-group/tools/linter", "2026-11-10T08:15:00Z"),
    gitlab("sam-sample/pipelines", "2026-11-06T12:00:00Z"),
  ]);
});

test("it asks for the user by name, then for their pushes by their number, then for each project", async () => {
  const { fetch, asked } = gitLabWith({ events: [push(1, 501)], projects: [project(501, "sam-sample/notes")] });
  await reposOf(fetch);
  assert.deepEqual(asked, [userAddress(USER.username), pushesAddress(USER.id, 100), projectAddress(501)]);
  assert.equal(asked[1], `https://gitlab.com/api/v4/users/${USER.id}/events?action=pushed&per_page=100`);
});

test("a push that only deletes a branch or a tag isn't counted, nor is one by anyone else", async () => {
  const { fetch } = gitLabWith({
    events: [
      push(1, 501, { action_name: "deleted" }),
      push(2, 502, { author_id: 1 }),
      push(3, 503, { action_name: "pushed new" }),
    ],
    projects: [project(501, "a/deleted"), project(502, "a/someone-elses"), project(503, "a/new")],
  });
  assert.deepEqual(
    (await reposOf(fetch)).map((repo) => repo.name),
    ["a/new"],
  );
});

test("a project that isn't public is left out, whether GitLab hides it or says so, and the next is asked for", async () => {
  const { fetch, asked } = gitLabWith({
    events: Array.from({ length: ACTIVITY_REPOS + 2 }, (_, index) => push(index + 1, 501 + index)),
    // It has no 503 to show: it answers 404, as it does for a private project.
    projects: [
      project(501, "a/one"),
      project(502, "a/internal", "internal"),
      project(504, "a/four"),
      project(505, "a/five"),
      project(506, "a/six"),
    ],
  });
  assert.deepEqual(
    (await reposOf(fetch)).map((repo) => repo.name),
    ["a/one", "a/four", "a/five", "a/six"],
  );
  assert.deepEqual(asked.slice(2), [501, 502, 503, 504, 505, 506].map(projectAddress));
});

test(`only as many projects are asked for as the panel lists, ${ACTIVITY_REPOS}, when they're public`, async () => {
  const many = Array.from({ length: ACTIVITY_REPOS + 3 }, (_, index) => 501 + index);
  const { fetch, asked } = gitLabWith({
    events: many.map((id, index) => push(index + 1, id)),
    projects: many.map((id) => project(id, `a/repo-${id}`)),
  });
  assert.equal((await reposOf(fetch)).length, ACTIVITY_REPOS);
  assert.equal(asked.filter((address) => address.includes("/projects/")).length, ACTIVITY_REPOS);
});

test("the pages of pushes are followed while they're full and name too few projects", async () => {
  const { fetch, asked } = gitLabWith({
    events: [push(1, 501), push(2, 501), push(3, 502), push(4, 502), push(5, 503)],
    projects: [project(501, "a/one"), project(502, "a/two"), project(503, "a/three")],
  });
  assert.equal((await reposOf(fetch, { perPage: 2 })).length, 3);
  assert.deepEqual(asked.slice(1, 4), [
    pushesAddress(USER.id, 2),
    `${pushesAddress(USER.id, 2)}&page=2`,
    `${pushesAddress(USER.id, 2)}&page=3`,
  ]);
});

test("a user GitLab doesn't have stops it at once, saying so and where", async () => {
  const { fetch, asked } = gitLabAnswering(Response.json([]));
  await assert.rejects(gitlabRepos("someone-else", { fetch, retryAfterMs: NO_WAIT }), {
    message: `GitLab has no user by that name, at ${userAddress("someone-else")}`,
  });
  assert.equal(asked.length, 1);
});

test("pushes GitLab won't show for the user stop it, saying what GitLab said", async () => {
  const { fetch } = gitLabAnswering(theUser(), Response.json({ message: "404 User Not Found" }, { status: 404 }));
  await assert.rejects(reposOf(fetch), {
    message: `GitLab has no user by that name (404 User Not Found), at ${pushesAddress(USER.id, 100)}`,
  });
});

test("a server error is tried once more, and a refusal isn't", async () => {
  const busy = gitLabAnswering(
    Response.json({ message: "502 Bad Gateway" }, { status: 502 }),
    theUser(),
    Response.json([]),
  );
  assert.deepEqual(await reposOf(busy.fetch), []);
  assert.equal(busy.asked.length, 3);
  const limited = gitLabAnswering(Response.json({ message: "Retry later" }, { status: 429 }));
  await assert.rejects(
    reposOf(limited.fetch),
    /^Error: GitLab answered 429 \(Retry later\), at https:\/\/gitlab\.com\//,
  );
  assert.equal(limited.asked.length, 1);
});

for (const [wrong, answers, what, where] of [
  ["a user with no number", [Response.json([{ username: USER.username }])], "a list of users", "0.id"],
  [
    "a push with no project",
    [theUser(), Response.json([push(1, 501, { project_id: null })])],
    "a list of events",
    "0.project_id",
  ],
  [
    "a project whose path isn't one",
    [theUser(), Response.json([push(1, 501)]), Response.json(project(501, "../../evil"))],
    "a project",
    "path_with_namespace",
  ],
] as const) {
  test(`an answer with ${wrong} stops it, saying where, and isn't asked for again`, async () => {
    const { fetch, asked } = gitLabAnswering(...answers);
    await assert.rejects(reposOf(fetch), (error: Error) => {
      assert.ok(
        error.message.startsWith(`GitLab's answer isn't ${what} as its API sends one (${where}: `),
        error.message,
      );
      return true;
    });
    assert.equal(asked.length, answers.length);
  });
}
