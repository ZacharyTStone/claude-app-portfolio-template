/* The page's policy as the browser applies it. Served with the real
   headers, the page refuses what the policy says it refuses: a test of the
   headers' wording can't say that, and a policy quietly loosened fails
   here. */
import { expect, test } from "./fixtures.ts";

// What Chromium's console says of a refusal: each of these tests brings one about on purpose.
const A_REFUSAL = /Trusted(HTML|Script)|Content Security Policy/;

const NOTHING_THROWN = "nothing";
const A_HANDLER_RAN = "An inline handler ran";

// Each attempt is made from a timer, in a task of the page's own, as its script would make it:
// what the browser's DevTools runs for a check is let past the policy.
test.describe("under the real security headers", () => {
  test.beforeEach(async ({ page, pageErrors }) => {
    pageErrors.expected(A_REFUSAL);
    await page.goto("./");
  });

  test("HTML is never made from a string: setting innerHTML throws", async ({ page }) => {
    const thrown = await page.evaluate(
      (nothing) =>
        new Promise<string>((tell) => {
          setTimeout(() => {
            try {
              document.body.innerHTML = "<b>from a string</b>";
              tell(nothing);
            } catch (error) {
              tell((error as Error).name);
            }
          });
        }),
      NOTHING_THROWN,
    );
    expect(thrown).toBe("TypeError");
  });

  test("a string is never run as code: eval throws", async ({ page }) => {
    const thrown = await page.evaluate(
      (nothing) =>
        new Promise<string>((tell) => {
          setTimeout(() => {
            try {
              eval("1 + 1");
              tell(nothing);
            } catch (error) {
              tell((error as Error).name);
            }
          });
        }),
      NOTHING_THROWN,
    );
    expect(thrown).not.toBe(NOTHING_THROWN);
  });

  test("an inline handler never runs", async ({ page }) => {
    const title = await page.evaluate(
      (whatItWouldSay) =>
        new Promise<string>((tell) => {
          setTimeout(() => {
            const button = document.createElement("button");
            try {
              button.setAttribute("onclick", `document.title = "${whatItWouldSay}"`);
            } catch {
              // Refused before it was an attribute at all: Trusted Types takes no script from a string.
            }
            document.body.append(button);
            button.click();
            tell(document.title);
          });
        }),
      A_HANDLER_RAN,
    );
    expect(title).not.toBe(A_HANDLER_RAN);
  });
});
