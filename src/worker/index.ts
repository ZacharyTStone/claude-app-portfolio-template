/* The site's one piece of server code: POST /ask, which picks which of the
   site's own answers answers a visitor's question, and may reply with a
   sentence written from the lines of it that do, or with those lines.
   Start at ask/handler.ts. Every other path gets the site's static files.

   AskGuard is exported because wrangler.jsonc binds the Durable Object by
   its class name. */
import { handleAsk } from "./ask/handler.ts";
import { ASK_PATH } from "../shared/ask.ts";
import type { Env } from "./env.ts";

export { AskGuard } from "./guard/ask-guard.ts";

export default {
  async fetch(request: Request, env: Env, executionContext: ExecutionContext): Promise<Response> {
    // A path with no file reaches the Worker too: it gets the site's 404.
    if (new URL(request.url).pathname !== ASK_PATH) return env.ASSETS.fetch(request);
    return handleAsk(request, env, executionContext);
  },
} satisfies ExportedHandler<Env>;
