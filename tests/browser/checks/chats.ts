/* Chats (new tabs, kept for the visit) and the menus: a thread's, a row's
   and the account's. */
import assert from "node:assert/strict";
import {
  askInNewChat,
  askReturns,
  hourIn,
  iPhone,
  moments,
  offsetIn,
  OPEN_CHAT,
  revisit,
  settledTitle,
  skip,
  squash,
  VISITOR_ZONE,
  waitForNoHash,
  type Attributed,
  type Check,
} from "../helpers.ts";
import {
  CHATS_GROUP,
  DATA,
  groupId,
  HOURS,
  partOfDay,
  LOCAL_ZONE,
  MENU_KEYS,
  PAGE_CLASSES,
  SEPARATOR,
} from "../../../src/shared/page-data.ts";
import { CLASS, ID, type Site } from "../site.ts";

export default (site: Site): Check[] => {
  const { A, B, C, words, askUrl } = site;
  return [
    {
      name: "menus by keyboard: the thread's menu, Jump to ›, a row's letter, Escape",
      url: `#${A.id}`,
      async test(page) {
        const chevron = page.locator(`#${A.id} ${CLASS.titleMenuButton}`);
        const menu = page.locator(ID.titleMenu);
        const focused = page.locator(":focus");
        await chevron.focus();
        await page.keyboard.press("Enter");
        await menu.waitFor();
        assert.equal(await focused.getAttribute(DATA.key), MENU_KEYS.rename, "Rename first");
        await page.keyboard.press("ArrowDown");
        assert.equal(await focused.getAttribute(DATA.key), MENU_KEYS.copyLink, "then Copy link");
        await page.keyboard.press("End");
        assert.equal(await focused.getAttribute("aria-haspopup"), "menu", "Jump to › last");
        await page.keyboard.press("ArrowRight");
        const sub = menu.locator(CLASS.submenu);
        await sub.waitFor();
        assert.deepEqual(await sub.locator('[role="menuitem"]').allTextContents(), A.questions);
        assert.equal(squash(await focused.textContent()), A.questions[0]);
        await page.keyboard.press("ArrowLeft");
        assert.ok(await sub.isHidden());
        assert.equal(await focused.getAttribute("aria-haspopup"), "menu");
        await page.keyboard.press("Escape");
        assert.ok(await menu.isHidden());
        assert.equal(await chevron.getAttribute("aria-expanded"), "false");
        assert.equal(
          await page.locator(`#${A.id} ${CLASS.titleMenuButton}:focus`).count(),
          1,
          "focus back on the chevron",
        );
        // A row's letter picks it: R renames.
        await page.keyboard.press("Enter");
        await page.keyboard.press(MENU_KEYS.rename);
        const input = page.locator(`#${A.id} ${CLASS.titleInput}:focus`);
        await input.waitFor();
        assert.equal(await input.inputValue(), A.title);
        await page.keyboard.press("Escape");
        assert.equal(await page.locator(`#${A.id} ${CLASS.titleInput}`).count(), 0);
        assert.equal(squash(await page.locator(`#${A.id} ${CLASS.titleText}`).textContent()), A.title);
      },
    },
    {
      name: "a chat: listed once something's sent, there on the next visit, gone after a refresh, deleted from its menu",
      url: "./",
      async test(page) {
        await askReturns(page, askUrl, { id: null });
        const newChat = async (question: string) => {
          await askInNewChat(page, question);
          await page.locator(`${OPEN_CHAT} ${CLASS.thread} ${CLASS.answer} [${DATA.mail}]`).waitFor();
        };
        const group = page.locator(`#${groupId(CHATS_GROUP)}`);
        const rows = page.locator(`#${groupId(CHATS_GROUP)} + ul a`);
        await newChat("A question for a chat");
        assert.deepEqual(await rows.locator(CLASS.rowName).allTextContents(), ["A question for a chat"]);
        await revisit(page, site.url("./"));
        await rows.first().click();
        const chat = page.locator(OPEN_CHAT);
        await chat
          .locator(`${CLASS.thread} > ${CLASS.question}`)
          .filter({ hasText: "A question for a chat" })
          .waitFor();
        assert.ok(await chat.locator(`${CLASS.thread} ${CLASS.answer} [${DATA.mail}]`).count(), "with its reply");
        const chatTitle = `A question for a chat${SEPARATOR}${site.name}`;
        assert.equal(await settledTitle(page, (text) => text === chatTitle), chatTitle);
        // Deleted from its row's "…".
        await rows.first().hover();
        await page
          .locator(`#${groupId(CHATS_GROUP)} + ul ${CLASS.rowMore}`)
          .first()
          .click();
        await page.locator(`${ID.rowMenu} [${DATA.key}="${MENU_KEYS.delete}"]`).click();
        await page.locator(`${CLASS.toast}${CLASS.show}`).filter({ hasText: words.chatDeleted }).waitFor();
        assert.equal(await group.count(), 0);
        await waitForNoHash(page);
        // A refresh starts over: the chat goes, and so its address leads home.
        await newChat("Another question");
        assert.equal(await rows.count(), 1);
        await page.reload();
        await page.locator(ID.hello).waitFor();
        assert.equal(await group.count(), 0);
        await waitForNoHash(page);
      },
    },
    {
      name: '"New tab" clicked in a new chat leaves its question card open',
      url: "./",
      async test(page) {
        const card = page.locator(ID.followUp);
        const newTab = page.locator(`${CLASS.nav} ${CLASS.newTab}`);
        // The first opens the chat, and its card once it's open.
        await newTab.click();
        await card.waitFor();
        // In it, a click is done with by the time it returns.
        for (const click of ["second", "third"]) {
          await newTab.click();
          assert.ok(await card.isVisible(), `after the ${click} click`);
        }
      },
    },
    {
      name: 'on a phone, "New tab" and the name in the drawer leave the new chat\'s card open',
      url: "./",
      device: iPhone,
      async test(page) {
        const card = page.locator(ID.followUp);
        const chat = page.locator(OPEN_CHAT);
        await card.waitFor();
        for (const row of [`${CLASS.nav} ${CLASS.newTab}`, CLASS.wordmark]) {
          await chat.locator(CLASS.menu).click();
          await page.locator(`${ID.tabs}${CLASS.drawerOpen} ${row}`).click();
          await chat.waitFor();
          assert.ok(await card.isVisible(), `after ${row}`);
        }
      },
    },
    {
      name: "focus goes back where it was when a menu row is chosen, or the card sends what's chosen",
      url: `#${A.id}`,
      async test(page) {
        const chevron = page.locator(`#${A.id} ${CLASS.titleMenuButton}`);
        await chevron.click();
        await page.locator(`${ID.titleMenu} [${DATA.key}="${MENU_KEYS.copyLink}"]`).click();
        await page.locator(`#${A.id} ${CLASS.titleMenuButton}:focus`).waitFor();
        await chevron.click();
        await page.locator(`${ID.titleMenu} [aria-haspopup="menu"]`).click();
        await page.locator(`${ID.titleMenu} ${CLASS.submenu} [role="menuitem"]`).first().click();
        await page.locator(`#${A.id} ${CLASS.titleMenuButton}:focus`).waitFor();
        // In a chat, a choice from the card is sent, and the card closes onto
        // the composer.
        await askReturns(page, askUrl, { id: null });
        await askInNewChat(page, "Where does focus go?");
        await page.locator(`${OPEN_CHAT} ${CLASS.composer}:focus`).waitFor();
      },
    },
    {
      name: "Enter or Escape on a word still being composed (Japanese) doesn't rename, or close the card",
      url: `#${A.id}`,
      async test(page) {
        const composing = { isComposing: true, keyCode: 229 };
        await page.locator(`#${A.id} ${CLASS.titleButton}`).click();
        const input = page.locator(`#${A.id} ${CLASS.titleInput}`);
        await input.fill("にほn");
        await input.dispatchEvent("keydown", { key: "Enter", ...composing });
        await input.dispatchEvent("keydown", { key: "Escape", ...composing });
        assert.equal(await input.count(), 1, "still renaming");
        await page.keyboard.press("Escape");
        await page.locator(`#${A.id} ${CLASS.composer}`).click();
        const box = page.locator(`${ID.followUp} input`);
        await box.focus();
        await box.dispatchEvent("keydown", { key: "Escape", ...composing });
        assert.ok(await page.locator(ID.followUp).isVisible(), "the card is still open");
      },
    },
    {
      name: "two windows don't undo each other's chats or names",
      url: "./",
      skip: B.id === A.id ? "the site has one thread" : null,
      async test(page) {
        const other = await page.context().newPage();
        await other.goto(site.url("./"));
        for (const [window, question] of [
          [page, "From the first window"],
          [other, "From the second window"],
        ] as const) {
          await askReturns(window, askUrl, { id: null });
          await askInNewChat(window, question);
          await window.locator(`${OPEN_CHAT} ${CLASS.thread} ${CLASS.answer} [${DATA.mail}]`).waitFor();
        }
        for (const [window, { id }] of [
          [page, A],
          [other, B],
        ] as const) {
          await window.locator(`${ID.tabs} a[href="#${id}"]`).first().click();
          await window.locator(`#${id} ${CLASS.titleButton}`).click();
          await window.keyboard.press("ControlOrMeta+A");
          await window.keyboard.type(`Renamed in a window`);
          await window.keyboard.press("Enter");
        }
        await other.close();
        await revisit(page, site.url("./"));
        const rows = page.locator(`#${groupId(CHATS_GROUP)} + ul a ${CLASS.rowName}`);
        assert.deepEqual((await rows.allTextContents()).sort(), ["From the first window", "From the second window"]);
        for (const { id } of [A, B]) {
          assert.equal(await page.locator(`#${id} ${CLASS.titleText}`).textContent(), "Renamed in a window");
        }
      },
    },
    {
      name: "a menu's submenu closes with it: the languages are those of the tab that's open",
      url: `#${A.id}`,
      skip: !site.languages.length ? "the site is in one language" : !C ? "the sidebar has one thread" : null,
      async test(page) {
        // Another language beside the site's own, so the account menu has a
        // submenu of them.
        const home = site.url("./");
        await page.route(home, async (route) => {
          const html = await (await route.fetch()).text();
          const start = html.indexOf(">", html.indexOf(`class="${PAGE_CLASSES.lang}"`)) + 1;
          const link = html.slice(start, html.indexOf("</a>", start) + "</a>".length);
          const extra = link.replace(/hreflang="[^"]*"/, 'hreflang="xx"').replace(/href="[^"]*"/, 'href="/xx/"');
          await route.fulfill({ response: await route.fetch(), body: html.replace(link, link + extra) });
        });
        await revisit(page, site.url(`#${A.id}`));
        const menu = page.locator(ID.accountMenu);
        const sub = menu.locator(CLASS.submenu);
        await page.locator(CLASS.me).click();
        await menu.locator('[aria-haspopup="menu"]').focus();
        await page.keyboard.press("ArrowRight");
        await sub.waitFor();
        await page.keyboard.press("Tab");
        await page.locator(`${ID.tabs} a[href="#${C?.id}"]`).first().click();
        await page.locator(`#${C?.id}:target`).waitFor();
        await page.locator(CLASS.me).click();
        assert.ok(await sub.isHidden(), "closed with the menu");
        await menu.locator('[aria-haspopup="menu"]').focus();
        await page.keyboard.press("ArrowRight");
        await sub.waitFor();
        const hrefs = await sub.locator("a").evaluateAll((all: Attributed[]) => all.map((a) => a.getAttribute("href")));
        assert.ok(hrefs.length > 1 && hrefs.every((href) => href?.endsWith(`#${C?.id}`)), hrefs.join(", "));
      },
    },
    {
      name: "a refresh keeps the tab that's open",
      url: `#${A.id}`,
      async test(page) {
        await page.locator(`#${A.id}:target`).waitFor();
        await page.reload();
        await page.locator(`#${A.id}:target`).waitFor();
        assert.equal(new URL(page.url()).hash, `#${A.id}`);
        const title = `${A.title}${SEPARATOR}${site.name}`;
        assert.equal(await settledTitle(page, (text) => text === title), title);
      },
    },
    {
      name: "the account menu: the time where you are, the language row keeping the tab, and Log out",
      url: `#${A.id}`,
      async test(page) {
        const me = page.locator(CLASS.me);
        const menu = page.locator(ID.accountMenu);
        await me.click();
        await menu.waitFor();
        // The arrow keys pass over the clock, which can't be chosen.
        for (let row = 0; row < 3; row++) {
          await page.keyboard.press("ArrowDown");
          assert.equal(await menu.locator('[aria-disabled="true"]:focus').count(), 0, "the clock has focus");
        }
        const { clock } = site;
        if (!clock) skip("the account menu's clock", "there's no clock in it");
        else {
          const notes = moments().map((at) => {
            const gap = (offsetIn(clock.zone, at) - offsetIn(VISITOR_ZONE, at)) / 60;
            const away =
              gap === 0 ? clock.same : (gap > 0 ? clock.ahead : clock.behind).replace("{n}", String(Math.abs(gap)));
            const mood = partOfDay(hourIn(clock.zone, at), HOURS.mood);
            return `${away}${SEPARATOR}${clock.moods[mood]}`;
          });
          assert.ok(
            notes.includes((await menu.locator(CLASS.clockNote).textContent()) ?? ""),
            "how far apart, and the mood",
          );
          const local = new Intl.DateTimeFormat(site.lang, {
            timeZone: VISITOR_ZONE,
            hour: "numeric",
            minute: "2-digit",
          });
          const times = moments().map((at) => squash(local.format(at)));
          assert.ok(
            times.includes(squash(await menu.locator(`[${DATA.zone}="${LOCAL_ZONE}"]`).textContent())),
            "the visitor's time",
          );
        }
        if (site.languages.length === 1) {
          assert.equal(await menu.locator(`[${DATA.langLink}]`).getAttribute("href"), `${site.languageLink}#${A.id}`);
        } else if (site.languages.length > 1) {
          await menu.locator('[aria-haspopup="menu"]').click();
          const links = menu.locator(`${CLASS.submenu} a`);
          const hrefs = await links.evaluateAll((all: Attributed[]) => all.map((a) => a.getAttribute("href")));
          assert.deepEqual(
            hrefs,
            site.languages.map((language) => `${language.href}#${A.id}`),
          );
        }
        await page.keyboard.press("Escape");
        assert.ok(await menu.isHidden());
        assert.equal(await page.locator(`${CLASS.me}:focus`).count(), 1);
        // "Log out" really does, and "Log back in" goes home.
        await me.click();
        await menu.locator(`[${DATA.logout}]`).click();
        const bye = page.locator('.bye[role="dialog"]');
        await bye.waitFor();
        assert.ok((await bye.locator(`${CLASS.byeLinks} a`).count()) > 0, "with ways to get in touch");
        assert.equal(await page.locator(ID.tabs).locator("..").getAttribute("inert"), "");
        // Tab stays in the goodbye: the page behind it, skip link and all,
        // can't be reached.
        for (let press = 0; press < 8; press++) {
          await page.keyboard.press("Tab");
          assert.equal(await page.locator(`${CLASS.skip}:focus`).count(), 0, "the skip link has focus");
        }
        await bye.locator(CLASS.byeBack).click();
        assert.equal(await bye.count(), 0);
        assert.equal(await page.locator(ID.tabs).locator("..").getAttribute("inert"), null);
        await waitForNoHash(page);
      },
    },
  ];
};
