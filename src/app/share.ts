/* Share and copy. "Share" opens the phone's share sheet where there is one;
   elsewhere it, and the copy icon under each answer, copy the tab's link.
   A "Something else" reply's LinkedIn message has its own copy button. */
import { CLASS, SELECTOR, TIMING } from "./constants.ts";
import { copyText } from "./lib/clipboard.ts";
import { words } from "./page.ts";
import { tabLink } from "./tabs.ts";
import { sayCopied } from "./toast.ts";

/** A share or copy-link button in `tab`. */
export function wireCopy(button: HTMLElement, tab: HTMLElement): void {
  const label = button.querySelector(SELECTOR.label);
  const text = label?.textContent ?? "";
  const title = button.title;
  button.addEventListener("click", async () => {
    const url = tabLink(tab);
    if (label && navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: document.title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return; // closed the share sheet
      }
    }
    const ok = await copyText(url);
    const done = ok ? words.copied : words.copyFailed;
    if (label) label.textContent = done;
    else {
      button.title = done;
      button.classList.toggle(CLASS.done, ok);
    }
    setTimeout(() => {
      if (label) label.textContent = text;
      else {
        button.title = title;
        button.classList.remove(CLASS.done);
      }
    }, TIMING.copied);
  });
}

/** The copy button on a LinkedIn message, wherever a reply has been sent. */
export function initCopyDraft(): void {
  document.addEventListener("click", async (event) => {
    const button = event.target instanceof Element ? event.target.closest(SELECTOR.copyDraft) : null;
    const draft = button?.closest(SELECTOR.draft)?.querySelector(SELECTOR.draftText);
    if (draft) sayCopied(await copyText(draft.textContent));
  });
}
