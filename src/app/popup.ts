/* One popup open at a time: a menu, or the question card. The button it
   opens from closes it again, and so does a click anywhere else. */

type OpenPopup = { popup: HTMLElement; trigger: HTMLElement };
let open: OpenPopup | null = null;

/** A button's attributes for the popup it opens, by the popup's id. */
export const popupAttributes = (popupId: string, kind = "menu"): Record<string, string> => ({
  "aria-haspopup": kind,
  "aria-expanded": "false",
  "aria-controls": popupId,
});

export const isPopupOpen = (): boolean => open !== null;

export const isPopupOpenFrom = (trigger: HTMLElement): boolean => open?.trigger === trigger;

export function closePopup(): void {
  if (!open) return;
  const { popup, trigger } = open;
  open = null;
  popup.hidden = true;
  trigger.setAttribute("aria-expanded", "false");
}

/** For a popup closed from inside it (Escape, a row chosen): the focus
    would otherwise be lost with it. */
export function closePopupAndReturnFocus(): void {
  const trigger = open?.trigger;
  closePopup();
  trigger?.focus();
}

type Opening = {
  /** Gets the popup ready before it shows: fills it, and puts it in place. */
  prepare?: () => void;
  /** What gets the focus once it shows. Left out, or returning nothing,
      the focus stays where it is. */
  firstFocus?: () => HTMLElement | undefined;
};

/** Opens `popup` from `trigger`, in place of any other that's open. */
export function openPopup(popup: HTMLElement, trigger: HTMLElement, { prepare, firstFocus }: Opening = {}): void {
  closePopup();
  prepare?.();
  popup.hidden = false;
  trigger.setAttribute("aria-expanded", "true");
  open = { popup, trigger };
  firstFocus?.()?.focus();
}

/** A press of a popup's button: opens the popup from it, or closes it if
    that's how it's open. */
export function togglePopup(popup: HTMLElement, trigger: HTMLElement, opening: Opening = {}): void {
  const isOpenFromHere = open?.popup === popup && open.trigger === trigger;
  if (isOpenFromHere) closePopup();
  else openPopup(popup, trigger, opening);
}

/** A click outside the open popup (and its button) closes it as the click
    comes in (capture): before what was clicked can open another popup,
    which it would then leave open. */
export function initPopup(): void {
  addEventListener(
    "click",
    (event) => {
      if (!open) return;
      const clickPath = event.composedPath();
      const isOutside = !clickPath.includes(open.popup) && !clickPath.includes(open.trigger);
      if (isOutside) closePopup();
    },
    { capture: true },
  );
}
