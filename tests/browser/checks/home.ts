/* The home screen (its greeting, its box and the questions to start with
   under it), and a thread's own tab: its name and its link. */
import assert from "node:assert/strict";
import type { Locator, Page, Request } from "playwright";
import { DATA, MENU_KEYS } from "../../../src/contracts/page-attributes.ts";
import { HOURS, partOfDay } from "../../../src/contracts/day-parts.ts";
import {
  askReturns,
  CHAT_ROWS,
  desktop,
  EMAIL_LINK,
  hourIn,
  lastText,
  minutesAroundNow,
  NO_ANSWER,
  OPEN_CHAT,
  waitForTabToOpen,
  renameTab,
  revisit,
  settledTitle,
  sidebarRow,
  squash,
  VISITOR_ZONE,
  windowTitle,
  type Check,
} from "../helpers.ts";
import { CLASS, ID, PANEL_SECTIONS, type Site } from "../site.ts";

/** The home screen's box to type a question in, and the same box once it's
    ready to type in: the focus is in it. */
const HOME_BOX = `${ID.top} ${CLASS.homeAsk} input`;
const READY_HOME_BOX = `${HOME_BOX}:focus`;

/** How long Share has to say its own name again after "Copied", in
    milliseconds. */
const SHARE_NAMED_AGAIN_WITHIN_MS = 3000;

/** The checks of the home screen and of a thread's own tab, made for the
    site as it was read: its threads, its wording, its questions to start
    with. */
