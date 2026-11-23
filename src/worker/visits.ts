/* POST /visits, for the home screen's globe (the config's globe.visitors):
   counts the visitor where Cloudflare places them, to the nearest whole
   degree and once a day (AskGuard keeps the counts: guard/visit-counts.ts),
   and tells them roughly where they are and where the site's visitors have
   come from. Their address is only ever hashed, with the day's salt, and
   their town is said to them alone and never kept. */
import { VISITS_PATH, type Visits, type You } from "../contracts/globe.ts";
import type { Env } from "./env.ts";
import { guardFor } from "./guard/client.ts";
import { squareOf } from "./guard/visit-counts.ts";
import { HTTP_STATUS } from "./lib/http.ts";
import { utcDay } from "./lib/time.ts";
import { hashAddress, visitorAddress } from "./lib/visitor.ts";
import { readSettings } from "./settings.ts";

export { VISITS_PATH };

/** Where the visitor is said to be: to a tenth of a degree, about 10 km. */
const TENTHS = 10;

const tenthOf = (degrees: number): number => Math.round(degrees * TENTHS) / TENTHS;

/** Where Cloudflare places the request's visitor, if it does. */
export function youFrom(cf: Record<string, unknown> | undefined): You | null {
  const [latitude, longitude] = [Number(cf?.latitude), Number(cf?.longitude)];
  if (!cf || cf.latitude === undefined || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const town = typeof cf.city === "string" && cf.city ? cf.city : undefined;
  return { latitude: tenthOf(latitude), longitude: tenthOf(longitude), ...(town ? { town } : {}) };
}

export async function handleVisits(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: HTTP_STATUS.methodNotAllowed, headers: { Allow: "POST" } });
  }
  const settings = readSettings(env);
  const you = youFrom(request.cf as Record<string, unknown> | undefined);
  const visitorHash = await hashAddress(visitorAddress(request), settings.salt, utcDay(Date.now()));
  const square = you ? squareOf(you.latitude, you.longitude) : null;
  const places = await guardFor(env.ASK_GUARD, settings).countVisit(visitorHash, square);
  const visits: Visits = { you, places: places ?? [] };
  return Response.json(visits, { headers: { "Cache-Control": "no-store" } });
}
