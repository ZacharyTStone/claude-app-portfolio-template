/* A place the Writing tab's posts come from, stood in for, for the tests of
   Zenn, DEV and the feeds: each request gets the answer for its address, and
   is kept. */
import type { Fetch } from "../../../src/site/fetching.ts";

/** A test has no time to wait before a request is tried again. */
export const NO_WAIT = 0;

/** What an address is answered with: a Response, or an Error, which is
    thrown as fetch() throws, or a list of them, given in turn. */
type Answer = Response | Error;

/** A place that answers each address it's asked with the answer `answers`
    has for it (the next of a list, then the last again), and any other with
    a 404; `asked` is every address it was asked, in order. */
export function placeAnswering(answers: Record<string, Answer | Answer[]>) {
  const asked: Array<{ address: string; init: RequestInit }> = [];
  const times = new Map<string, number>();
  const fetch: Fetch = async (address, init) => {
    asked.push({ address, init });
    const these = [answers[address] ?? Response.json({ message: "Not found" }, { status: 404 })].flat();
    const time = times.get(address) ?? 0;
    times.set(address, time + 1);
    const answer = these[Math.min(time, these.length - 1)];
    if (answer instanceof Error) throw answer;
    if (!answer) throw new Error(`the test gave nothing to say at ${address}`);
    return answer.clone();
  };
  return { fetch, asked };
}
