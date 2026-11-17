/* The contact form (src/components/ContactForm.astro, src/app/contact-form.ts),
   with /contact stood in for. With JavaScript it's sent in place, and the
   line under Send says how it went; without, the Worker's redirect brings
   the visitor back to the page, at the note that says so. With Ask on (and
   /ask stood in for), "Something else" takes a question to it. What the Worker
   does with a message has its own tests (tests/worker/contact.test.ts). */
import type { Locator, Page, Request } from "@playwright/test";
import {
  CONTACT_FIELDS,
  CONTACT_JSON,
  CONTACT_NOTE_IDS,
  type ContactNote,
  type ContactReply,
} from "../../src/contracts/contact.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import {
  ATTRIBUTE_SELECTOR as ATTRIBUTE,
  CLASS_SELECTOR as CLASS,
  ID_SELECTOR as ID,
} from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import { EMAIL_LINK, OPEN_CARD, OPEN_CHAT, openTab } from "./parts.ts";
import type { ContactForm, Site } from "./site.ts";
import { askIn, askInNewChat } from "./visitor.ts";

const EMAIL = "jane@example.org";

/** In "Something else", on a site with Ask and the form: the link that
    takes the question to the form. */
const TO_THE_FORM = `a${ATTRIBUTE.formQuestion}`;
const MESSAGE = "Hello! Are you free for a call next week?";

/** The form in its tab, and its parts. */
function formIn(page: Page, form: ContactForm) {
  const element = page.locator(`#${form.tab} ${CLASS.contactForm}`);
  const field = (name: string) => element.locator(`[name="${name}"]`);
  return {
    element,
    email: field(CONTACT_FIELDS.email),
    message: field(CONTACT_FIELDS.message),
    trap: field(CONTACT_FIELDS.trap),
    send: element.getByRole("button"),
    status: element.locator(CLASS.contactStatus),
    note: (which: ContactNote) => element.locator(`#${CONTACT_NOTE_IDS[which]}`),
  };
}

/** What /contact says: that the message went, that it didn't (with the
    status the Worker gives a refusal), or nothing at all (`unreachable`). */
type Says = ContactNote | "unreachable";

/** The status the stand-in refuses with, which the page's console notes. */
const REFUSED = 503;

/** Stands in for /contact as the Worker answers: a ContactReply to the
    page's script, which asks for one, and otherwise a redirect back to the
    page the form was on, at the note. Returns what it was sent. */
async function standIn(page: Page, form: ContactForm, says: Says): Promise<Request[]> {
  const requests: Request[] = [];
  await page.route(form.action, async (route) => {
    requests.push(route.request());
    if (says === "unreachable") return route.abort();
    if ((route.request().headers().accept ?? "").includes(CONTACT_JSON)) {
      const reply: ContactReply = { sent: says === "sent" };
      return route.fulfill({ status: says === "sent" ? 200 : REFUSED, json: reply });
    }
    const formPage = new URLSearchParams(route.request().postData() ?? "").get(CONTACT_FIELDS.page) ?? "/";
    const back = new URL(`${formPage}#${CONTACT_NOTE_IDS[says]}`, form.action).href;
    return route.fulfill({ status: 303, headers: { Location: back } });
  });
  return requests;
}

async function fillIn(page: Page, form: ContactForm): Promise<void> {
  const parts = formIn(page, form);
  await parts.email.fill(EMAIL);
  await parts.message.fill(MESSAGE);
}

