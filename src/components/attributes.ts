/* Attributes a component spreads onto an element: the data-* attributes
   whose names are in src/contracts/page-attributes.ts (DATA), which markup can't
   write as plain attributes. One with a value is spread as it is:
   <button {...{ [DATA.prompt]: prompt.answer }}>. */
import { DATA } from "../contracts/page-attributes.ts";
import { site } from "../site/current.ts";

/** A bare data-* attribute, by its name in src/contracts/page-attributes.ts:
    <button {...flag(DATA.copyLink)}> is <button data-copy-link>. */
export const flag = (name: string): Record<string, string> => ({ [name]: "" });

/** For a link the site's viewer opens (the config's `viewer` has its
    `href`): the address the viewer shows in its frame, and `title`, what the
    viewer calls it. Nothing for any other link, which opens as links do. */
export function viewerLink(href: string, title: string): Record<string, string> {
  const frameAddress = site.config.viewer?.[href];
  return frameAddress ? { [DATA.view]: frameAddress, [DATA.viewTitle]: title } : {};
}
