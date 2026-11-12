/* How Pocket Notes saves a note with no connection: a worked example of a
   picture that moves (AGENTS.md, "Adding a picture that moves"). Copy it,
   rename it, and draw your own.

   Moving: three lines are typed into a note. Each is saved in the browser
   the moment it's typed (a dot runs to IndexedDB), and a change joins the
   sync queue, where it waits at a gate marked "offline". The connection
   comes back, the gate opens, and the changes go to the server one at a
   time. Then a new note starts.

   Still: the note, IndexedDB, one change waiting at the gate, the server.

   `npm run diagrams saving-a-note` writes its files into public/assets;
   site.config.ts shows them with an `image`. */
import {
  arrowhead,
  box,
  COLOR,
  group,
  label,
  line,
  loopOf,
  moving,
  onlyWhenMoving,
  type Frame,
  type Point,
} from "../scripts/diagram.ts";
import type { Diagram } from "../scripts/diagrams.ts";

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

// ---- When things happen: seconds into the loop ---------------------------------

const LOOP_SECONDS = 13;
/** Each line of the note: when it starts to be typed, and how long it is. */
const TYPED_LINES = [
  { typedFrom: 0.6, length: 290 },
  { typedFrom: 2.2, length: 240 },
  { typedFrom: 3.8, length: 170 },
];
/** How long a line takes to type, and its save takes to reach the browser's store. */
const TYPING = 1;
const SAVING = 0.5;
/** When the connection comes back, and when the next note starts. */
const BACK_ONLINE = 7;
const NEXT_NOTE = 11.6;
/** How long a change takes to move up one place in the queue, and to reach the server. */
const MOVING_UP = 0.4;
const SENDING = 0.8;

// ---- Where things are ----------------------------------------------------------

const WIDTH = 1600;
const HEIGHT = 540;
/** The height everything travels along. */
const ROAD_Y = 270;
const NOTE = { x: 60, y: 110, width: 380, height: 320 };
const STORE = { x: 560, y: 180, width: 330, height: 180 };
const SERVER = { x: 1240, y: 180, width: 300, height: 180 };
/** Where the queue's gate stands, and where changes wait in front of it,
    the first in line nearest the gate. */
const GATE_X = 1140;
const QUEUE_SLOTS = [1080, 1030, 980];
/** A change, drawn as a small square. */
const CHANGE_SIZE = 36;

