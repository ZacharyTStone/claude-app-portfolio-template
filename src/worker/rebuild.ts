/* The daily rebuild. A cron trigger in wrangler.jsonc runs it, and it asks
   Workers Builds for a build of the site by the deploy hook the secret
   DEPLOY_HOOK_URL holds, so the Writing tab lists what's been posted since
   the last one, and the panel's GitHub activity what's been pushed
   (docs/writing.md, docs/github-activity.md). Without the secret it does nothing. The
   hook's address is a credential, so neither it nor an error's message,
   which could repeat it, is ever logged. */
import type { Env } from "./env.ts";

/** How long Workers Builds may take to say it will build, in milliseconds. */
const ANSWER_WITHIN_MS = 10_000;

/** The one line a rebuild logs: that Workers Builds took the request, or
    the status it refused it with, or the kind of error that kept it from
    answering ("TimeoutError"). */
export type RebuildLine = { rebuild: "started" | "refused"; status: number } | { rebuild: "error"; error: string };

export type RebuildLog = (line: RebuildLine) => void;

/** One line of JSON, under the Worker's Observability tab. */
export const logRebuildToConsole: RebuildLog = (line) => console.log(JSON.stringify(line));

/** As much of fetch() as a rebuild uses. */
export type Fetch = (address: string, init: RequestInit) => Promise<Response>;

/** An error's kind, never its message. */
const errorKind = (error: unknown): string =>
  error instanceof Error && /^\w+Error$/.test(error.name) ? error.name : "unknown";

/** POSTs to the deploy hook, if the Worker has one, and logs what came of it. */
export async function rebuild(env: Pick<Env, "DEPLOY_HOOK_URL">, fetch: Fetch, log: RebuildLog): Promise<void> {
  const hook = env.DEPLOY_HOOK_URL;
  if (!hook) return;
  try {
    const { ok, status } = await fetch(hook, { method: "POST", signal: AbortSignal.timeout(ANSWER_WITHIN_MS) });
    log({ rebuild: ok ? "started" : "refused", status });
  } catch (error) {
    log({ rebuild: "error", error: errorKind(error) });
  }
}
