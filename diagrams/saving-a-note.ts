/* A worked example of a picture that moves: copy it, rename it, and draw your own (docs/diagrams.md says how).

   Moving: three lines are typed into a note. Each is saved in the browser as it's typed (a dot runs to
   IndexedDB), and a change joins the sync queue, where it waits at a gate marked "offline". The connection
   comes back, the gate opens, and the changes go to the server one at a time. Then a new note starts.

   Still: the note, IndexedDB, one change waiting at the gate, the server. */
import {
  aroundOrigin,
  arrowhead,
  bar,
  box,
  centreOf,
  COLOR,
  group,
  justBefore,
  label,
  line,
  loopOf,
  moving,
  onlyWhenMoving,
  rightOf,
  type Diagram,
  type Frame,
  type Loop,
  type Shape,
} from "../scripts/diagram.ts";

type Words = {
  note: string;
  store: string;
  storeNote: string;
  queue: string;
  queueNote: string;
  server: string;
  offline: string;
  online: string;
};

const LOOP_SECONDS = 13;
/** Each line of the note: when it starts to be typed (seconds into the loop), and how long it's drawn. */
const TYPED_LINES = [
  { typedFrom: 0.6, length: 290 },
  { typedFrom: 2.2, length: 240 },
  { typedFrom: 3.8, length: 170 },
];
/** When the connection comes back, and when the next note starts. */
const AT = { backOnline: 7, nextNote: 11.6 } as const;
/** How long each thing takes: a line to type, its save to reach the browser's store, the gate to open, a change
    to join the queue, to move up one place in it, and to reach the server. */
const TAKES = { typing: 1, saving: 0.5, gateToOpen: 0.3, joining: 0.6, movingUp: 0.4, sending: 0.8 } as const;
/** How the old note makes way for the next, in seconds after `AT.nextNote`: it fades, its lines empty while
    it's out of sight, the gate shuts again, and the new note fades in. */
const MAKING_WAY = {
  noteFaded: 0.5,
  linesEmptyFrom: 0.6,
  linesEmptyBy: 0.7,
  noteBackFrom: 0.8,
  noteBackBy: 1,
  gateShutFrom: 0.4,
  gateShutBy: 0.9,
  offlineAgain: 0.6,
} as const;
/** How fast a change comes into sight as it joins the queue, and goes as it reaches the server. */
const CHANGE_FADE = 0.15;
/** How brightly a box lights as something reaches it. */
const LIT = { peak: 0.35 } as const;

const WIDTH = 1600;
const HEIGHT = 540;
/** The height everything travels along. */
const ROAD_Y = 270;
const NOTE = { x: 60, y: 110, width: 380, height: 320 };
const NOTE_TEXT = { inset: 34, titleBaseline: 58, firstLine: 96, linePitch: 62, lineHeight: 28 } as const;
const STORE = { x: 560, y: 180, width: 330, height: 180 };
const SERVER = { x: 1240, y: 180, width: 300, height: 180 };
/** An arrow's line stops this far short of the box it points at, and its head's tip this far. */
const ARROW = { lineStops: 20, tipStops: 4 } as const;
/** The queue's gate, and where changes wait in front of it: the first in line nearest the gate, each of the
    others a step further back. */
const GATE = { x: 1140, reach: 62, labelAbove: 24 } as const;
const QUEUE = { firstInLine: 1080, step: 50, labelBelow: 130, noteBelow: 178 } as const;
/** A change, drawn as a small square: where it comes out of the store, and how far into the server it goes. */
const CHANGE = { size: 36, radius: 9, leavesStore: 24, intoServer: 40 } as const;

const savedAt = (typed: { typedFrom: number }): number => typed.typedFrom + TAKES.typing + TAKES.saving;
/** When the change that's `place` in line (from 0) sets off for the server: each leaves as the one before it
    arrives. */
