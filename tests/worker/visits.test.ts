/* POST /visits and the counts AskGuard keeps for the home screen's globe
   (src/worker/visits.ts, src/worker/guard/visit-counts.ts): where a visitor
   is said to be, what's kept, and that each is counted once a day. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readVisits, VISITS_PATH } from "../../src/contracts/globe.ts";
import type { Env } from "../../src/worker/env.ts";
import { AskGuard } from "../../src/worker/guard/ask-guard.ts";
import { readSaidPlaces, sayPlaces, squareOf, VISIT_KEYS } from "../../src/worker/guard/visit-counts.ts";
import { readAsked, urlAsking } from "../../src/worker/guard/wire.ts";
import { VISITOR_ADDRESS_HEADER } from "../../src/worker/lib/visitor.ts";
import { handleVisits, youFrom } from "../../src/worker/visits.ts";
import { realGuard, storageOver, type Stored } from "./support/guard.ts";

const OSAKA = { latitude: "34.69374", longitude: "135.50218", city: "Osaka" };

function visit(stored: Stored, address: string, cf: Record<string, unknown> | undefined = OSAKA) {
  const request = new Request(`https://example.com${VISITS_PATH}`, {
    method: "POST",
    headers: { [VISITOR_ADDRESS_HEADER]: address },
  });
  Object.defineProperty(request, "cf", { value: cf });
  const env = { ASK_GUARD: realGuard(stored) } as unknown as Env;
  return handleVisits(request, env);
}

test("a visitor is told where they are to a tenth of a degree, and nothing of their town", () => {
  assert.deepEqual(youFrom(OSAKA), { latitude: 34.7, longitude: 135.5 });
});

test("a visitor Cloudflare can't place is told nothing of where they are", () => {
  assert.equal(youFrom({ city: "Osaka" }), null);
  assert.equal(youFrom(undefined), null);
});

test("a square is named by its middle, to the nearest whole degree", () => {
  assert.equal(squareOf(34.7, 135.5), "35,136");
  assert.equal(squareOf(-33.9, -70.6), "-34,-71");
});

test("AskGuard says its places most visited first, and they're read back as they were", () => {
  const said = sayPlaces({ "52,0": 1, "35,136": 4 });
  assert.equal(said, "35,136,4;52,0,1");
  assert.deepEqual(readSaidPlaces(said), [
    [35, 136, 4],
    [52, 0, 1],
  ]);
  assert.deepEqual(readSaidPlaces(""), []);
});

test("a visit and its square go to AskGuard and back as they were asked", () => {
  const asked = { ask: "visit", visitorHash: "abc", square: "35,136" } as const;
  assert.deepEqual(readAsked(new URL(urlAsking(asked))), asked);
  assert.deepEqual(readAsked(new URL(urlAsking({ ...asked, square: null }))), { ...asked, square: null });
});

test("a square that isn't whole degrees is refused", () => {
  assert.equal(readAsked(new URL("https://guard/visit?who=abc&at=35.5,136")), "unreadable");
});

test("a visitor is counted where they are, and told where the site's visitors have come from", async () => {
  const stored: Stored = new Map();
  const reply = readVisits(await (await visit(stored, "203.0.113.9")).json());
  assert.deepEqual(reply, { you: { latitude: 34.7, longitude: 135.5 }, places: [[35, 136, 1]] });
});

test("the same visitor is counted once a day, however often they come", async () => {
  const stored: Stored = new Map();
  await visit(stored, "203.0.113.9");
  const again = readVisits(await (await visit(stored, "203.0.113.9")).json());
  assert.deepEqual(again?.places, [[35, 136, 1]]);
  const other = readVisits(await (await visit(stored, "198.51.100.7")).json());
  assert.deepEqual(other?.places, [[35, 136, 2]]);
});

test("nothing kept names a visitor: not their address, their town or when they came", async () => {
  const stored: Stored = new Map();
  await visit(stored, "203.0.113.9");
  const kept = JSON.stringify([...stored]);
  for (const told of ["203.0.113.9", "Osaka", "34.69", "135.50"]) assert.equal(kept.includes(told), false, told);
});

test("who's been counted today is forgotten when the day ends, and the places are kept", async () => {
  const stored: Stored = new Map();
  await visit(stored, "203.0.113.9");
  assert.ok([...stored.keys()].some((key) => key.startsWith(VISIT_KEYS.visited)));
  await new AskGuard({ storage: storageOver(stored) } as unknown as DurableObjectState).alarm();
  assert.deepEqual([...stored.keys()], [VISIT_KEYS.places]);
});

test("only a POST is answered", async () => {
  const response = await handleVisits(new Request(`https://example.com${VISITS_PATH}`), {} as Env);
  assert.equal(response.status, 405);
});
