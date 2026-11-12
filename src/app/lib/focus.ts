/* Moving the focus through a list of stops with the arrow keys, as the
   menus, the question card and the sidebar's rows do: past the last stop is
   the first again, and before the first is the last. */

/** Whether one of these elements has the focus. */
export const isFocusOn = (stops: readonly HTMLElement[]): boolean =>
  stops.some((stop) => stop === document.activeElement);

/** Moves the focus one stop on (`step` 1) or one back (-1) from the stop
    that has it, going round at either end. When none of them has it, the
    focus counts as just before the first: one step on is the first stop. */
export function stepFocus(stops: readonly HTMLElement[], step: 1 | -1): void {
  const focusedAt = stops.findIndex((stop) => stop === document.activeElement);
  stops[(focusedAt + step + stops.length) % stops.length]?.focus();
}
