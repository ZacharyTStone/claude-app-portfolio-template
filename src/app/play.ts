/* A picture a visitor plays rests as its still with a Play button over it
   (Picture.astro); without the script the button is a link to the picture
   as it moves. With it, each plays once by itself, the first time most of
   it is on screen, so that a visitor who never presses Play sees it move;
   after that it rests until it's pressed, and little moves beside the text
   (play-turns.ts says which plays when). That's the page's own, and each
   copy a chat shows of one: the copy starts at rest (restStill), and has
   a turn of its own from when it goes into the page (watchForTurnsIn).
   None plays by itself for a visitor who has asked for less motion.
   Playing, the moving file is put over the still until it has played
   through, is pressed again, another picture is played, or it leaves the
   screen. */
import { DATA } from "../contracts/page-attributes.ts";
import { PAGE_CLASSES } from "../contracts/page-classes.ts";
import { CLASS_SELECTOR, PART_SELECTOR } from "../contracts/page-selectors.ts";
import { TIMING } from "./constants.ts";
import { closestFrom, find, findAll, isPlainClick, make, onClick } from "./lib/dom.ts";
import { isMotionReduced } from "./lib/motion.ts";
import { words } from "./page.ts";
import { isMostlyOnScreen, SHARES_TO_TELL, takingTurns } from "./play-turns.ts";

type Playing = {
  figure: HTMLElement;
  button: HTMLElement;
  /** The picture as it moves, over the still. */
  moving: HTMLImageElement;
  /** What stops it once it has played through, set when it starts to. */
  playsUntil?: ReturnType<typeof setTimeout>;
};

/** One picture plays at a time. */
let playing: Playing | null = null;

/** Stops the picture that's playing when it leaves the screen. */
let outOfSight: IntersectionObserver | null = null;

/** Sees each picture come on screen, the page's own and a chat's, until it
    has had its turn to play by itself. */
let onScreen: IntersectionObserver | null = null;

const turns = takingTurns<HTMLElement>();

/** How many times a picture has been played. Each time, the moving file is
    asked for at an address of its own (PLAY_NUMBER), so its motion starts
    from the start: a browser can keep one clock for every use of a picture
    at one address, and a second playing would start wherever the first
    had got to. */
let timesPlayed = 0;

/** What the count is called in the moving file's address: "?play=2". The
    site's host serves the same file whatever follows the "?". */
const PLAY_NUMBER = "play";

/** From now on, a picture with a Play button plays where it is, and once by
    itself when it comes on screen. A page with none gets nothing. */
export function initPlay(): void {
  const buttons = findAll(document, PART_SELECTOR.playButton);
  if (!buttons.length) return;
  // It's a link in the page, and a button from here on: it does something
  // where it is.
  for (const button of buttons) button.setAttribute("role", "button");
  if ("IntersectionObserver" in window) {
    outOfSight = new IntersectionObserver(stopOutOfSight);
    watchForTurns();
  }
  onClick(CLASS_SELECTOR.stage, (_stage, event) => {
    const figure = playedFigureAt(event.target);
    if (!figure || !isPlainClick(event)) return;
    event.preventDefault();
    toggle(figure);
  });
  // A link takes Enter by itself; a button takes Space as well.
  document.addEventListener("keydown", (event) => {
    if (event.key !== " " || !closestFrom(event.target, PART_SELECTOR.playButton)) return;
    const figure = playedFigureAt(event.target);
    if (!figure) return;
    event.preventDefault();
    toggle(figure);
  });
}

/** The played pictures in an element, or the element, if it's one. */
const playedFiguresIn = (element: Element): HTMLElement[] =>
  element instanceof HTMLElement && element.matches(CLASS_SELECTOR.playedFigure)
    ? [element]
    : findAll(element, CLASS_SELECTOR.playedFigure);

/** A copy of something in the page, with every picture in it at rest: the
    copy of one that was playing isn't. It has its turn to play by itself
    once it's in the page (watchForTurnsIn). */
export function restStill(copy: Element): void {
  for (const figure of playedFiguresIn(copy)) {
    figure.classList.remove(PAGE_CLASSES.playing);
    for (const moving of findAll(figure, CLASS_SELECTOR.moving)) moving.remove();
    const button = figure.querySelector(PART_SELECTOR.playButton);
    if (button) setButtonWord(button, words.play);
  }
}

/** The word is in an element of its own, so the stylesheet can show the
    icon alone where there's little room. */
function setButtonWord(button: Element, word: string): void {
  find(button, CLASS_SELECTOR.label).textContent = word;
}

