/* The page's address, which names the open tab (tabs.ts): moved as a visitor
   goes somewhere in the page, and followed however it changes. A link to a
   tab's page or to the home page is followed in place, with its address
   pushed onto the history, so Back and Forward go between tabs as they
   would between pages; without JavaScript it's an ordinary link to that
   page. main.ts says what following the address does. */
import { closestFrom, isPlainClick } from "./lib/dom.ts";
import { addressOfPlace, addressToKeep, placeOfLink } from "./tab-addresses.ts";
import { here } from "./tabs.ts";

/** What the page does once its address has changed (followAddress). */
let follow: () => void = () => {};
/** The address the page was last brought into step with. */
let followed = location.href;

function followNow(): void {
  follow();
  followed = location.href;
}

/** Puts the open tab's own address in place of the one it was opened at,
    without a step in the history: /about/ for an old /#about
    (addressToKeep). */
export function keepOwnAddress(): void {
  const own = addressToKeep(new URL(location.href), here);
  if (own) history.replaceState(null, "", own);
}

/** Whether the page is at an address already. */
export const isAt = (address: string): boolean => new URL(address, location.href).href === location.href;

/** Moves the page to an address of its own (a tab's, the home page's) as a
    link there would, and follows it: in the history's next place, or
    `replacing` the one it's in. Nothing happens if it's there already. */
export function go(address: string, replacing = false): void {
  if (isAt(address)) return;
  if (replacing) history.replaceState(null, "", address);
  else history.pushState(null, "", address);
  followNow();
}

/** Back and Forward, and a #id that changes without the script (an old
    link's, one typed in): each fires popstate, and a change of #id
    hashchange after it, for one change of address. */
function followIfMoved(): void {
  if (location.href !== followed) followNow();
}

/** A plain click on a link to one of this page's tabs, or to its home page,
    that nothing else has taken. */
function followLinkInPlace(event: MouseEvent): void {
  if (event.defaultPrevented || !isPlainClick(event)) return;
  const link = closestFrom(event.target, "a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute("download")) return;
  const place = placeOfLink(new URL(link.href), here);
  if (!place) return;
  event.preventDefault();
  go(addressOfPlace(place, here));
}

/** From now on the page follows its address with `onAddressChange`, once
    each time it changes. */
export function followAddress(onAddressChange: () => void): void {
  follow = onAddressChange;
  followed = location.href;
  addEventListener("popstate", followIfMoved);
  addEventListener("hashchange", followIfMoved);
  document.addEventListener("click", followLinkInPlace);
}
