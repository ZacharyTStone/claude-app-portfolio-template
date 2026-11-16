/* The contact form (src/components/ContactForm.astro, src/app/contact-form.ts),
   with /contact stood in for. With JavaScript it's sent in place, and the
   line under Send says how it went; without, the Worker's redirect brings
   the visitor back to the page, at the note that says so. What the Worker
   does with a message has its own tests (tests/worker/contact.test.ts). */
import type { Page, Request } from "@playwright/test";
import {
  CONTACT_FIELDS,
  CONTACT_JSON,
  CONTACT_NOTE_IDS,
  type ContactNote,
  type ContactReply,
} from "../../src/contracts/contact.ts";
import { CLASS_SELECTOR as CLASS, ID_SELECTOR as ID } from "../../src/contracts/page-selectors.ts";
import { A_PHONE, expect, test } from "./fixtures.ts";
import type { ContactForm } from "./site.ts";

const EMAIL = "jane@example.org";
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
  test.beforeEach(async ({ page, contactForm }) => {
    await page.goto(`#${contactForm.tab}`);
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
    contactForm,
  }) => {
    await standIn(page, contactForm, "sent");
    await fillIn(page, contactForm);
    const form = formIn(page, contactForm);
    await form.send.click();
    await expect(form.status).toHaveText(contactForm.sent);
    await expect(form.email).toHaveValue("");
    await expect(form.message).toHaveValue("");
    await expect(page).toHaveURL(new RegExp(`#${contactForm.tab}$`));
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
  test("an address at one of its notes opens the note's tab, says the note under Send, and becomes the tab's", async ({
    page,
    contactForm,
  }) => {
    await page.goto(`#${CONTACT_NOTE_IDS.sent}`);
    const form = formIn(page, contactForm);
    await expect(page.locator(`#${contactForm.tab}`)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#${contactForm.tab}$`));
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
    test(`Send posts the form, and the page comes back at its tab, saying ${said}`, async ({ page, contactForm }) => {
      await page.goto(`#${contactForm.tab}`);
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

  test("neither note shows until the address names it", async ({ page, contactForm }) => {
    await page.goto(`#${contactForm.tab}`);
    const form = formIn(page, contactForm);
    await expect(form.element).toBeVisible();
    await expect(form.note("sent")).toBeHidden();
    await expect(form.note("failed")).toBeHidden();
  });
});

test.describe("the contact form, on a phone", () => {
  test.use(A_PHONE);

  test("fits the screen, and sends", async ({ page, contactForm }) => {
    await page.goto(`#${contactForm.tab}`);
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
