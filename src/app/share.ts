/* Share and copy. "Share" opens the phone's share sheet where there is one,
   and elsewhere copies the tab's link. A "Something else" reply's LinkedIn
   message has its own copy button. */
import { ATTRIBUTE_SELECTOR, CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { copyText } from "./lib/clipboard.ts";
import { onClick } from "./lib/dom.ts";
import { words } from "./page.ts";
import { tabLink } from "./tabs.ts";
import { sayCopied } from "./toast.ts";

/** How long a button says whether its link was copied. */
const RESULT_SHOWS_MS = 1600;

/** A screen that's touched, not pointed at with a mouse: a phone or a tablet. */
const touchScreen = matchMedia("(pointer: coarse)");

/** What each button said before it first showed a result: a second click
    can come while it still says "Copied". */
const ownTextOf = new WeakMap<Element, string>();

export function initShare(): void {
  onClick(ATTRIBUTE_SELECTOR.copyLink, (button) => void shareOrCopyTabLink(button));
  onClick(ATTRIBUTE_SELECTOR.copyDraft, (button) => void copyDraftBeside(button));
}

/** The share button tries the share sheet first, and says in its label
    whether the link was copied. */
async function shareOrCopyTabLink(button: HTMLElement): Promise<void> {
  const tab = button.closest<HTMLElement>(CLASS_SELECTOR.tab);
  const label = button.querySelector(CLASS_SELECTOR.label);
  if (!tab || !label) return;
  const url = tabLink(tab);
  const hasShareSheet = Boolean(navigator.share) && touchScreen.matches;
  if (hasShareSheet && (await shareBySheet(url))) return;
  showResultInLabel(label, await copyText(url));
}

/** Says whether that settles it: the link was shared, or the visitor
    closed the sheet. Otherwise the sheet couldn't take the link, and it's
    to be copied instead. */
async function shareBySheet(url: string): Promise<boolean> {
  try {
    await navigator.share({ title: document.title, url });
    return true;
  } catch (error) {
    const closedTheSheet = error instanceof DOMException && error.name === "AbortError";
    return closedTheSheet;
  }
}

function showResultInLabel(label: Element, wasCopied: boolean): void {
  const ownWords = ownText(label, () => label.textContent);
  label.textContent = wasCopied ? words.copied : words.copyFailed;
  setTimeout(() => (label.textContent = ownWords), RESULT_SHOWS_MS);
}

function ownText(element: Element, read: () => string): string {
  if (!ownTextOf.has(element)) ownTextOf.set(element, read());
  return ownTextOf.get(element) ?? "";
}

async function copyDraftBeside(copyButton: HTMLElement): Promise<void> {
  const draft = copyButton.closest(CLASS_SELECTOR.draft)?.querySelector(CLASS_SELECTOR.draftText);
  if (draft) sayCopied(await copyText(draft.textContent));
}
