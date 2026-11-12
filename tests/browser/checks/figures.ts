/* Figures that move: a flow that follows an example through its steps
   plays when it's seen, a step can be picked, and it all shows at once
   where it can't play. */
import assert from "node:assert/strict";
import type { Locator, Page } from "playwright";
import { TIMING } from "../../../src/app/constants.ts";
import { DATA } from "../../../src/shared/page-data.ts";
import { askInNewChat, askReturns, desktop, eventually, OPEN_CHAT, type Check } from "../helpers.ts";
import { CLASS, type Site } from "../site.ts";

const FLOW = `[${DATA.flowExample}]`;
const STEPS = "ol > li";

/** How each step of a flow stands: "passed", "current" or "waiting". */
const stepStates = (flow: Locator): Promise<string[]> =>
  flow
    .locator(STEPS)
    .evaluateAll(
      (steps: Array<{ classList: { contains(name: string): boolean } }>, names) =>
        steps.map((step) =>
          step.classList.contains(names.current)
            ? "current"
            : step.classList.contains(names.passed)
              ? "passed"
              : "waiting",
        ),
      { current: CLASS.flowCurrent.slice(1), passed: CLASS.flowPassed.slice(1) },
    );

/** Whether a flow has `name` as a class of its own. */
const has = (flow: Locator, name: string): Promise<boolean> =>
  flow.evaluate(
    (el: { classList: { contains(name: string): boolean } }, cls) => el.classList.contains(cls),
    name.slice(1),
  );

export default (site: Site): Check[] => {
  const { words, askUrl, noAsk } = site;
  // The flow with the fewest steps: it's the quickest to watch to its end.
  const [flow] = site.exampleFlows;
  const skip = flow ? null : "the site has no flow that follows an example";
  const tab = flow?.tab ?? "";
  const count = flow?.steps ?? 0;
  /** The flow, in its tab, scrolled to. */
  async function seen(page: Page): Promise<Locator> {
    const figure = page.locator(`#${tab} ${FLOW}`).nth(flow?.index ?? 0);
    await figure.scrollIntoViewIfNeeded();
    return figure;
  }
  /** Each step but the one at `index` as it should be once the example is there. */
  const at = (index: number) =>
    Array.from({ length: count }, (_, i) => (i < index ? "passed" : i === index ? "current" : "waiting"));
  return [
    {
      name: "a flow that follows an example plays when it's seen: a step at a time, to its last",
      url: `#${tab}`,
      skip,
      async test(page) {
        const figure = await seen(page);
        await figure.locator(`${STEPS}${CLASS.flowCurrent}`).first().waitFor();
        assert.ok(await has(figure, CLASS.flowPlaying), "it's playing");
        assert.equal(await figure.locator(CLASS.flowPlay).textContent(), words.flowReplay);
        // Every step, in order: never two at once, never one skipped.
        const order: string[] = [];
        await eventually(
          async () => {
            const states = (await stepStates(figure)).join(" ");
            if (order.at(-1) !== states) order.push(states);
            assert.equal(states, at(count - 1).join(" "), "it reaches its last step");
          },
          count * TIMING.flowStep + 5000,
        );
        for (const states of order)
          assert.equal(states.split(" ").filter((state) => state === "current").length, 1, states);
        assert.equal(await has(figure, CLASS.flowPlaying), false, "and stops there");
      },
    },
    {
      name: "a step picked shows the example as far as there, by mouse or keyboard, and the button plays it from the start",
      url: `#${tab}`,
      skip,
      async test(page) {
        const figure = await seen(page);
        await figure.locator(`${STEPS}${CLASS.flowCurrent}`).first().waitFor();
        const names = figure.locator(`${STEPS} ${CLASS.flowStep}`);
        await names.nth(1).click();
        assert.deepEqual(await stepStates(figure), at(1));
        assert.equal(await has(figure, CLASS.flowPlaying), false, "picking a step stops it playing");
        assert.equal(await names.nth(1).getAttribute("aria-current"), "step");
        // A step is a button: it takes the focus, and Enter presses it.
        assert.equal(await names.first().getAttribute("role"), "button");
        await names.first().focus();
        await page.keyboard.press("Enter");
        assert.deepEqual(await stepStates(figure), at(0));
        await names.last().focus();
        await page.keyboard.press("Space");
        assert.deepEqual(await stepStates(figure), at(count - 1));
        await figure.locator(CLASS.flowPlay).click();
        assert.deepEqual(await stepStates(figure), at(0));
        assert.ok(await has(figure, CLASS.flowPlaying), "the button plays it again");
      },
    },
    {
      name: "with motion reduced, a flow shows whole until its button plays it",
      url: `#${tab}`,
      device: { ...desktop, reducedMotion: "reduce" },
      skip,
      async test(page) {
        const figure = await seen(page);
        const button = figure.locator(CLASS.flowPlay);
        await button.waitFor();
        assert.equal(await button.textContent(), words.flowPlay);
        assert.equal(await has(figure, CLASS.flowStepping), false, "every step shows");
        await button.click();
        assert.deepEqual(await stepStates(figure), at(0));
      },
    },
    {
      name: "without JavaScript, a flow shows every step's example, and no button",
      url: `#${tab}`,
      device: { ...desktop, javaScriptEnabled: false },
      skip,
      async test(page) {
        const figure = await seen(page);
        assert.equal(await figure.locator(CLASS.flowPlay).count(), 0);
        const examples = figure.locator(`${STEPS} ${CLASS.flowStepExample}`);
        assert.equal(await examples.count(), count, "an example for each step");
        for (const example of await examples.all()) assert.ok(await example.isVisible());
      },
    },
    {
      name: "a chat's copy of a flow shows whole, and plays by its own button",
      url: "./",
      skip: skip ?? noAsk,
      async test(page) {
        await askReturns(page, askUrl, { id: flow?.answer ?? null });
        await askInNewChat(page, "How does that work?");
        const copy = page.locator(`${OPEN_CHAT} ${FLOW}`).first();
        await copy.waitFor();
        assert.equal(await has(copy, CLASS.flowStepping), false, "every step shows");
        const steps = await copy.locator(STEPS).count();
        await copy.locator(CLASS.flowPlay).click();
        const states = await stepStates(copy);
        assert.deepEqual(states, ["current", ...Array<string>(steps - 1).fill("waiting")]);
      },
    },
  ];
};
