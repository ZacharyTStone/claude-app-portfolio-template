/* A short message at the bottom of the screen ("Copied"). */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { make } from "./lib/dom.ts";
import { words } from "./page.ts";

const SHOWS_FOR_MS = 3200;

// A status, so screen readers say each message as it shows.
const toast = make("div", { class: PAGE_CLASSES.toast, role: "status" });
let hideTimer = 0;

/** Puts the toast in the page, empty and out of sight until something's said. */
export function initToast(): void {
  document.body.append(toast);
}

/** Shows a message, in place of one that's still showing. */
export function say(message: string): void {
  toast.textContent = message;
  toast.classList.add(PAGE_CLASSES.show);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.remove(PAGE_CLASSES.show), SHOWS_FOR_MS);
}

export const sayCopied = (wasCopied: boolean): void => say(wasCopied ? words.copied : words.copyFailed);
