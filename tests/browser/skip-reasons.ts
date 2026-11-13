import type { Reporter, TestCase, TestResult } from "@playwright/test/reporter";

const SKIP = "skip";

/** Says, after a run, why checks were skipped: the list of results shows
    that one was, but not that this site has no viewer. */
export default class SkipReasons implements Reporter {
  #countByReason = new Map<string, number>();

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== "skipped") return;
    const why = [...result.annotations, ...test.annotations].find((note) => note.type === SKIP)?.description;
    const reason = `${test.parent.project()?.name}: ${why ?? "no reason given"}`;
    this.#countByReason.set(reason, (this.#countByReason.get(reason) ?? 0) + 1);
  }

  onEnd(): void {
    if (!this.#countByReason.size) return;
    console.log("\nSkipped, on a site without what they check:");
    for (const [reason, count] of this.#countByReason) console.log(`  ${String(count).padStart(3)}  ${reason}`);
  }
}
