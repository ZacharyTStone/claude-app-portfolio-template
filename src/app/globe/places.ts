/* The places the globe's dots stand for: the config's seed (globe.seed), as
   the page carries it, and those the Worker counted, together, each square
   of the globe a whole degree on a side once. */
import type { VisitedPlace } from "../../contracts/globe.ts";

/** "35.68 139.69 66;52.37 4.9 69", as the page carries the seed: what
    isn't a place with a count is left out. */
export function seedPlaces(said: string | null): VisitedPlace[] {
  return (said ?? "")
    .split(";")
    .map((place) => place.trim().split(" ").map(Number))
    .filter((numbers) => numbers.length === 3 && numbers.every(Number.isFinite))
    .map(([latitude = 0, longitude = 0, visits = 0]): VisitedPlace => [latitude, longitude, visits])
    .filter(([latitude, longitude, visits]) => Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 && visits > 0);
}

/** Each square's visits from all of `lists`, at the square's middle. */
export function togetherPlaces(...lists: VisitedPlace[][]): VisitedPlace[] {
  const visitsBySquare = new Map<string, number>();
  for (const [latitude, longitude, visits] of lists.flat()) {
    const square = `${Math.round(latitude)},${Math.round(longitude)}`;
    visitsBySquare.set(square, (visitsBySquare.get(square) ?? 0) + visits);
  }
  return [...visitsBySquare].map(([square, visits]): VisitedPlace => {
    const [latitude = 0, longitude = 0] = square.split(",").map(Number);
    return [latitude, longitude, visits];
  });
}