test.describe("the contact form, with JavaScript", () => {
  test.beforeEach(async ({ page, site, contactForm }) => {
    await page.goto(site.pathOf(contactForm.tab));
  });

  test("Send posts the form's fields to /contact, as a form would, asking for JSON back", async ({
    page,
    contactForm,
  }) => {
    const requests = await standIn(page, contactForm, "sent");
    await fillIn(page, contactForm);
    await formIn(page, contactForm).send.click();
    await expect.poll(() => requests.length).toBe(1);
    const [request] = requests;
    expect(request?.method()).toBe("POST");
    expect(request?.headers()["content-type"]).toContain("application/x-www-form-urlencoded");
    expect(request?.headers().accept).toBe(CONTACT_JSON);
    const fields = Object.fromEntries(new URLSearchParams(request?.postData() ?? ""));
    expect(fields).toEqual({
      [CONTACT_FIELDS.page]: new URL(page.url()).pathname,
      [CONTACT_FIELDS.email]: EMAIL,
      [CONTACT_FIELDS.message]: MESSAGE,
      [CONTACT_FIELDS.trap]: "",
    });
  });

  test("once it has gone, the line under Send says so, the boxes are empty, and the tab stays open", async ({
    page,
    site,
    contactForm,
  }) => {
    await standIn(page, contactForm, "sent");
    await fillIn(page, contactForm);
    const form = formIn(page, contactForm);
    await form.send.click();
    await expect(form.status).toHaveText(contactForm.sent);
    await expect(form.email).toHaveValue("");
    await expect(form.message).toHaveValue("");
    await expect(page).toHaveURL((url) => url.pathname === site.pathOf(contactForm.tab) && url.hash === "");
    await expect(form.note("sent")).toBeHidden();
  });

  test("when it doesn't go, the line under Send says so, with a link to email instead, and what was typed stays", async ({
    page,
    contactForm,
    pageErrors,
  }) => {
    pageErrors.expected(new RegExp(`status of ${REFUSED}`));
    await standIn(page, contactForm, "failed");
    await fillIn(page, contactForm);
    const form = formIn(page, contactForm);
    await form.send.click();
    await expect(form.status).toHaveText(contactForm.failed);
    await expect(form.status.locator("a[href^='mailto:']")).toBeVisible();
    await expect(form.email).toHaveValue(EMAIL);
    await expect(form.message).toHaveValue(MESSAGE);
  });

  test("when /contact can't be reached, the line under Send says it didn't go", async ({
    page,
    contactForm,
    pageErrors,
  }) => {
    pageErrors.expected(/ERR_FAILED/);
    await standIn(page, contactForm, "unreachable");
    await fillIn(page, contactForm);
    const form = formIn(page, contactForm);
    await form.send.press("Enter");
    await expect(form.status).toHaveText(contactForm.failed);
  });

  test("a second Send while the first is on its way sends nothing more", async ({ page, contactForm }) => {
    const requests: Request[] = [];
    let answer = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    await page.route(contactForm.action, async (route) => {
      requests.push(route.request());
      await answered;
      await route.fulfill({ json: { sent: true } satisfies ContactReply });
    });
    await fillIn(page, contactForm);
    const form = formIn(page, contactForm);
    await form.send.click();
    await expect(form.element).toHaveAttribute("aria-busy", "true");
    await form.send.click();
    answer();
    await expect(form.status).toHaveText(contactForm.sent);
    expect(requests).toHaveLength(1);
  });

  test("a box left empty is the browser's to point out, and nothing is sent", async ({ page, contactForm }) => {
    const requests = await standIn(page, contactForm, "sent");
    const form = formIn(page, contactForm);
    await form.email.fill(EMAIL);
    await form.send.click();
    await expect(form.message).toBeFocused();
    await page.waitForTimeout(300);
    expect(requests).toHaveLength(0);
  });

  test("the field for bots can't be seen, and the keyboard goes from the message to Send", async ({
    page,
    contactForm,
  }) => {
    const form = formIn(page, contactForm);
    await expect(form.trap).toBeHidden();
    await form.message.focus();
    await page.keyboard.press("Tab");
    await expect(form.send).toBeFocused();
  });
});