const sentAt = (place: number): number => AT.backOnline + TAKES.gateToOpen + place * TAKES.sending;
const waitingAt = (place: number): number => QUEUE.firstInLine - place * QUEUE.step;
/** A point on the road, as a transform writes it. */
const onTheRoad = (x: number): string => `${x} ${ROAD_Y}`;
const alongTheRoad = (fromX: number, toX: number): string => `M${onTheRoad(fromX)} L${onTheRoad(toX)}`;

function draw(words: Words) {
  const loop = loopOf(LOOP_SECONDS);
  return {
    width: WIDTH,
    height: HEIGHT,
    plays: AT.nextNote,
    // Back to front: the queue's line is under the changes that ride it.
    shapes: [note(loop, words), queue(loop, words), store(loop, words), server(loop, words), ...changes(loop)],
  };
}

function note(loop: Loop, words: Words): Shape {
  const left = NOTE.x + NOTE_TEXT.inset;
  const lines = TYPED_LINES.map((typed, i) =>
    moving(
      bar(
        { x: left, y: NOTE.y + NOTE_TEXT.firstLine + i * NOTE_TEXT.linePitch, width: typed.length },
        { height: NOTE_TEXT.lineHeight },
      ),
      growingAsTyped(loop, typed),
      fadingBetweenNotes(loop),
    ),
  );
  return group(
    {},
    box(NOTE),
    label(
      words.note,
      { x: left, y: NOTE.y + NOTE_TEXT.titleBaseline },
      { size: 34, color: COLOR.quiet, anchor: "start" },
    ),
    ...lines,
  );
}

function growingAsTyped(loop: Loop, { typedFrom, length }: { typedFrom: number; length: number }): Shape {
  return loop.track(
    "width",
    [
      [typedFrom, 0],
      [typedFrom + TAKES.typing, length],
      [AT.nextNote + MAKING_WAY.linesEmptyFrom, length],
      [AT.nextNote + MAKING_WAY.linesEmptyBy, 0],
    ],
    "even",
  );
}

/** The old note is out of sight while its lines empty, so nothing snaps. */
function fadingBetweenNotes(loop: Loop): Shape {
  return loop.track("opacity", [
    [AT.nextNote, 1],
    [AT.nextNote + MAKING_WAY.noteFaded, 0],
    [AT.nextNote + MAKING_WAY.noteBackFrom, 0],
    [AT.nextNote + MAKING_WAY.noteBackBy, 1],
  ]);
}

function store(loop: Loop, words: Words): Shape {
  const middle = centreOf(STORE).x;
  const fromNote = alongTheRoad(rightOf(NOTE), STORE.x - ARROW.lineStops);
  const saves = TYPED_LINES.map((typed) => typed.typedFrom + TAKES.typing);
  return group(
    {},
    line(fromNote, { color: COLOR.line }),
    arrowhead({ x: STORE.x - ARROW.tipStops, y: ROAD_Y }, 0, COLOR.line),
    box(STORE),
    loop.light(box(STORE, { fill: COLOR.accent, line: "none" }), TYPED_LINES.map(savedAt), LIT),
    label(words.store, { x: middle, y: STORE.y + 86 }, { size: 44, weight: 600 }),
    label(words.storeNote, { x: middle, y: STORE.y + 136 }, { size: 34, color: COLOR.quiet }),
    ...saves.map((leaves) => loop.traveller(fromNote, leaves, leaves + TAKES.saving)),
  );
}

function queue(loop: Loop, words: Words): Shape {
  const middle = (rightOf(STORE) + GATE.x) / 2;
  const sign = (text: string) =>
    label(
      text,
      { x: GATE.x, y: ROAD_Y - GATE.reach - GATE.labelAbove },
      { size: 34, color: text === words.online ? COLOR.accent : COLOR.quiet },
    );
  return group(
    {},
    line(alongTheRoad(rightOf(STORE), SERVER.x - ARROW.lineStops), { color: COLOR.line }),
    arrowhead({ x: SERVER.x - ARROW.tipStops, y: ROAD_Y }, 0, COLOR.line),
    gate(loop),
    loop.changing(
      words.offline,
      [
        [AT.backOnline, words.online],
        [AT.nextNote + MAKING_WAY.offlineAgain, words.offline],
      ],
      sign,
    ),
    label(words.queue, { x: middle, y: ROAD_Y + QUEUE.labelBelow }, { size: 40, weight: 600 }),
    label(words.queueNote, { x: middle, y: ROAD_Y + QUEUE.noteBelow }, { size: 32, color: COLOR.quiet }),
  );
}

