/* The Worker asked through its entry (src/worker/index.ts), as Cloudflare
   calls it, with its log on the console; and the stand-ins in support/,
   passed on under one name. */
import { mock } from "node:test";
import type { Env } from "../../src/worker/env.ts";
import worker from "../../src/worker/index.ts";
import { askRequest, withContext } from "./support/worker.ts";

export { EN, INDEX, JA } from "./support/answers.ts";
export { okLeft } from "./support/guard.ts";
export { models, toolCall, using, writer, wrote, type Call } from "./support/models.ts";
export { UNADDRESSED, UNWRITTEN, stubs } from "./support/worker.ts";

/** Keeps the Worker's log lines instead of printing them, for a test file
    that reads them. */
export const captureLogs = () => mock.method(console, "log", () => {});

/** The log lines `logs` has kept since it was last reset, without what each
    question cost. */
export const lines = (logs: ReturnType<typeof captureLogs>): string[] =>
  logs.mock.calls
    .map((call): Record<string, unknown> => JSON.parse(String(call.arguments[0])))
    .map(({ neurons: _cost, ...line }) => JSON.stringify(line));

/** What /ask replies to `question`, as JSON. */
export const askJson = async (env: Env, question: string, lang = "en"): Promise<unknown> =>
  (await withContext((context) => worker.fetch(askRequest({ question, lang }), env, context))).json();
