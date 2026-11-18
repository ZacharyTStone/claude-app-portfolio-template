/* The tests' stand-in for GitHub's, GitLab's and Codeberg's APIs
   (src/site/activity/fixture.ts): it takes each request to the place its
   origin is, answers for its own users, and for anyone else as the place
   does for a user it doesn't have. */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { feedAddress } from "../../../src/site/activity/codeberg.ts";
import { fixtureFetch, readFixture, type Fixture } from "../../../src/site/activity/fixture.ts";
import { eventsAddress } from "../../../src/site/activity/github.ts";
import { projectAddress, pushesAddress, userAddress } from "../../../src/site/activity/gitlab.ts";
import { folderForConfigs } from "../../sample/as-a-file.ts";
import { sampleActivity } from "../../sample/activity.ts";
import sample from "../../sample/site.config.ts";

const fixture: Fixture = {
  github: { user: "sam-sample", events: ["first", "second", "third"] },
  gitlab: {
    user: { id: 7, username: "sam-sample" },
    events: ["first", "second", "third"],
    projects: [{ id: 501, path_with_namespace: "sam-sample/notes", visibility: "public" }],
  },
  codeberg: { user: "sams", activities: ["first", "second", "third"] },
};
const ask = (address: string, from = fixture) => fixtureFetch(from)(address, {});
const answerTo = async (address: string, from = fixture) => {
  const answer = await ask(address, from);
  return [answer.status, await answer.json()];
};

test("it answers its GitHub user's events a page at a time, with a Link to the next while there is one, as GitHub does", async () => {
  const first = await ask(eventsAddress("sam-sample", 2));
  assert.deepEqual(await first.json(), ["first", "second"]);
  const next = /<([^>]+)>; rel="next"/.exec(first.headers.get("link") ?? "")?.[1] ?? "";
  assert.equal(next, `${eventsAddress("sam-sample", 2)}&page=2`);
  const second = await ask(next);
  assert.deepEqual(await second.json(), ["third"]);
  assert.equal(second.headers.get("link"), null);
});

test("it answers for its GitLab user by name, their pushes a page at a time, and each project it holds", async () => {
  assert.deepEqual(await answerTo(userAddress("Sam-Sample")), [200, [fixture.gitlab?.user]]);
  assert.deepEqual(await answerTo(pushesAddress(7, 2)), [200, ["first", "second"]]);
  assert.deepEqual(await answerTo(`${pushesAddress(7, 2)}&page=2`), [200, ["third"]]);
  assert.deepEqual(await answerTo(projectAddress(501)), [200, fixture.gitlab?.projects[0]]);
});

test("it answers its Codeberg user's activities a page at a time", async () => {
  assert.deepEqual(await answerTo(feedAddress("sams", 2)), [200, ["first", "second"]]);
  assert.deepEqual(await answerTo(`${feedAddress("sams", 2)}&page=2`), [200, ["third"]]);
});

for (const [whose, address, answer] of [
  ["another GitHub user's events", eventsAddress("someone-else", 100), [404, { message: "Not Found", status: "404" }]],
  ["another GitLab user, by name", userAddress("someone-else"), [200, []]],
  ["another GitLab user's pushes", pushesAddress(8, 100), [404, { message: "404 User Not Found" }]],
  ["a GitLab project it doesn't hold", projectAddress(502), [404, { message: "404 Project Not Found" }]],
  [
    "another Codeberg user's activities",
    feedAddress("someone-else", 50),
    [404, { message: "user redirect does not exist [name: someone-else]", url: "https://codeberg.org/api/swagger" }],
  ],
  [
    "another site's",
    "https://example.com/users/sam-sample/events/public?per_page=100",
    [404, { message: "Not Found" }],
  ],
] as const) {
  test(`it answers a request for ${whose} as the place does for what it doesn't have`, async () => {
    assert.deepEqual(await answerTo(address), answer);
  });
}

test("a place the file has nothing for answers as for a user it doesn't have, whoever is asked for", async () => {
  const onlyGitHub = { github: fixture.github };
  assert.deepEqual(await answerTo(userAddress("sam-sample"), onlyGitHub), [200, []]);
  assert.equal((await ask(feedAddress("sams", 50), onlyGitHub)).status, 404);
  assert.equal((await ask(eventsAddress("sam-sample", 100), { codeberg: fixture.codeberg })).status, 404);
});

test("the sample's fixture is a fixture, for the sample's own users", () => {
  const { github, gitlab, codeberg } = sampleActivity();
  assert.deepEqual({ github: github?.user, gitlab: gitlab?.user.username, codeberg: codeberg?.user }, sample.activity);
});

for (const [kind, notAFixture] of [
  ["a list", [{ type: "PushEvent" }]],
  ["GitHub's alone, as the file was before GitLab and Codeberg", { user: "sam-sample", events: [] }],
  ["one for a place it doesn't know", { github: fixture.github, bitbucket: { user: "sam-sample" } }],
] as const) {
  test(`a file that isn't a fixture is refused: ${kind}`, () => {
    const file = join(folderForConfigs(), "not-an-activity-fixture.json");
    writeFileSync(file, JSON.stringify(notAFixture));
    assert.throws(() => readFixture(file));
  });
}
