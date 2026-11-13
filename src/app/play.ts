/* A picture a visitor plays: a diagram that rests as its still, dimmed,
   with a Play button over it (Picture.astro), so nothing moves beside the
   text until it's asked to. Without the script the button is a link to the
   picture as it moves.

   With it, pressing the button, or the picture, plays the picture where it
   is: the moving file is put over the still and the figure lights up. It's
   taken away again when it has played through (the button says for how
   long: DATA.play), when it's pressed again, when another picture is
   played, or when it's out of sight. One picture plays at a time.

   A chat's copy of an answer has a button of its own, which works the
   same: the presses are heard on the document, and the copy starts at
   rest (restStill). */
import { DATA } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { CLASS_SELECTOR } from "../contracts/page-selectors.ts";
import { SELECTOR, TIMING } from "./constants.ts";
import { closestFrom, find, findAll, isPlainClick, make } from "./lib/dom.ts";
import { words } from "./page.ts";

/** The picture that's playing. */
type Playing = {
  figure: HTMLElement;
  button: HTMLElement;
  /** The picture as it moves, over the still. */
  moving: HTMLImageElement;
  /** What stops it once it has played through, set when it starts to. */
  playsUntil?: ReturnType<typeof setTimeout>;
};

/** The one picture playing, if any is. */
let playing: Playing | null = null;

/** Stops the picture that's playing when it leaves the screen. */
let outOfSight: IntersectionObserver | null = null;

/** How many times a picture has been played. Each time, the moving file is
    asked for at an address of its own (PLAY_NUMBER), so its motion starts
    from the start: a browser can keep one clock for every use of a picture
    at one address, and a second playing would start wherever the first
    had got to. */
let timesPlayed = 0;

/** What the count is called in the moving file's address: "?play=2". The
    site's host serves the same file whatever follows the "?". */
const PLAY_NUMBER = "play";

/** From now on, a picture with a Play button plays where it is. A page
    with none gets nothing. */
export function initPlay(): void {
  const buttons = findAll(document, SELECTOR.playButton);
  if (!buttons.length) return;
  // It's a link in the page, and a button from here on: it does something
  // where it is.
  for (const button of buttons) button.setAttribute("role", "button");
  if ("IntersectionObserver" in window) outOfSight = new IntersectionObserver(stopOutOfSight);
  // On the document, so the copies of an answer that chats make work too.
  document.addEventListener("click", (event) => {
    const figure = playedFigureAt(event.target);
    if (!figure || !isPlainClick(event)) return;
    event.preventDefault();
    toggle(figure);
  });
  // A link takes Enter by itself; a button takes Space as well.
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " || !closestFrom(event.target, SELECTOR.playButton)) return;
    const figure = playedFigureAt(event.target);
    if (!figure) return;
    event.preventDefault();
    toggle(figure);
  });
}

/** A copy of something in the page, with every picture in it at rest: the
    copy of one that was playing isn't. */
export function restStill(copy: Element): void {
  const figures = copy.matches(CLASS_SELECTOR.playedFigure) ? [copy] : findAll(copy, CLASS_SELECTOR.playedFigure);
  for (const figure of figures) {
    figure.classList.remove(PAGE_CLASSES.playing);
    for (const moving of findAll(figure, CLASS_SELECTOR.moving)) moving.remove();
    const button = figure.querySelector(SELECTOR.playButton);
    if (button) name(button, words.play);
  }
}

/** Gives a Play button its word. The word is in an element of its own, so
    the stylesheet can show the icon alone where there's little room. */
function name(button: Element, word: string): void {
  find(button, CLASS_SELECTOR.label).textContent = word;
}

/** The figure a press plays or pauses: the one whose Play button, or whose
    picture, it was on. A picture that links somewhere (its `href`) is
    left to its link; only its button plays it. */
function playedFigureAt(target: EventTarget | null): HTMLElement | null {
  const stage = closestFrom(target, CLASS_SELECTOR.stage);
  if (!stage) return null;
  const link = closestFrom(target, "a");
  if (link && !link.matches(SELECTOR.playButton)) return null;
  const figure = stage.closest(CLASS_SELECTOR.playedFigure);
  return figure instanceof HTMLElement ? figure : null;
}

/** Plays a figure's picture, or stops it if it's the one playing. */
function toggle(figure: HTMLElement): void {
  const wasPlaying = playing?.figure === figure;
  stop();
  if (!wasPlaying) play(figure);
}

/** Puts the picture as it moves over the still. It shows once it has
    loaded, and plays for as long as its button says. */
function play(figure: HTMLElement): void {
  const button = find(figure, SELECTOR.playButton);
  const address = button.getAttribute("href");
  if (!address) return;
  timesPlayed++;
  // The still under it has the picture's description.
  const moving = make("img", { class: PAGE_CLASSES.moving, src: `${address}?${PLAY_NUMBER}=${timesPlayed}`, alt: "" });
  const nowPlaying: Playing = { figure, button, moving };
  moving.addEventListener(
    "load",
    () => {
      // Stopped, or another one played, while it loaded.
      if (playing !== nowPlaying) return;
      moving.classList.add(PAGE_CLASSES.movingShown);
      const seconds = Number(button.getAttribute(DATA.play));
      if (seconds > 0) nowPlaying.playsUntil = setTimeout(stop, seconds * 1000);
    },
    { once: true },
  );
  // A file that can't be had leaves the still as it was.
  moving.addEventListener("error", () => playing === nowPlaying && stop(), { once: true });
  button.before(moving);
  figure.classList.add(PAGE_CLASSES.playing);
  name(button, words.pause);
  outOfSight?.observe(figure);
  playing = nowPlaying;
}

/** Stops the picture that's playing: the still shows again, as the moving
    one fades from over it. */
function stop(): void {
  if (!playing) return;
  const { figure, button, moving, playsUntil } = playing;
  playing = null;
  clearTimeout(playsUntil);
  outOfSight?.unobserve(figure);
  figure.classList.remove(PAGE_CLASSES.playing);
  name(button, words.play);
  moving.classList.remove(PAGE_CLASSES.movingShown);
  setTimeout(() => moving.remove(), TIMING.playFade);
}

/** Stops the picture that's playing once none of it is on screen: scrolled
    past, or in a tab that's been left. */
function stopOutOfSight(entries: IntersectionObserverEntry[]): void {
  const latest = entries.findLast((entry) => entry.target === playing?.figure);
  if (latest && !latest.isIntersecting) stop();
}