/** Shut while there's no connection. */
function gate(loop: Loop): Shape {
  return moving(
    line(`M${GATE.x} ${ROAD_Y - GATE.reach} L${GATE.x} ${ROAD_Y + GATE.reach}`, {
      color: COLOR.quiet,
      width: 6,
      dashes: "2 14",
    }),
    loop.track("opacity", [
      [AT.backOnline, 1],
      [AT.backOnline + 0.4, 0],
      [AT.nextNote + MAKING_WAY.gateShutFrom, 0],
      [AT.nextNote + MAKING_WAY.gateShutBy, 1],
    ]),
  );
}

function server(loop: Loop, words: Words): Shape {
  const arrivals = TYPED_LINES.map((_, place) => sentAt(place) + TAKES.sending);
  return group(
    {},
    box(SERVER),
    loop.light(box(SERVER, { fill: COLOR.accent, line: "none" }), arrivals, LIT),
    label(words.server, { x: centreOf(SERVER).x, y: SERVER.y + 106 }, { size: 44, weight: 600 }),
  );
}

/** A change for each line: it joins the queue as the line is saved. The still picture has the first, waiting
    at the gate. */
function changes(loop: Loop): Shape[] {
  return TYPED_LINES.map((typed, place) => {
    const isTheOneAtRest = place === 0;
    const joins = savedAt(typed);
    const arrives = sentAt(place) + TAKES.sending;
    const change = moving(
      group(
        { transform: `translate(${onTheRoad(waitingAt(0))})`, opacity: isTheOneAtRest ? undefined : 0 },
        box(aroundOrigin(CHANGE.size, CHANGE.size), { radius: CHANGE.radius, fill: COLOR.accent, line: "none" }),
      ),
      loop.transform("translate", journeyOf(place, joins)),
      loop.track(
        "opacity",
        [
          [justBefore(joins), 0],
          [joins + CHANGE_FADE, 1],
          [arrives - CHANGE_FADE, 1],
          [arrives, 0],
        ],
        "even",
      ),
    );
    return isTheOneAtRest ? change : onlyWhenMoving(change);
  });
}

/** Out of the store to its place in line; up a place each time the one ahead leaves; then through the gate to
    the server. */
function journeyOf(place: number, joins: number): Frame[] {
  const movingUp = Array.from({ length: place }, (_, haveLeft): Frame[] => [
    [sentAt(haveLeft), onTheRoad(waitingAt(place - haveLeft))],
    [sentAt(haveLeft) + TAKES.movingUp, onTheRoad(waitingAt(place - haveLeft - 1))],
  ]);
  return [
    [joins, onTheRoad(rightOf(STORE) + CHANGE.leavesStore)],
    [joins + TAKES.joining, onTheRoad(waitingAt(place))],
    ...movingUp.flat(),
    [sentAt(place), onTheRoad(waitingAt(0))],
    [sentAt(place) + TAKES.sending, onTheRoad(SERVER.x + CHANGE.intoServer)],
  ];
}

export default {
  name: "saving-a-note",
  words: {
    en: {
      note: "A note",
      store: "IndexedDB",
      storeNote: "in the browser",
      queue: "Sync queue",
      queueNote: "waits for a connection",
      server: "Server",
      offline: "offline",
      online: "online",
    },
    // Used by examples/ja.ts. A site in one language keeps only its own.
    ja: {
      note: "メモ",
      store: "IndexedDB",
      storeNote: "ブラウザの中",
      queue: "同期キュー",
      queueNote: "接続を待つ",
      server: "サーバー",
      offline: "オフライン",
      online: "オンライン",
    },
  },
  draw,
} satisfies Diagram<Words>;
