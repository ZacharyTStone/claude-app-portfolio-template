/* A short message at the bottom of the screen ("Copied"). */
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { TIMING } from "./constants.ts";
import { make } from "./lib/dom.ts";
import { words } from "./page.ts";

// A status, so screen readers say each message as it shows.
const toast = make("div", { class: PAGE_CLASSES.toast, role: "status" });
/** The timer that hides the message that's showing. */
let hideTimer = 0;

/** Puts the toast in the page, empty and out of sight until something's said. */
export function initToast(): void {
  document.body.append(toast);
}

/** Shows a message for TIMING.toast, in place of one that's still showing. */
export function say(message: string): void {
  toast.textContent = message;
  toast.classList.add(PAGE_CLASSES.show);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => toast.classList.remove(PAGE_CLASSES.show), TIMING.toast);
}

/** Says whether something was copied. */
export const sayCopied = (wasCopied: boolean): void => say(wasCopied ? words.copied : words.copyFailed);
