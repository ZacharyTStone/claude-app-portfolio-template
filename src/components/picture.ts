/* What the build reads from a picture's own file. A picture a visitor plays
   says how long it plays on its <svg> (the diagram kit writes it there:
   `plays`, in scripts/diagram.ts). Picture.astro asks here, and shows a
   picture that says so still, with a Play button; one that doesn't moves
   all the time. So whether a picture is played is the picture's to say,
   not the config's. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAYS_ATTRIBUTE } from "../contracts/picture-files.ts";

/** The folder whose files the site serves as they are, from where the
    build runs. */
const PUBLIC_FOLDER = "public";

// An <svg> tag that says how long it plays: <svg … data-plays="18.6">.
const SVG_THAT_PLAYS = new RegExp(`<svg\\b[^>]*\\s${PLAYS_ATTRIBUTE}="([0-9.]+)"`);

/** How long a picture plays, in seconds, if its file says. `src` is its
    path on the site ("/assets/how.svg"), and `root` the folder the site is
    built in. Undefined for a picture that doesn't say (it moves all the
    time, or not at all), and for one that isn't an SVG file of the site's. */
export function secondsPlayed(src: string, root: string = process.cwd()): number | undefined {
  if (!src.endsWith(".svg")) return undefined;
  const file = join(root, PUBLIC_FOLDER, src);
  if (!existsSync(file)) return undefined;
  const seconds = Number(SVG_THAT_PLAYS.exec(readFileSync(file, "utf8"))?.[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}