function draw(words: Words) {
  const loop = loopOf(LOOP_SECONDS);
  /** When each line's save reaches the store: a change joins the queue then. */
  const savedAt = TYPED_LINES.map((typed) => typed.typedFrom + TYPING + SAVING);

  // ---- The note: lines typed one after another -----------------------------
  const noteLines = TYPED_LINES.map(({ typedFrom, length }, i) =>
    moving(
      box(
        { x: NOTE.x + 34, y: NOTE.y + 96 + i * 62, width: length, height: 28 },
        { radius: 14, fill: COLOR.mark, line: "none" },
      ),
      // It grows as it's typed, and is empty again once the next note starts.
      loop.track(
        "width",
        [
          [typedFrom, 0],
          [typedFrom + TYPING, length],
          [NEXT_NOTE + 0.6, length],
          [NEXT_NOTE + 0.7, 0],
        ],
        "even",
      ),
      // The old note fades away before its lines empty, so nothing snaps.
      loop.track("opacity", [
        [NEXT_NOTE, 1],
        [NEXT_NOTE + 0.5, 0],
        [NEXT_NOTE + 0.8, 0],
        [NEXT_NOTE + 1, 1],
      ]),
    ),
  );
  const note = group(
    {},
    box(NOTE),
    label(words.note, { x: NOTE.x + 34, y: NOTE.y + 58 }, { size: 34, color: COLOR.quiet, anchor: "start" }),
    ...noteLines,
  );

  // ---- The browser's store: every line is saved as it's typed ---------------
  const toStore = `M${NOTE.x + NOTE.width} ${ROAD_Y} L${STORE.x - 20} ${ROAD_Y}`;
  const store = group(
    {},
    line(toStore, { color: COLOR.line }),
    arrowhead({ x: STORE.x - 4, y: ROAD_Y }, 0, COLOR.line),
    box(STORE),
    // It lights each time something is saved in it.
    onlyWhenMoving(
      moving(box(STORE, { fill: COLOR.accent, line: "none", opacity: 0 }), loop.flash(savedAt, { peak: 0.35 })),
    ),
    label(words.store, { x: STORE.x + STORE.width / 2, y: STORE.y + 86 }, { size: 44, weight: 600 }),
    label(words.storeNote, { x: STORE.x + STORE.width / 2, y: STORE.y + 136 }, { size: 34, color: COLOR.quiet }),
    ...TYPED_LINES.map(({ typedFrom }) => loop.traveller(toStore, typedFrom + TYPING, typedFrom + TYPING + SAVING)),
  );

  // ---- The queue: changes wait at the gate, then go one at a time -----------
  const queueMiddle = (STORE.x + STORE.width + GATE_X) / 2;
  /** When the change that's `place` in line (from 0) sets off for the
      server: each leaves as the one before it arrives. */
  const sentAt = (place: number) => BACK_ONLINE + 0.3 + place * SENDING;
  const arrivals = TYPED_LINES.map((_, place) => sentAt(place) + SENDING);

  const changes = TYPED_LINES.map((_, place) => {
    const joins = savedAt[place]!;
    const at = (x: number) => `${x} ${ROAD_Y}`;
    // Out of the store to its place in line; up a place each time the one
    // ahead leaves; then through the gate to the server.
    const journey: Frame[] = [
      [joins, at(STORE.x + STORE.width + 24)],
      [joins + 0.6, at(QUEUE_SLOTS[place]!)],
    ];
    for (let ahead = place; ahead > 0; ahead--) {
      const movesUpAt = sentAt(place - ahead);
      journey.push([movesUpAt, at(QUEUE_SLOTS[ahead]!)], [movesUpAt + MOVING_UP, at(QUEUE_SLOTS[ahead - 1]!)]);
    }
    journey.push([sentAt(place), at(QUEUE_SLOTS[0]!)], [sentAt(place) + SENDING, at(SERVER.x + 40)]);

    const isTheOneAtRest = place === 0;
    const change = moving(
      group(
        { transform: `translate(${at(QUEUE_SLOTS[0]!)})`, opacity: isTheOneAtRest ? undefined : 0 },
        box(
          { x: -CHANGE_SIZE / 2, y: -CHANGE_SIZE / 2, width: CHANGE_SIZE, height: CHANGE_SIZE },
          { radius: 9, fill: COLOR.accent, line: "none" },
        ),
      ),
      loop.transform("translate", journey),
      loop.track(
        "opacity",
        [
          [Math.max(0, joins - 0.001), 0],
          [joins + 0.15, 1],
          [sentAt(place) + SENDING - 0.15, 1],
          [sentAt(place) + SENDING, 0],
        ],
        "even",
      ),
    );
    // The still picture has one change, waiting at the gate.
    return isTheOneAtRest ? change : onlyWhenMoving(change);
  });

  const gateTop: Point = { x: GATE_X, y: ROAD_Y - 62 };
  const queue = group(
    {},
    line(`M${STORE.x + STORE.width} ${ROAD_Y} L${SERVER.x - 20} ${ROAD_Y}`, { color: COLOR.line }),
    arrowhead({ x: SERVER.x - 4, y: ROAD_Y }, 0, COLOR.line),
    // The gate is shut while there's no connection.
    moving(
      line(`M${GATE_X} ${gateTop.y} L${GATE_X} ${ROAD_Y + 62}`, { color: COLOR.quiet, width: 6, dashes: "2 14" }),
      loop.track("opacity", [
        [BACK_ONLINE, 1],
        [BACK_ONLINE + 0.4, 0],
        [NEXT_NOTE + 0.4, 0],
        [NEXT_NOTE + 0.9, 1],
      ]),
    ),
    loop.changing(
      words.offline,
      [
        [BACK_ONLINE, words.online],
        [NEXT_NOTE + 0.6, words.offline],
      ],
      (text) =>
        label(
          text,
          { x: GATE_X, y: gateTop.y - 24 },
          { size: 34, color: text === words.online ? COLOR.accent : COLOR.quiet },
        ),
    ),
    label(words.queue, { x: queueMiddle, y: ROAD_Y + 130 }, { size: 40, weight: 600 }),
    label(words.queueNote, { x: queueMiddle, y: ROAD_Y + 178 }, { size: 32, color: COLOR.quiet }),
  );

  // ---- The server: lights as each change arrives ----------------------------
  const server = group(
    {},
    box(SERVER),
    onlyWhenMoving(
      moving(box(SERVER, { fill: COLOR.accent, line: "none", opacity: 0 }), loop.flash(arrivals, { peak: 0.35 })),
    ),
    label(words.server, { x: SERVER.x + SERVER.width / 2, y: SERVER.y + 106 }, { size: 44, weight: 600 }),
  );

  // Back to front: the queue's line is under the changes that ride it.
  return { width: WIDTH, height: HEIGHT, shapes: [note, queue, store, server, ...changes] };
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
