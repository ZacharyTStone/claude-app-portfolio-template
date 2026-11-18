/* The contact form (src/components/ContactForm.astro). Without JavaScript it's
   a plain POST, which the Worker answers by sending the visitor back to the
   page at the note that says how it went; on Netlify, Netlify Forms answers
   with the page itself, at the note that says it went. Here it's sent with
   fetch instead, to the same address, and that note is said in place, under
   Send: the visitor stays in the tab, and what they typed stays there until
   it has gone. A copy of the form in a chat (a thread's answers sent there)
   is sent the same way. On a site with Ask, "Something else" links to the
   form's tab, and this takes the visitor's question there, into the message
   box. */
import {
  CONTACT_FIELDS,
  CONTACT_JSON,
  CONTACT_NOTE_IDS,
  CONTACT_RECEIVERS,
  isSent,
  type ContactNote,
  type ContactReceiver,
} from "../contracts/contact.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { clone, closestFrom, find, isPlainClick } from "./lib/dom.ts";
import { go } from "./address.ts";
import { messageWithQuestion } from "./contact-message.ts";
import { openTab } from "./navigation.ts";
import { addressOf, tabLinkedTo } from "./tabs.ts";

/** Longer than the Worker takes to send an email, or Netlify to take one. */
const CONTACT_TIMEOUT_MS = 15_000;

/** What a form is marked with while it's being sent: another Send does
    nothing until it has. */
const BUSY = "aria-busy";

export function initContactForm(): void {
  document.addEventListener("submit", (event) => {
    const form = closestFrom(event.target, CLASS_SELECTOR.contactForm);
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();
    void send(form);
  });
  // Before the address is followed, whose own handler would open the tab
  // without the question.
  document.addEventListener("click", takeQuestionToTheForm);
  sayTheNoteTheAddressNames();
}

/** A plain click on "Something else"'s link to the form opens the form's
    tab in place, puts the question in the message box and the cursor in
    the email box, the one left to fill. The visitor sends it themselves.
    Any other click opens the tab's page, as a link does. */
function takeQuestionToTheForm(event: MouseEvent): void {
  if (event.defaultPrevented || !isPlainClick(event)) return;
  const link = closestFrom(event.target, `a${ATTRIBUTE_SELECTOR.formQuestion}`);
  const tab = link instanceof HTMLAnchorElement ? tabLinkedTo(link.href) : null;
  const form = tab?.querySelector(CLASS_SELECTOR.contactForm);
  if (!link || !tab || !(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const question = link.getAttribute(DATA.formQuestion) ?? "";
  openTab(tab, () => fillIn(form, question));
}

function fillIn(form: HTMLFormElement, question: string): void {
  const message = form.elements.namedItem(CONTACT_FIELDS.message);
  if (message instanceof HTMLTextAreaElement) message.value = messageWithQuestion(message.value, question);
  const email = form.elements.namedItem(CONTACT_FIELDS.email);
  if (email instanceof HTMLInputElement) email.focus();
}

async function send(form: HTMLFormElement): Promise<void> {
  if (form.getAttribute(BUSY) === "true") return;
  form.setAttribute(BUSY, "true");
  // Emptied first, so that the same note said twice is heard twice.
  find(form, CLASS_SELECTOR.contactStatus).replaceChildren();
  const note: ContactNote = (await post(form)) ? "sent" : "failed";
  if (note === "sent") form.reset();
  say(form, find(form, `[${DATA.contactNote}="${note}"]`));
  form.removeAttribute(BUSY);
}

/** Who takes the form's messages, as the form says: the Worker, unless
    it says otherwise. */
const receiverOf = (form: HTMLFormElement): ContactReceiver =>
  CONTACT_RECEIVERS.find((receiver) => receiver === form.getAttribute(DATA.contactReceiver)) ?? "worker";

/** Whether the message went: the Worker says so in a ContactReply, and
    Netlify by answering at all (with a page, which isn't read). A reply that
    isn't a 2xx, one the Worker's can't be read as, or none, says it didn't.
    The form's address may end at a note, which a request never carries. */
async function post(form: HTMLFormElement): Promise<boolean> {
  const receiver = receiverOf(form);
  const fields = [...new FormData(form)].map(([name, value]) => [name, typeof value === "string" ? value : ""]);
  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: receiver === "worker" ? { Accept: CONTACT_JSON } : {},
      body: new URLSearchParams(fields),
      credentials: "omit",
      signal: AbortSignal.timeout(CONTACT_TIMEOUT_MS),
    });
    return response.ok && (receiver === "netlify" || isSent(await response.json()));
  } catch {
    return false;
  }
}

/** Says one of the form's notes in the line under Send, link and all. */
function say(form: Element, note: Element): void {
  find(form, CLASS_SELECTOR.contactStatus).replaceChildren(...clone(note).childNodes);
}

/** A visitor the Worker sent back to a note, or Netlify answered at one
    (they sent the form before this script ran), is in the note's tab: the
    line under Send says the note, and the address is the tab's own page's,
    as any open tab's is, in place of the one it came back to. */
function sayTheNoteTheAddressNames(): void {
  const named = location.hash.slice(1);
  if (!Object.values(CONTACT_NOTE_IDS).includes(named)) return;
  const note = document.getElementById(named);
  const form = note?.closest(CLASS_SELECTOR.contactForm);
  const tab = note?.closest(CLASS_SELECTOR.tab);
  if (!note || !form || !tab) return;
  say(form, note);
  go(addressOf(tab.id), true);
}