test.describe("the contact form, after a visit without JavaScript", () => {
  test("an address at one of its notes opens the note's tab, says the note under Send, and becomes the tab's page's", async ({
    page,
    site,
    contactForm,
  }) => {
    await page.goto(`#${CONTACT_NOTE_IDS.sent}`);
    const form = formIn(page, contactForm);
    await expect(page.locator(`#${contactForm.tab}`)).toBeVisible();
    await expect(page).toHaveURL((url) => url.pathname === site.pathOf(contactForm.tab) && url.hash === "");
    await expect(form.status).toHaveText(contactForm.sent);
    await expect(form.note("sent")).toBeHidden();
  });
});

test.describe("the contact form, without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const [said, note] of [
    ["it went", "sent"],
    ["it didn't", "failed"],
  ] as const) {
    test(`Send posts the form, and the page comes back at its tab, saying ${said}`, async ({
      page,
      site,
      contactForm,
    }) => {
      await page.goto(site.pathOf(contactForm.tab));
      const requests = await standIn(page, contactForm, note);
      await fillIn(page, contactForm);
      await formIn(page, contactForm).send.click();
      await expect(page).toHaveURL(new RegExp(`#${CONTACT_NOTE_IDS[note]}$`));
      const form = formIn(page, contactForm);
      await expect(page.locator(`#${contactForm.tab}`)).toBeVisible();
      await expect(form.note(note)).toBeVisible();
      await expect(form.note(note === "sent" ? "failed" : "sent")).toBeHidden();
      await expect(page.locator(ID.home)).toBeHidden();
      expect(requests.map((request) => request.method())).toEqual(["POST"]);
    });
  }

  test("neither note shows until the address names it", async ({ page, site, contactForm }) => {
    await page.goto(site.pathOf(contactForm.tab));
    const form = formIn(page, contactForm);
    await expect(form.element).toBeVisible();
    await expect(form.note("sent")).toBeHidden();
    await expect(form.note("failed")).toBeHidden();
  });
});

test.describe("the contact form, on a phone", () => {
  test.use(A_PHONE);

  test("fits the screen, and sends", async ({ page, site, contactForm }) => {
    await page.goto(site.pathOf(contactForm.tab));
    await standIn(page, contactForm, "sent");
    const form = formIn(page, contactForm);
    const box = await form.element.boundingBox();
    const width = page.viewportSize()?.width ?? 0;
    expect(box && box.x >= 0 && box.x + box.width <= width).toBe(true);
    await fillIn(page, contactForm);
    await form.send.tap();
    await expect(form.status).toHaveText(contactForm.sent);
  });
});

