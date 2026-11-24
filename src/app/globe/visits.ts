/* The globe's visitors (the config's globe.visitors): the page posts to
   /visits once, as the globe starts, and is told roughly where this visitor
   is and where the site's visitors have come from (src/contracts/globe.ts).
   With /visits down, the globe is drawn without them. */
import { readVisits, type Visits } from "../../contracts/globe.ts";

export async function askForVisits(address: string): Promise<Visits | null> {
  try {
    const response = await fetch(address, { method: "POST" });
    return response.ok ? readVisits(await response.json()) : null;
  } catch {
    return null;
  }
}
