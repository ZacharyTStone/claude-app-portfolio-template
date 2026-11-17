/* What the build's requests to another site have in common: the Writing
   tab's posts (writing/) and the panel's GitHub activity (activity/). Each
   request has a time limit, and one that fails in a way that might pass is
   tried once more, a moment later. */
import { setTimeout as sleep } from "node:timers/promises";

/** As much of fetch() as the build uses: what the tests stand in for. */
export type Fetch = (address: string, init: RequestInit) => Promise<Response>;

/** How long one request may take, and how long a failed one waits before
    it's tried again, in milliseconds. */
export const WAIT_MS = { answer: 10_000, retry: 2_000 } as const;

/** Why a request gave nothing to use, and whether trying again might. */
export type Failure = { why: string; mightPass: boolean };

const isFailure = (tried: unknown): tried is Failure =>
  typeof tried === "object" && tried !== null && "mightPass" in tried;

const reasonOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** What's said when fetch() itself throws: there was no answer in time, or
    `service` ("Qiita") couldn't be reached. Either might pass. */
export function unreachable(service: string, error: unknown): Failure {
  if (error instanceof Error && error.name === "TimeoutError") {
    return { why: `no answer in ${WAIT_MS.answer / 1000} seconds`, mightPass: true };
  }
  const cause = error instanceof Error && error.cause !== undefined ? ` (${reasonOf(error.cause)})` : "";
  return { why: `${service} couldn't be reached: ${reasonOf(error)}${cause}`, mightPass: true };
}

/** What `tryOnce` gives, tried once more `retryAfterMs` later after a
    failure that might pass. Throws, saying why and at `address`, if there's
    still nothing. */
export async function withOneMoreTry<Got>(
  address: string,
  tryOnce: () => Promise<Got | Failure>,
  retryAfterMs: number = WAIT_MS.retry,
): Promise<Got> {
  let tried = await tryOnce();
  if (isFailure(tried) && tried.mightPass) {
    await sleep(retryAfterMs);
    tried = await tryOnce();
  }
  if (isFailure(tried)) throw new Error(`${tried.why}, at ${address}`);
  return tried;
}
