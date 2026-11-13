/* Where a visitor goes: to a tab, to a new chat, home. Each is a change of
   address (#about), which main.ts follows; what was to happen once there
   waits until it has. */
import { emptyChatTab } from "./conversation/chats.ts";
import type { Exchange } from "./conversation/exchange.ts";
import { send } from "./conversation/send.ts";
import { openCard, openCardLeavingFocus } from "./question-card/card.ts";
import { closeDrawerAndReturnFocus, isDrawerOpen, isWide } from "./sidebar.ts";
import { clearHash, currentTab, focusOpenTab, showOpenTab } from "./tabs.ts";

/** What's to run once a tab has opened, until it has. */
let pendingOpen: { tab: HTMLElement; onceOpen: () => void } | null = null;

/** Opens a tab, then runs `onceOpen` once it's open and everything that
    happens when a tab opens has happened. */
export function openTab(tab: HTMLElement, onceOpen?: () => void): void {
  if (tab === currentTab()) return onceOpen?.();
  pendingOpen = onceOpen ? { tab, onceOpen } : null;
  location.hash = tab.id;
}

/** Runs what openTab was asked to, if its tab is the one that has just
    opened: main.ts calls it once the page is in step with the address.
    Another tab opening first means it never runs. */
export function finishOpening(): void {
  const openedTab = currentTab();
  // An address that names no tab: not yet.
  if (!pendingOpen || !openedTab) return;
  const { tab: awaitedTab, onceOpen } = pendingOpen;
  pendingOpen = null;
  if (openedTab === awaitedTab) onceOpen();
}

/** "New tab": a new chat, with the question card open and ready. */
export function openNewChat(): void {
  closeDrawerAndReturnFocus();
  const chatTab = emptyChatTab();
  openTab(chatTab, () => openCard(chatTab));
}

/** Sends an exchange into a new chat, without the question card that a new
    chat opens with. */
export function askInNewChat(exchange: Exchange): void {
  closeDrawerAndReturnFocus();
  const chatTab = emptyChatTab();
  openTab(chatTab, () => void send(chatTab, exchange));
}

/** Back to the start: the home screen, or on a phone a new chat with the
    question card open, which is where a visit there starts. */
export function goHome(): void {
  if (!isWide()) return openNewChat();
  closeDrawerAndReturnFocus();
  if (location.hash) clearHash();
  showOpenTab();
  focusOpenTab();
}

/** On a phone the start is a new chat with the question card open, not the
    home screen: where a visit starts, unless the address names a tab, and
    where Back to it goes (the empty chat it was is gone). Nothing has been
    touched in it yet, so focus stays on its heading. */
export function startOnPhone(): void {
  if (isWide() || currentTab() || isDrawerOpen()) return;
  closeDrawerAndReturnFocus();
  const chatTab = emptyChatTab();
  pendingOpen = { tab: chatTab, onceOpen: () => openCardLeavingFocus(chatTab) };
  // In the home screen's place in the history: left there, the home screen
  // would open another chat each time Back reached it.
  location.replace(`#${chatTab.id}`);
}
