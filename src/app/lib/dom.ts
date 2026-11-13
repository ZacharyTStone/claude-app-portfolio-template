/* Making and finding elements. Everything the script adds is made with
   createElement, textContent and setAttribute, never from HTML, so it stays
   within the site's Trusted Types policy (trusted-types 'none'). */

/** Attributes to set. One that's null or undefined is left off. */
export type Attributes = Record<string, string | null | undefined>;

export function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value != null) element.setAttribute(name, value);
  }
  element.append(...children);
  return element;
}

/** Makes an element act as a button: focusable, and pressed with Enter or
    Space as well as a click (a link already takes Enter). */
export function asButton(element: HTMLElement, attributes: Record<string, string> = {}): void {
  const isLink = element.matches("a[href]");
  if (!isLink) element.setAttribute("tabindex", "0");
  for (const [name, value] of Object.entries({ role: "button", ...attributes })) element.setAttribute(name, value);
  element.addEventListener("keydown", (event) => {
    const pressesIt = event.key === " " || (event.key === "Enter" && !isLink);
    if (!pressesIt) return;
    event.preventDefault();
    element.click();
  });
}

/** The key code a browser gives a key press that the keyboard's own
    composing took, whatever the key was. */
const COMPOSING_KEY_CODE = 229;

/** Whether a key belongs to a word still being composed (Japanese, Chinese
    and Korean are typed that way): its Enter or Escape is the keyboard's.
    Browsers mark it as composing, or (Safari, which ends the composition
    first) with the key code 229. */
export const isComposing = (event: KeyboardEvent): boolean => event.isComposing || event.keyCode === COMPOSING_KEY_CODE;

/** Runs `submit` when Enter is pressed in a text box, but not while a word
    is being composed. */
export function onEnter(input: HTMLInputElement, submit: () => void): void {
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || isComposing(event)) return;
    event.preventDefault();
    submit();
  });
}

/** The element with this id, which the page must have. */
export function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) throw new Error(`The page has no #${id}`);
  return element;
}

/** The first element in `parent` that matches, if there is one. */
export function query(parent: ParentNode, selector: string): HTMLElement | null {
  const element = parent.querySelector(selector);
  return element instanceof HTMLElement ? element : null;
}

/** The first element in `parent` that matches, which the page must have. */
export function find(parent: ParentNode, selector: string): HTMLElement {
  const element = query(parent, selector);
  if (!element) throw new Error(`The page has no ${selector}`);
  return element;
}

export function findAll(parent: ParentNode, selector: string): HTMLElement[] {
  return [...parent.querySelectorAll(selector)].filter((element) => element instanceof HTMLElement);
}

/** An element's parent, which it must have. */
export function parentOf(element: Element): HTMLElement {
  if (!element.parentElement) throw new Error(`The page's ${element.tagName.toLowerCase()} has no parent`);
  return element.parentElement;
}

/** The nearest element that matches around where an event happened: its
    target, or whatever the target is inside. Null when there's none (or
    the target isn't an element at all). For a listener on the document or
    on a parent, which hears about clicks on anything in it. */
export const closestFrom = (target: EventTarget | null, selector: string): Element | null =>
  target instanceof Element ? target.closest(selector) : null;

/** Runs `handle` for each click on, or inside, an element that matches:
    one the page has now, or one added to it later (a chat's tab, a copy of
    an answer). */
export function onClick(selector: string, handle: (element: HTMLElement, event: MouseEvent) => void): void {
  document.addEventListener("click", (event) => {
    const element = closestFrom(event.target, selector);
    if (element instanceof HTMLElement) handle(element, event);
  });
}

/** Whether a click is a plain one: with a modifier key or another button,
    the visitor is asking the browser for a new tab or window themselves. */
export const isPlainClick = (event: MouseEvent): boolean =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/** A deep copy (cloneNode keeps the node's type, but says it's a Node). */
export const clone = <T extends Node>(node: T): T => node.cloneNode(true) as T;