/** The figure a press plays or pauses: the one whose Play button, or whose
    picture, it was on. A picture that links somewhere (its `href`) is
    left to its link; only its button plays it. */
function playedFigureAt(target: EventTarget | null): HTMLElement | null {
  const stage = closestFrom(target, CLASS_SELECTOR.stage);
  if (!stage) return null;
  const link = closestFrom(target, "a");
  if (link && !link.matches(PART_SELECTOR.playButton)) return null;
  const figure = stage.closest(CLASS_SELECTOR.playedFigure);
  return figure instanceof HTMLElement ? figure : null;
}

/** A press. The picture is the visitor's from now on: paused, it rests for
    good. Nor does another start by itself because of it. */
function toggle(figure: HTMLElement): void {
  const wasPlaying = playing?.figure === figure;
  endTurn(figure);
  stop();
  if (!wasPlaying) play(figure);
}

/** Puts the picture as it moves over the still. It shows once it has
    loaded, and plays for as long as its button says. */
function play(figure: HTMLElement): void {
  const button = find(figure, PART_SELECTOR.playButton);
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
      if (seconds > 0) nowPlaying.playsUntil = setTimeout(stopByItself, seconds * 1000);
    },
    { once: true },
  );
  // A file that can't be had leaves the still as it was.
  moving.addEventListener("error", () => playing === nowPlaying && stopByItself(), { once: true });
  button.before(moving);
  figure.classList.add(PAGE_CLASSES.playing);
  setButtonWord(button, words.pause);
  outOfSight?.observe(figure);
  playing = nowPlaying;
}

/** The still shows again, as the moving picture fades from over it. */
function stop(): void {
  if (!playing) return;
  const { figure, button, moving, playsUntil } = playing;
  playing = null;
  clearTimeout(playsUntil);
  outOfSight?.unobserve(figure);
  figure.classList.remove(PAGE_CLASSES.playing);
  setButtonWord(button, words.play);
  moving.classList.remove(PAGE_CLASSES.movingShown);
  setTimeout(() => moving.remove(), TIMING.playFade);
}

/** Stopped without a press, a picture makes way for one waiting its turn. */
function stopByItself(): void {
  stop();
  playWhoseTurnItIs();
}

/** Stops the picture that's playing once none of it is on screen: scrolled
    past, or in a tab that's been left. */
function stopOutOfSight(entries: IntersectionObserverEntry[]): void {
  const latest = entries.findLast((entry) => entry.target === playing?.figure);
  if (latest && !latest.isIntersecting) stopByItself();
}

/** The page's own pictures, as the script starts, each watched without
    its caption. One in a tab that isn't open has no size, so it comes on
    screen only once its tab is opened. */
function watchForTurns(): void {
  onScreen = new IntersectionObserver(seeWhatsOnScreen, { threshold: SHARES_TO_TELL });
  watchForTurnsIn([document.body]);
}

/** Messages a chat has just put in the page (a reply as it goes in, a
    chosen thread's answers, a saved chat shown again): from now on each
    played picture in them is watched, and has its turn, as the page's own
    do. The turn is the copy's own: its playing spends none of the picture
    it was copied from, nor the reverse. The browser first says how much is
    on screen once it has laid the messages out, with the still's room kept
    by its width and height whether or not it has loaded, and again each
    time a tenth more or less of it is, so one still being scrolled to as
    the reply goes in is seen once it's there. */
export function watchForTurnsIn(messages: Element[]): void {
  if (!onScreen) return;
  for (const figure of messages.flatMap(playedFiguresIn)) onScreen.observe(stageOf(figure));
}

/** Says how much of each picture is on screen, and plays the one whose
    turn has come. */
function seeWhatsOnScreen(entries: IntersectionObserverEntry[]): void {
  for (const entry of entries) {
    const figure = entry.target.closest(CLASS_SELECTOR.playedFigure);
    if (figure instanceof HTMLElement) turns.seen(figure, isMostlyOnScreen(entry));
  }
  playWhoseTurnItIs();
}

/** Plays the picture whose turn it is, if one is waiting and none is
    playing, unless the visitor has asked for less motion. */
function playWhoseTurnItIs(): void {
  if (playing || isMotionReduced()) return;
  const figure = turns.next();
  if (!figure) return;
  endTurn(figure);
  play(figure);
}

/** A picture's turn is over: it played by itself, or was pressed. */
function endTurn(figure: HTMLElement): void {
  turns.taken(figure);
  onScreen?.unobserve(stageOf(figure));
}

/** The picture itself, and its button: the figure without its caption. */
const stageOf = (figure: HTMLElement): HTMLElement => find(figure, CLASS_SELECTOR.stage);
