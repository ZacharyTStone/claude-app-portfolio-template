/* The globe's points of land, out of the bits src/app/globe/land.ts keeps
   them in. */
import { latticePoint } from "./sphere.ts";

/** Which of `points` points are land: a bit each, in base64. */
export type LandBits = { points: number; bits: string };

/** Each point of land's x, y and z, in turn. */
export function landPoints({ points, bits }: LandBits): Float32Array {
  const bytes = Uint8Array.from(atob(bits), (character) => character.charCodeAt(0));
  const land: number[] = [];
  for (let i = 0; i < points; i++) {
    if ((bytes[i >> 3] ?? 0) & (1 << (i & 7))) land.push(...latticePoint(i, points));
  }
  return new Float32Array(land);
}
