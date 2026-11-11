/* Where a site lives, from its address in site.config.ts. */

/** The path the site is served at: "/" for https://example.com, and
    "/portfolio/" for https://alex.github.io/portfolio (with or without
    the last slash). Every link the pages make to the site starts here. */
export function basePath(url: string): string {
  const { pathname } = new URL(url);
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}
