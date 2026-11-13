/* The "thinking" line while a reply is on its way: three dots, the seconds
   it's taken so far (from 1s), and a word picked at random that stays
   until the reply comes ("3s · Noodling"). */
import { PAGE_CLASSES } from "../../contracts/page-classes.ts";
import { make } from "../lib/dom.ts";
import { words } from "../page.ts";

const THINKING_WORDS = words.thinkingWords.split("|").filter(Boolean);

const hiddenFromScreenReaders = (className: string, ...children: Array<Node | string>): HTMLElement =>
  make("span", { class: className, "aria-hidden": "true" }, ...children);

/** Counts the seconds in `time` for as long as `line` is in the page. */
function countSeconds(line: HTMLElement, time: HTMLElement): void {
  const startedAt = Date.now();
  const clock = setInterval(() => {
    if (!line.isConnected) return clearInterval(clock);
    time.textContent = `${Math.floor((Date.now() - startedAt) / 1000)}s`;
  }, 1000);
}

/** Screen readers hear "Thinking…" once, as text added to the thread (a
    live region): a label alone isn't announced. */
export function thinkingLine(): HTMLElement {
  const randomWord = THINKING_WORDS[Math.floor(Math.random() * THINKING_WORDS.length)] ?? words.thinking;
  const dots = hiddenFromScreenReaders(PAGE_CLASSES.thinkingDots, make("i"), make("i"), make("i"));
  const time = hiddenFromScreenReaders(PAGE_CLASSES.thinkingTime);
  const word = hiddenFromScreenReaders(PAGE_CLASSES.thinkingWord, randomWord);
  const saidOnce = make("span", { class: PAGE_CLASSES.srOnly }, words.thinking);
  const line = make("div", { class: PAGE_CLASSES.thinking }, dots, time, word, saidOnce);
  countSeconds(line, time);
  return line;
}
