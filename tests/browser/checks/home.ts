/* The home screen (its greeting, its box and the questions to start with
   under it), and a thread's own tab: its name and its link. */
import assert from "node:assert/strict";
import type { Request } from "playwright";
import {
  askReturns,
  desktop,
  hourIn,
  lastText,
  moments,
  OPEN_CHAT,
  revisit,
  settledTitle,
  squash,
  VISITOR_ZONE,
  type Check,
} from "../helpers.ts";
import {
  CHATS_GROUP,
  DATA,
  groupId,
  HOURS,
  partOfDay,
  MENU_KEYS,
  PAGE_CLASSES,
  SEPARATOR,
} from "../../../src/shared/page-data.ts";
import { CLASS, ID, type Site } from "../site.ts";

export default (site: Site): Check[] => {
  const { A, B, words } = site;
  const [prompt] = site.prompts;
  // The home screen's box.
  const box = `${ID.top} .${PAGE_CLASSES.homeAsk} input`;
  return [
    {
      name: "home: the greeting and one line, and the details panel",
      url: "./",
      async test(page) {
        await page.locator(ID.hello).waitFor();
        assert.equal(await page.locator(`${ID.top} ${CLASS.intro}`).count(), 1);
        const { greetings } = site;
        if (Object.values(greetings).every(Boolean)) {
          const expected = moments().map((at) => greetings[partOfDay(hourIn(VISITOR_ZONE, at), HOURS.greeting)]);
          assert.ok(
            expected.includes(squash(await page.locator(ID.hello).textContent())),
            "the time of day's greeting",
          );
        }
        assert.equal(
          await page.locator(`${ID.details} > section`).first().getAttribute("aria-labelledby"),
          site.panel[0],
        );
      },
    },
    {
      name: "home: its box is ready to type in, and a question typed there is sent in a new chat",
      url: "./",
      async test(page) {
        // No answer for it, as for anything the site doesn't say (and as
        // every question gets with Ask off).
        await askReturns(page, site.askUrl, { id: null });
        await page.locator(`${box}:focus`).waitFor();
        const question = "what's the weather like where you are?";
        await page.keyboard.type(question);
        await page.keyboard.press("Enter");
        await page.locator(OPEN_CHAT).waitFor();
        assert.equal(
          await page.locator(`${OPEN_CHAT} .${PAGE_CLASSES.thread} > .${PAGE_CLASSES.question}`).evaluate(lastText),
          question,
        );
        await page.locator(`${OPEN_CHAT} .${PAGE_CLASSES.thread} [${DATA.mail}]`).waitFor();
        // Kept as any chat is, under "Chats", and named after the question.
        const row = page.locator(`[id="${groupId(CHATS_GROUP)}"] + ul a`);
        await row.filter({ hasText: question }).waitFor();
        // Back on the home screen, the box is empty, and ready again.
        await page.goBack();
        await page.locator(`${box}:focus`).waitFor();
        assert.equal(await page.locator(box).inputValue(), "");
        // As it is from a thread's tab, by the name at the top.
        await page.goto(site.url(`#${A.id}`));
        await page.locator(`${ID.tabs} .${PAGE_CLASSES.wordmark}`).click();
        await page.locator(`${box}:focus`).waitFor();
      },
    },
    {
      name: "the skip link goes to the open tab, and leaves it open",
      url: `#${A.id}`,
      async test(page) {
        await page.locator(`#${A.id}:target`).waitFor();
        // Tab would start from the open tab, where the address points.
        await page.locator(CLASS.skip).focus();
        await page.keyboard.press("Enter");
        await page.locator(`#${A.id} :focus`).waitFor();
        assert.equal(new URL(page.url()).hash, `#${A.id}`);
        assert.ok(await page.locator(`#${A.id}`).isVisible(), "the tab is still open");
      },
    },
    {
      name: "home: a question to start with opens a chat with the answer it names, word for word",
      url: "./",
      skip: prompt ? null : "the home screen has no questions to start with",
      async test(page) {
        if (!prompt) return;
        const asked: Request[] = [];
        await askReturns(page, site.askUrl, "fail", asked);
        const [tab = "", n = "1"] = prompt.answer.split(".");
        await page.locator(`${ID.top} [${DATA.prompt}="${prompt.answer}"]`).first().click();
        await page.locator(OPEN_CHAT).waitFor();
        const thread = `${OPEN_CHAT} .${PAGE_CLASSES.thread}`;
        assert.equal(await page.locator(`${thread} > .${PAGE_CLASSES.question}`).evaluate(lastText), prompt.q);
        const reply = page.locator(`${thread} > .${PAGE_CLASSES.answer}`);
        await reply.waitFor();
        // The answer as its own tab has it: its nth, counting from 1.
        const answers = page.locator(`[id="${tab}"] .${PAGE_CLASSES.thread} > .${PAGE_CLASSES.answer}`);
        const own = squash(await answers.nth(Number(n) - 1).textContent());
        assert.ok(own, `#${tab} has an answer ${n}`);
        assert.ok(squash(await reply.textContent()).startsWith(own), "that answer, word for word");
        assert.equal(asked.length, 0, "nothing is asked of /ask: the page names the answer");
        assert.equal(squash(await page.locator(`${OPEN_CHAT} ${CLASS.titleText}`).textContent()), prompt.q);
      },
    },
    {
      name: "renaming a thread: its title, its sidebar row and the window title, remembered",
      url: `#${B.id}`,
      async test(page) {
        const name = "A thread renamed";
        const title = page.locator(`#${B.id} ${CLASS.titleText}`);
        const row = page.locator(`${ID.tabs} a[href="#${B.id}"]`).first();
        await page.locator(`#${B.id} ${CLASS.titleButton}`).click();
        await page.keyboard.press("ControlOrMeta+A");
        await page.keyboard.type(name);
        await page.keyboard.press("Enter");
        assert.equal(await title.textContent(), name);
        assert.ok((await row.textContent())?.includes(name), "on its row");
        const windowTitle = `${name}${SEPARATOR}${site.name}`;
        assert.equal(await settledTitle(page, (text) => text === windowTitle), windowTitle);
        await revisit(page, site.url(`#${B.id}`));
        assert.equal(await title.textContent(), name, "on the next visit too");
        // Renamed to nothing: its own name again.
        await page.locator(`#${B.id} ${CLASS.titleButton}`).click();
        await page.keyboard.press("ControlOrMeta+A");
        await page.keyboard.press("Backspace");
        await page.keyboard.press("Enter");
        assert.equal(squash(await title.textContent()), B.title);
        assert.ok(!(await row.textContent())?.includes(name));
      },
    },
    {
      name: "copy link: Share, the icon under an answer and the thread's menu copy the tab's link",
      url: `#${A.id}`,
      device: { ...desktop, permissions: ["clipboard-read", "clipboard-write"] },
      async test(page) {
        const share = page.locator(`#${A.id} [${DATA.copyLink}] ${CLASS.label}`);
        const label = (await share.textContent()) ?? "";
        await share.click();
        await share.filter({ hasText: words.copied }).waitFor();
        // What was copied, pasted into the card's box.
        const input = page.locator(`${ID.followUp} input`);
        await page.locator(`#${A.id} ${CLASS.composer}`).click();
        await input.focus();
        await page.keyboard.press("ControlOrMeta+V");
        assert.equal(await input.inputValue(), site.url(`#${A.id}`));
        await page.keyboard.press("Escape");
        const icon = page.locator(`#${A.id} ${CLASS.messageActions} [${DATA.copyLink}]`).first();
        if (await icon.count()) {
          await icon.click();
          await page.locator(`#${A.id} ${CLASS.messageActions} [${DATA.copyLink}]${CLASS.done}`).waitFor();
          assert.equal(await icon.getAttribute("title"), words.copied);
        }
        await page.locator(`#${A.id} ${CLASS.titleMenuButton}`).click();
        await page.locator(`${ID.titleMenu} [${DATA.key}="${MENU_KEYS.copyLink}"]`).click();
        await page.locator(`${CLASS.toast}${CLASS.show}`).filter({ hasText: words.copied }).waitFor();
        await share.filter({ hasText: label }).waitFor({ timeout: 3000 });
      },
    },
  ];
};
