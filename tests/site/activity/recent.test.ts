/* The panel's activity from every place the config names
   (src/site/activity/recent.ts), with each place stood in for: the repos
   listed together, the token sent to GitHub alone, and which failure is
   said. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { ACTIVITY_REPOS } from "../../../src/config/activity.ts";
import { CODEBERG } from "../../../src/site/activity/codeberg.ts";
import { fixtureFetch } from "../../../src/site/activity/fixture.ts";
import { GITHUB_API } from "../../../src/site/activity/github.ts";
import { GITLAB, userAddress } from "../../../src/site/activity/gitlab.ts";
import { recentRepos } from "../../../src/site/activity/recent.ts";
import type { Fetch } from "../../../src/site/fetching.ts";
import { sampleActivity, sampleRepos } from "../../sample/activity.ts";
import sample from "../../sample/site.config.ts";

/** The sample's fixture, with every request kept. */
function theSample() {
  const asked: Array<{ address: string; init: RequestInit }> = [];
  const answer = fixtureFetch(sampleActivity());
  const fetch: Fetch = (address, init) => {
    asked.push({ address, init });
    return answer(address, init);
  };
  return { fetch, asked };
}

test("the sample's repos are its latest pushes wherever they were, each once, on its own place", async () => {
  assert.deepEqual(
    (await sampleRepos()).map((repo) => [repo.service, repo.name, repo.pushed]),
    [
      ["github", "sam-sample/notes", "2026-11-12T23:30:00Z"],
      ["gitlab", "sample-group/tools/linter", "2026-11-10T08:15:00Z"],
      ["codeberg", "sams/zine", "2026-11-09T20:00:00Z"],
      ["github", "sample-org/shared-tool", "2026-11-08T15:45:00Z"],
    ],
  );
});

test(`no more than ${ACTIVITY_REPOS} are listed, of all the places together`, async () => {
  assert.equal((await sampleRepos()).length, ACTIVITY_REPOS);
});

test("a repo of the same name on two places is two repos, each linking to its own", async () => {
  const notes = { type: "PushEvent", public: true, created_at: "2026-11-10T00:00:00Z", repo: { name: "sams/notes" } };
  const mirrored = {
    op_type: "commit_repo",
    user_id: 1,
    act_user_id: 1,
    is_private: false,
    created: "2026-11-11T00:00:00+01:00",
    repo: { full_name: "sams/notes", private: false },
  };
  const fetch = fixtureFetch({
    github: { user: "sams", events: [notes] },
    codeberg: { user: "sams", activities: [mirrored] },
  });
  const repos = await recentRepos({ github: "sams", codeberg: "sams" }, { fetch });
  assert.deepEqual(
    repos.map((repo) => repo.url),
    ["https://codeberg.org/sams/notes", "https://github.com/sams/notes"],
  );
});

test("only the places the config names are asked", async () => {
  const { fetch, asked } = theSample();
  await recentRepos({ codeberg: "sams" }, { fetch });
  assert.deepEqual(new Set(asked.map(({ address }) => new URL(address).origin)), new Set([CODEBERG]));
});

test("a token for GitHub is sent to GitHub's API, and nowhere else", async () => {
  const { fetch, asked } = theSample();
  await recentRepos(sample.activity ?? {}, { fetch, githubToken: "a-token" });
  const sentTo = asked.map(({ address, init }) => [
    new URL(address).origin,
    new Headers(init.headers).get("authorization"),
  ]);
  assert.ok(sentTo.some(([origin]) => origin === GITLAB));
  assert.ok(sentTo.some(([origin]) => origin === CODEBERG));
  for (const [origin, authorization] of sentTo) {
    assert.equal(authorization, origin === GITHUB_API ? "Bearer a-token" : null, `what's sent to ${origin}`);
  }
});

test("when places can't be read, the first the config names is said, whichever answered first", async () => {
  const nobody = fixtureFetch({});
  await assert.rejects(recentRepos({ gitlab: "someone-else", codeberg: "someone-else" }, { fetch: nobody }), {
    message: `GitLab has no user by that name, at ${userAddress("someone-else")}`,
  });
});

test("a config that names no place lists nothing, and asks no one", async () => {
  const { fetch, asked } = theSample();
  assert.deepEqual(await recentRepos({}, { fetch }), []);
  assert.equal(asked.length, 0);
});
