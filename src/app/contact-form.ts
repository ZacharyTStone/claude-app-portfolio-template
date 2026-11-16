/* The contact form (src/components/ContactForm.astro). Without JavaScript it's
   a plain POST, which the Worker answers by sending the visitor back to the
   page at the note that says how it went. Here it's sent with fetch instead,
   and that note is said in place, under Send: the visitor stays in the tab,
   and what they typed stays there until it has gone. A copy of the form in
   a chat (a thread's answers sent there) is sent the same way. */
import { CONTACT_JSON, CONTACT_NOTE_IDS, isSent, type ContactNote } from "../contracts/contact.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { clone, closestFrom, find } from "./lib/dom.ts";

/** Longer than the Worker takes to send an email. */
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
  sayTheNoteTheAddressNames();
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

/** Whether the Worker says the message went. A reply it can't read, or
    none, says it didn't. */
async function post(form: HTMLFormElement): Promise<boolean> {
  const fields = [...new FormData(form)].map(([name, value]) => [name, typeof value === "string" ? value : ""]);
  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { Accept: CONTACT_JSON },
      body: new URLSearchParams(fields),
      credentials: "omit",
      signal: AbortSignal.timeout(CONTACT_TIMEOUT_MS),
    });
    return response.ok && isSent(await response.json());
  } catch {
    return false;
  }
}

/** Says one of the form's notes in the line under Send, link and all. */
function say(form: Element, note: Element): void {
  find(form, CLASS_SELECTOR.contactStatus).replaceChildren(...clone(note).childNodes);
}

/** A visitor the Worker sent back to a note (they sent the form before
    this script ran) is in the note's tab: the line under Send says the
    note, and the address is the tab's, as any open tab's is. */
function sayTheNoteTheAddressNames(): void {
  const named = location.hash.slice(1);
  if (!Object.values(CONTACT_NOTE_IDS).includes(named)) return;
  const note = document.getElementById(named);
  const form = note?.closest(CLASS_SELECTOR.contactForm);
  const tab = note?.closest(CLASS_SELECTOR.tab);
  if (!note || !form || !tab) return;
  say(form, note);
  location.replace(`#${tab.id}`);
}
