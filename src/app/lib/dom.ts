/* Making and finding elements. Everything the script adds is made with
   createElement, textContent and setAttribute, never from HTML, so it stays
   within the site's Trusted Types policy (trusted-types 'none'). */

/** Attributes to set. One that's null or undefined is left off. */
export type Attributes = Record<string, string | null | undefined>;

/** A new element, with these attributes and children. */
export function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value != null) el.setAttribute(name, value);
  }
  el.append(...children);
  return el;
}

/** Makes an element act as a button: focusable, and pressed with Enter or
    Space as well as a click (a link already takes Enter). */
export function asButton(el: HTMLElement, attributes: Record<string, string> = {}): void {
  const link = el.matches("a[href]");
  if (!link) el.setAttribute("tabindex", "0");
  for (const [name, value] of Object.entries({ role: "button", ...attributes })) el.setAttribute(name, value);
  el.addEventListener("keydown", (event) => {
    if (event.key !== " " && (link || event.key !== "Enter")) return;
    event.preventDefault();
    el.click();
  });
}

/** Whether a key belongs to a word still being composed (Japanese, Chinese
    and Korean are typed that way): its Enter or Escape is the keyboard's.
    Browsers mark it as composing, or (Safari, which ends the composition
    first) with the key code 229. */
export const isComposing = (event: KeyboardEvent): boolean => event.isComposing || event.keyCode === 229;

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
  const el = document.getElementById(id);
  if (!el) throw new Error(`The page has no #${id}`);
  return el;
}

/** The first element in `parent` that matches, if there is one. */
export function query(parent: ParentNode, selector: string): HTMLElement | null {
  const el = parent.querySelector(selector);
  return el instanceof HTMLElement ? el : null;
}

/** The first element in `parent` that matches, which the page must have. */
export function find(parent: ParentNode, selector: string): HTMLElement {
  const el = query(parent, selector);
  if (!el) throw new Error(`The page has no ${selector}`);
  return el;
}

/** Every element in `parent` that matches. */
export function findAll(parent: ParentNode, selector: string): HTMLElement[] {
  return [...parent.querySelectorAll(selector)].filter((el) => el instanceof HTMLElement);
}

/** An element's parent, which it must have. */
export function parentOf(el: Element): HTMLElement {
  if (!el.parentElement) throw new Error(`The page's ${el.tagName.toLowerCase()} has no parent`);
  return el.parentElement;
}

/** A deep copy (cloneNode keeps the node's type, but says it's a Node). */
export const clone = <T extends Node>(node: T): T => node.cloneNode(true) as T;
