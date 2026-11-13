/* How a link on the site behaves, the same whether a page or the browser
   code makes it. */

/** A link to another site (an http: or https: address) opens in a new
    tab, and tells that site nothing about this one. These are the
    attributes for it, to spread onto the link; none for any other link. */
export const newTabAttributes = (href: string): { target?: string; rel?: string } =>
  /^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};

/** Whether the browser follows a link in the text it shows (a personal
    answer, the script's words): a #tab, a web or a mailto address. It
    doesn't know the site's path, so it can't link to a file on the site;
    any other link is shown as its words. */
export const browserFollows = (href: string): boolean => /^(#|https?:|mailto:)/i.test(href);
