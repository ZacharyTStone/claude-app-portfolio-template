import { newTabAttributes } from "../contracts/links.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { site } from "../site/current.ts";
import { pageLink, tabHref } from "../site/pages.ts";
import { postPages } from "../site/writing/post-pages.ts";

/** A data-* attribute with no value: <button {...flag(DATA.copyLink)}> is <button data-copy-link>. */
export const flag = (name: string): Record<string, string> => ({ [name]: "" });

/** What a link to the page of another language, `code`, carries: its address at the tab that's open, if there is
    one, and that language's home page, from which the script points the link at each tab it opens. */
export function languageLinkAttributes(code: string, openTab: string | undefined): Record<string, string> {
  const home = site.pagePath(code);
  return { href: openTab ? tabHref(site, code, openTab) : home, [DATA.home]: home };
}

/** Each post's own page on the site, as the pages link to it, by the post's address where it was posted: none
    on a site whose viewer doesn't show its posts. */
const POST_PAGES = new Map(postPages(site).map(({ post, path }) => [post.url, site.link(path)]));

/** What a link the viewer opens carries: the address the viewer frames (the one the config's `viewer` gives, or
    else a post's own page) and what the viewer calls it. Nothing, for any other link. */
function viewerAttributes(href: string, viewerTitle: string): Record<string, string> {
  const framedAddress = site.config.viewer?.[href];
  if (framedAddress) return { [DATA.viewerAddress]: framedAddress, [DATA.viewerTitle]: viewerTitle };
  const postPage = POST_PAGES.get(href);
  return postPage ? { [DATA.viewerPost]: postPage, [DATA.viewerTitle]: viewerTitle } : {};
}

/** What a link to `href` carries on the page in `code`: its address on the site (a tab's page, for "#about"), a
    new tab for another site, and what the viewer needs to open it, if it does (viewerAttributes). */
export function linkAttributes(href: string, viewerTitle: string, code: string): Record<string, string> {
  return { href: pageLink(site, code, href), ...newTabAttributes(href), ...viewerAttributes(href, viewerTitle) };
}
