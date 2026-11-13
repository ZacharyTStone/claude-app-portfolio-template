import { newTabAttributes } from "../contracts/links.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { site } from "../site/current.ts";

/** A data-* attribute with no value: <button {...flag(DATA.copyLink)}> is <button data-copy-link>. */
export const flag = (name: string): Record<string, string> => ({ [name]: "" });

/** What a link to `href` carries: its address on the site, a new tab for another site, and for a link the
    config's `viewer` lists, the address the viewer frames and what the viewer calls it. */
export function linkAttributes(href: string, viewerTitle: string): Record<string, string> {
  const framedAddress = site.config.viewer?.[href];
  const opensInViewer: Record<string, string> = framedAddress
    ? { [DATA.viewerAddress]: framedAddress, [DATA.viewerTitle]: viewerTitle }
    : {};
  return { href: site.link(href), ...newTabAttributes(href), ...opensInViewer };
}
