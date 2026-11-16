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
  /** AskGuard: the daily counts (Ask's questions and the contact form's
      messages), and blocks. Without it, /ask picks nothing and /contact
      sends nothing. */
  ASK_GUARD?: DurableObjectNamespace;
  /** Where the contact form's messages go out: wrangler.jsonc locks it to
      one address, the site owner's (destination_address). Without it,
      /contact sends nothing. */
  CONTACT_EMAIL?: SendEmail;
  /** A secret: the address of a Workers Builds deploy hook for the site's
      branch, which the cron trigger POSTs to for the daily rebuild
      (rebuild.ts). Without it, the trigger does nothing. */
  DEPLOY_HOOK_URL?: string;
};
