import { ASK_PATH } from "../contracts/ask.ts";
import { CONTACT_PATH } from "../contracts/contact.ts";
import { handleAsk } from "./ask/handler.ts";
import { handleContact } from "./contact/handler.ts";
import type { Env } from "./env.ts";
import { logToConsole } from "./lib/log.ts";

// wrangler.jsonc binds the Durable Object by its class name.
export { AskGuard } from "./guard/ask-guard.ts";

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === ASK_PATH) return handleAsk(request, env, executionContext, logToConsole);
    if (pathname === CONTACT_PATH) return handleContact(request, env, logToConsole);
    // A path with no file reaches the Worker too: it gets the site's 404.
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
