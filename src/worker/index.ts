import { ASK_PATH } from "../contracts/ask.ts";
import { handleAsk } from "./ask/handler.ts";
import { logToConsole } from "./ask/log.ts";
import type { Env } from "./env.ts";
import { logRebuildToConsole, rebuild } from "./rebuild.ts";

// wrangler.jsonc binds the Durable Object by its class name.
export { AskGuard } from "./guard/ask-guard.ts";

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
    // A path with no file reaches the Worker too: it gets the site's 404.
    if (new URL(request.url).pathname !== ASK_PATH) return env.ASSETS.fetch(request);
    return handleAsk(request, env, executionContext, logToConsole);
  },
  // The cron trigger in wrangler.jsonc: the daily rebuild.
  async scheduled(_controller: ScheduledController, env: Env): Promise<void> {
    await rebuild(env, (address, init) => fetch(address, init), logRebuildToConsole);
  },
} satisfies ExportedHandler<Env>;
