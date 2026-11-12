/* Share and copy. "Share" opens the phone's share sheet where there is one;
   elsewhere it, and the copy icon under each answer, copy the tab's link.
   A "Something else" reply's LinkedIn message has its own copy button. */
import { CLASS, SELECTOR, TIMING } from "./constants.ts";
import { copyText } from "./lib/clipboard.ts";
import { closestFrom } from "./lib/dom.ts";
import { words } from "./page.ts";
import { tabLink } from "./tabs.ts";
import { sayCopied } from "./toast.ts";

/** A screen that's touched, not pointed at with a mouse: a phone or a tablet. */
const touchScreen = matchMedia("(pointer: coarse)");

/** Offers a link to the phone's share sheet. True when that settles it: it
    was shared, or the visitor closed the sheet. False when the sheet
    couldn't take it, and the link is to be copied instead. */
async function shareBySheet(url: string): Promise<boolean> {
  try {
    await navigator.share({ title: document.title, url });
    return true;
  } catch (error) {
    const closedTheSheet = error instanceof DOMException && error.name === "AbortError";
    return closedTheSheet;
  }
}

/** Shows on a button whether its link was copied, for TIMING.copied. */
type ShowCopyResult = (wasCopied: boolean) => void;

/** A share button shows it in place of its words. */
function resultInLabel(label: Element): ShowCopyResult {
  // Its own words are read once, now: a second click can come while it
  // still says "Copied".
  const ownWords = label.textContent;
  return (wasCopied) => {
    label.textContent = wasCopied ? words.copied : words.copyFailed;
    setTimeout(() => (label.textContent = ownWords), TIMING.copied);
  };
}

/** A copy icon shows it in its tooltip, and as a tick if it was copied. */
function resultInTooltip(button: HTMLElement): ShowCopyResult {
  const ownTooltip = button.title;
  return (wasCopied) => {
    button.title = wasCopied ? words.copied : words.copyFailed;
    button.classList.toggle(CLASS.done, wasCopied);
    setTimeout(() => {
      button.title = ownTooltip;
      button.classList.remove(CLASS.done);
    }, TIMING.copied);
  };
}

/** A share or copy-link button in `tab`. A share button has words (its
    label) and tries the share sheet first; a copy icon has none, and only
    copies. */
export function wireCopy(button: HTMLElement, tab: HTMLElement): void {
  const label = button.querySelector(SELECTOR.label);
  const showCopyResult = label ? resultInLabel(label) : resultInTooltip(button);
  button.addEventListener("click", async () => {
    const url = tabLink(tab);
    const hasShareSheet = Boolean(navigator.share) && touchScreen.matches;
    if (label && hasShareSheet && (await shareBySheet(url))) return;
    showCopyResult(await copyText(url));
  });
}

/** The copy button on a LinkedIn message, wherever a reply has been sent:
    listened for on the document, as each reply brings a button of its own. */
export function initCopyDraft(): void {
  document.addEventListener("click", async (event) => {
    const copyButton = closestFrom(event.target, SELECTOR.copyDraft);
    const draft = copyButton?.closest(SELECTOR.draft)?.querySelector(SELECTOR.draftText);
    if (draft) sayCopied(await copyText(draft.textContent));
  });
}