export default (site: Site): Check[] => {
  const { A, B, words } = site;
  const [prompt] = site.prompts;
  return [
    {
      name: "home: the greeting and one line, and the details panel",
      url: "./",
      async test(page) {
        await page.locator(ID.hello).waitFor();
        assert.equal(await page.locator(`${ID.top} ${CLASS.intro}`).count(), 1, "one line under the greeting");
        // A site may leave a part of the day without a greeting of its own.
        if (Object.values(site.greetings).every(Boolean)) {
          const greeting = squash(await page.locator(ID.hello).textContent());
          assert.ok(
            greetingsAroundNow(site).includes(greeting),
            `the greeting is the one for the visitor's time of day, not "${greeting}"`,
          );
        }
        assert.equal(
          await page.locator(PANEL_SECTIONS).first().getAttribute("aria-labelledby"),
          site.panel[0],
          "the details panel starts with its first section",
        );
      },
    },
    {
      name: "home: its box is ready to type in, and a question typed there is sent in a new chat",
      url: "./",
      async test(page) {
        // No answer for it, as for anything the site doesn't say (and as
        // every question gets with Ask off).
        await askReturns(page, site.askUrl, NO_ANSWER);
        await page.locator(READY_HOME_BOX).waitFor();
        const question = "what's the weather like where you are?";
        await page.keyboard.type(question);
        await page.keyboard.press("Enter");

        await page.locator(OPEN_CHAT).waitFor();
        assert.equal(
          await page.locator(`${OPEN_CHAT} ${CLASS.thread} > ${CLASS.question}`).evaluate(lastText),
          question,
          "the new chat starts with the question, as it was typed",
        );
        await page.locator(`${OPEN_CHAT} ${CLASS.thread} ${EMAIL_LINK}`).waitFor();
        // Kept as any chat is, under "Chats", and named after the question.
        await page.locator(CHAT_ROWS).filter({ hasText: question }).waitFor();

        // Back on the home screen, the box is empty, and ready again.
        await page.goBack();
        await page.locator(READY_HOME_BOX).waitFor();
        assert.equal(await page.locator(HOME_BOX).inputValue(), "", "back on the home screen, its box is empty");
        // As it is from a thread's tab, by the name at the top.
        await page.goto(site.url(`#${A.id}`));
        await page.locator(`${ID.tabs} ${CLASS.wordmark}`).click();
        await page.locator(READY_HOME_BOX).waitFor();
      },
    },
    {
      name: "the skip link goes to the open tab, and leaves it open",
      url: `#${A.id}`,
      async test(page) {
        await waitForTabToOpen(page, A.id);
        // Tab would start from the open tab, where the address points.
        await page.locator(CLASS.skip).focus();
        await page.keyboard.press("Enter");
        await page.locator(`#${A.id} :focus`).waitFor();
        assert.equal(new URL(page.url()).hash, `#${A.id}`, "the address still names the tab");
        assert.ok(await page.locator(`#${A.id}`).isVisible(), "the tab is still open");
      },
    },
    {
      name: "home: a question to start with opens a chat with the answer it names, word for word",
      url: "./",
      skip: prompt ? null : "the home screen has no questions to start with",
      async test(page) {
        if (!prompt) return;
        // /ask would fail, and isn't asked: the page knows the answer.
        const askRequests: Request[] = [];
        await askReturns(page, site.askUrl, "fail", askRequests);
        await page.locator(`${ID.top} [${DATA.prompt}="${prompt.answer}"]`).first().click();

        await page.locator(OPEN_CHAT).waitFor();
        const thread = `${OPEN_CHAT} ${CLASS.thread}`;
        assert.equal(
          await page.locator(`${thread} > ${CLASS.question}`).evaluate(lastText),
          prompt.q,
          "the chat starts with the question that was chosen",
        );
        const reply = page.locator(`${thread} > ${CLASS.answer}`);
        await reply.waitFor();
        const answerInItsTab = squash(await answerNamed(page, prompt.answer).textContent());
        assert.ok(answerInItsTab, `the page has the answer ${prompt.answer}, in its own tab`);
        assert.ok(
          squash(await reply.textContent()).startsWith(answerInItsTab),
          "the reply is that answer, word for word",
        );
        assert.equal(askRequests.length, 0, "nothing is asked of /ask: the page names the answer");
        assert.equal(
          squash(await page.locator(`${OPEN_CHAT} ${CLASS.titleText}`).textContent()),
          prompt.q,
          "the chat is named after the question",
        );
      },
    },
    {
      name: "renaming a thread: its title, its sidebar row and the window title, remembered",
      url: `#${B.id}`,
      async test(page) {
        const newName = "A thread renamed";
        const title = page.locator(`#${B.id} ${CLASS.titleText}`);
        const row = sidebarRow(page, B.id);
        await renameTab(page, B.id, newName);
        assert.equal(await title.textContent(), newName, "the tab's title is its new name");
        assert.ok((await row.textContent())?.includes(newName), "the tab's sidebar row has the new name");
        const newWindowTitle = windowTitle(newName, site);
        assert.equal(
          await settledTitle(page, (text) => text === newWindowTitle),
          newWindowTitle,
          "the window is named after the tab's new name",
        );
        await revisit(page, site.url(`#${B.id}`));
        assert.equal(await title.textContent(), newName, "the new name is there on the next visit too");

        // Renamed to nothing: its own name again.
        await renameTab(page, B.id, "");
        assert.equal(squash(await title.textContent()), B.title, "renamed to nothing, the tab has its own name again");
        assert.ok(!(await row.textContent())?.includes(newName), "the tab's sidebar row has its own name again too");
      },
    },
    {
      name: "copy link: Share, the icon under an answer and the thread's menu copy the tab's link",
      url: `#${A.id}`,
      device: { ...desktop, permissions: ["clipboard-read", "clipboard-write"] },
      async test(page) {
        const share = page.locator(`#${A.id} [${DATA.copyLink}] ${CLASS.label}`);
        const shareName = (await share.textContent()) ?? "";
        await share.click();
        await share.filter({ hasText: words.copied }).waitFor();
        assert.equal(await pasteIntoTheCard(page, A.id), site.url(`#${A.id}`), "what Share copied is the tab's link");

        // A site's threads may have no icons under their answers.
        const icon = page.locator(`#${A.id} ${CLASS.messageActions} [${DATA.copyLink}]`).first();
        if (await icon.count()) {
          await icon.click();
          await page.locator(`#${A.id} ${CLASS.messageActions} [${DATA.copyLink}]${CLASS.done}`).waitFor();
          assert.equal(await icon.getAttribute("title"), words.copied, "the icon says it copied");
        }

        await page.locator(`#${A.id} ${CLASS.titleMenuButton}`).click();
        await page.locator(`${ID.titleMenu} [${DATA.key}="${MENU_KEYS.copyLink}"]`).click();
        await page.locator(`${CLASS.toast}${CLASS.show}`).filter({ hasText: words.copied }).waitFor();
        // "Copied" doesn't stay on Share.
        await share.filter({ hasText: shareName }).waitFor({ timeout: SHARE_NAMED_AGAIN_WITHIN_MS });
      },
    },
  ];
};

/** What the home screen may greet the visitor with, around now: the
    greeting for their part of the day. */
function greetingsAroundNow(site: Site): Array<string | null> {
  return minutesAroundNow().map((at) => site.greetings[partOfDay(hourIn(VISITOR_ZONE, at), HOURS.greeting)]);
}

/** The answer an id names, where its own tab has it: for "work.2", the
    second answer in the tab "work". */
function answerNamed(page: Page, answerId: string): Locator {
  const [tab = "", nth = "1"] = answerId.split(".");
  return page.locator(`[id="${tab}"] ${CLASS.thread} > ${CLASS.answer}`).nth(Number(nth) - 1);
}

/** Pastes the clipboard into the question card's box (the card opened from
    a tab's composer), closes the card again, and says what was pasted. */
async function pasteIntoTheCard(page: Page, tab: string): Promise<string> {
  const cardBox = page.locator(`${ID.followUp} input`);
  await page.locator(`#${tab} ${CLASS.composer}`).click();
  await cardBox.focus();
  await page.keyboard.press("ControlOrMeta+V");
  const pasted = await cardBox.inputValue();
  await page.keyboard.press("Escape");
  return pasted;
}
