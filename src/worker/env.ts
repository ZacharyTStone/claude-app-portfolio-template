import type { Variables } from "./settings.ts";

/** What the Worker is given: its variables, and its bindings as
    wrangler.jsonc names them. */
export type Env = Variables & {
  /** Workers AI: the model that picks and writes, and Llama Guard. */
  AI: Ai;
  /** The built site's files (dist/), ask.json among them. */
  ASSETS: Fetcher;
  /** Questions a minute from one visitor. Without it, /ask picks nothing. */
  ASK_LIMIT?: RateLimit;
  /** AskGuard: the daily counts, and blocks. Without it, /ask picks nothing. */
  ASK_GUARD?: DurableObjectNamespace;
};
