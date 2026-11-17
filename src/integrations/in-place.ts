/* What the integrations that fetch as a build starts share: a log to report
   to, and how a module of the build's (src/site/writing/fetched.ts,
   src/site/activity/fetched.ts) is given what was fetched in place of its
   own empty list. */
import { resolve } from "node:path";

/** Where a report goes: Astro's logger for an integration. */
export type Log = Record<"info" | "warn" | "error", (message: string) => void>;

/** Vite's hook, named `name`, that gives the module at `file` (an absolute
    path) `value` as its default export, in place of the file's own. */
export const inPlaceOfTheFile = (name: string, file: string, value: unknown) => ({
  name,
  enforce: "pre" as const,
  load: (id: string) =>
    resolve(id.split("?")[0] ?? "") === file ? `export default ${JSON.stringify(value)};` : undefined,
});
