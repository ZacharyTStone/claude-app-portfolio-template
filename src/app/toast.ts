/* A short message at the bottom of the screen ("Copied"). */
import { CLASS, TIMING } from "./constants.ts";
import { make } from "./lib/dom.ts";
import { words } from "./page.ts";

const toast = make("div", { class: CLASS.toast, role: "status" });
let timer = 0;

export function initToast(): void {
  document.body.append(toast);
}

export function say(message: string): void {
  toast.textContent = message;
  toast.classList.add(CLASS.show);
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove(CLASS.show), TIMING.toast);
}

/** Says whether something was copied. */
export const sayCopied = (ok: boolean): void => say(ok ? words.copied : words.copyFailed);