test.describe("a question Ask has no answer for, on a site with the contact form", () => {
  test.skip(({ site }) => !site.ask, "Ask is off");

  const TO_OWNER = "Do you know testing?";
  const typedIn = (site: Site): string => `Does ${site.name} know testing?`;

  /** The link in the open chat's reply that takes the question to the form. */
  const linkToTheForm = (page: Page): Locator => page.locator(`${OPEN_CHAT} ${CLASS.thread} ${TO_THE_FORM}`);

  test("the reply's first link offers to send it with the form, and goes to the form's tab's page", async ({
    page,
    site,
    ask,
    contactForm,
  }) => {
    await ask.returns({ id: null, toOwner: TO_OWNER });
    await page.goto("./");
    await askInNewChat(page, typedIn(site));
    const reply = page.locator(`${OPEN_CHAT} ${CLASS.thread} > ${CLASS.answer}`).last();
    await expect(reply.locator("a").first()).toHaveAttribute(DATA.formQuestion, TO_OWNER);
    await expect(linkToTheForm(page)).toHaveAttribute("href", site.pathOf(contactForm.tab));
  });

  for (const [what, reply, inTheBox] of [
    ["as it's said to the owner", { id: null, toOwner: TO_OWNER }, () => TO_OWNER],
    ["as it was typed, when /ask said it to no one", { id: null }, typedIn],
  ] as const) {
    test(`following it opens the form's tab with the question ${what} in the message box, and the cursor in the email box, and sends nothing`, async ({
      page,
      site,
      ask,
      contactForm,
    }) => {
      const sent = await standIn(page, contactForm, "sent");
      await ask.returns(reply);
      await page.goto("./");
      await askInNewChat(page, typedIn(site));
      await linkToTheForm(page).click();
      const form = formIn(page, contactForm);
      await expect(openTab(page, contactForm.tab)).toBeVisible();
      await expect(page).toHaveURL((url) => url.pathname === site.pathOf(contactForm.tab));
      await expect(form.message).toHaveValue(inTheBox(site));
      await expect(form.email).toBeFocused();
      await page.waitForTimeout(300);
      expect(sent).toHaveLength(0);
    });
  }

  test("what the visitor had typed in the message box stays, with the question after it", async ({
    page,
    site,
    ask,
    contactForm,
  }) => {
    await ask.returns({ id: null, toOwner: TO_OWNER });
    await page.goto(site.pathOf(contactForm.tab));
    await formIn(page, contactForm).message.fill(MESSAGE);
    await askInNewChat(page, typedIn(site));
    await linkToTheForm(page).click();
    await expect(formIn(page, contactForm).message).toHaveValue(`${MESSAGE}\n\n${TO_OWNER}`);
  });

  test("asked in the form's own tab, following it fills the form below", async ({ page, site, ask, contactForm }) => {
    await ask.returns({ id: null, toOwner: TO_OWNER });
    await page.goto(site.pathOf(contactForm.tab));
    await askIn(page, contactForm.tab, typedIn(site));
    await page.locator(`#${contactForm.tab} ${CLASS.thread} ${TO_THE_FORM}`).click();
    const form = formIn(page, contactForm);
    await expect(form.message).toHaveValue(TO_OWNER);
    await expect(form.email).toBeFocused();
  });

  test("a blocked visitor is offered no form, as they're offered no message", async ({ page, site, ask }) => {
    await ask.returns({ blocked: true });
    await page.goto("./");
    await askInNewChat(page, typedIn(site));
    await expect(page.locator(`${OPEN_CHAT} ${EMAIL_LINK}`)).toBeVisible();
    await expect(linkToTheForm(page)).toHaveCount(0);
  });

  test.describe("on a phone", () => {
    test.use(A_PHONE);

    test("following it opens the form's tab with the question in, and the cursor in the email box", async ({
      page,
      site,
      ask,
      contactForm,
    }) => {
      await ask.returns({ id: null, toOwner: TO_OWNER });
      await page.goto("./");
      await page.locator(`${OPEN_CARD} input`).tap();
      await page.keyboard.type(typedIn(site));
      await page.keyboard.press("Enter");
      await linkToTheForm(page).tap();
      const form = formIn(page, contactForm);
      await expect(form.message).toHaveValue(TO_OWNER);
      await expect(form.email).toBeFocused();
      await expect(form.email).toBeInViewport();
    });
  });
});

test.describe("a question typed in, on a site without the contact form", () => {
  test.skip(({ site }) => site.contactForm !== null, "the site has the contact form");

  test('gets the "Something else" reply as it was: its links are the tab\'s, and none goes to a form', async ({
    page,
    site,
    ask,
  }) => {
    if (site.ask) await ask.returns({ id: null });
    await page.goto("./");
    await askInNewChat(page, "Are you free next month?");
    const reply = page.locator(`${OPEN_CHAT} ${CLASS.thread} > ${CLASS.answer}`).last();
    await expect(reply.locator(EMAIL_LINK)).toBeVisible();
    await expect(page.locator(TO_THE_FORM)).toHaveCount(0);
    const linksIn = (answer: Locator) =>
      answer.locator(":scope > a").evaluateAll((links) => links.map((link) => link.className));
    expect(await linksIn(reply)).toEqual(await linksIn(page.locator(`${ID.asked} ${CLASS.answer}`)));
  });
});
