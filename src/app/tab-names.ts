/* The names a visitor gives the site's own tabs: what the browser has
   saved of them, and what a name typed in comes to. It needs no page. */
import { isRecord, isString } from "../contracts/guards.ts";

/** By tab id. */
export type GivenNames = Map<string, string>;

/** The names in what was saved, which may be an older version's or edited
    by hand: anything that isn't a name by a tab's id is left out. */
export function givenNamesIn(saved: unknown): GivenNames {
  const names: GivenNames = new Map();
  if (!isRecord(saved)) return names;
  for (const [tabId, name] of Object.entries(saved)) if (isString(name)) names.set(tabId, name);
  return names;
}

/** The name a tab is given by what was typed, or null when it goes back to
    its own: nothing was typed, or its own title was. */
export function givenNameFrom(typedName: string, ownTitle: string | undefined): string | null {
  const isOwnTitle = typedName === ownTitle;
  return typedName && !isOwnTitle ? typedName : null;
}

/** What a tab's sidebar row says. A given name keeps the space the row's
    own words end with (the page has one before a dot, say). */
export function rowTextFor(givenName: string | undefined, ownRowText: string): string {
  if (!givenName) return ownRowText;
  const spaceAfter = ownRowText.endsWith(" ") ? " " : "";
  return `${givenName}${spaceAfter}`;
}
