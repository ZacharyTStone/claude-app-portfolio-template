import { newTabAttributes } from "../contracts/links.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { site } from "../site/current.ts";
import { pageLink, tabHref } from "../site/pages.ts";

/** A data-* attribute with no value: <button {...flag(DATA.copyLink)}> is <button data-copy-link>. */
export const flag = (name: string): Record<string, string> => ({ [name]: "" });

/** What a link to the page of another language, `code`, carries: its address at the tab that's open, if there is
    one, and that language's home page, from which the script points the link at each tab it opens. */
export function languageLinkAttributes(code: string, openTab: string | undefined): Record<string, string> {
  const home = site.pagePath(code);
  return { href: openTab ? tabHref(site, code, openTab) : home, [DATA.home]: home };
}

/** What a link to `href` carries on the page in `code`: its address on the site (a tab's page, for "#about"), a
    new tab for another site, and for a link the config's `viewer` lists, the address the viewer frames and what
    the viewer calls it. */
export function linkAttributes(href: string, viewerTitle: string, code: string): Record<string, string> {
  const framedAddress = site.config.viewer?.[href];
  const opensInViewer: Record<string, string> = framedAddress
    ? { [DATA.viewerAddress]: framedAddress, [DATA.viewerTitle]: viewerTitle }
    : {};
  return { href: pageLink(site, code, href), ...newTabAttributes(href), ...opensInViewer };
}
