/* The config, and what every part of the build works out from it: the
   host, the languages in order, and where everything is. */

import type { Host, Language, SiteConfig } from "../shared/config.ts";
import { basePath } from "../shared/url.ts";

export type Site = {
  config: SiteConfig;
  host: Host;
  /** The languages' codes. The first is the main one, at the site's root. */
  codes: string[];
  main: string;
  lang: (code: string) => Language;
  /** A path on the site, from its own root ("/assets/og.png"), as the pages
      link to it: under the site's path, if it has one
      ("/portfolio/assets/og.png"). Any other link (https:, mailto:,
      #thread or a relative one) is left as it is. */
  link: (href: string) => string;
  /** A path on the site as a full address: "https://example.com/assets/og.png". */
  address: (path: string) => string;
  /** A language's page, as the pages link to it: the site's root for the
      main one, <code>/ under it for the others. */
  path: (code: string) => string;
  /** Its full address. */
  url: (code: string) => string;
};

/** One language's page, which each part of it is drawn from. */
export type Page = { site: Site; code: string; lang: Language };

export function makeSite(config: SiteConfig): Site {
  const codes = Object.keys(config.languages);
  const main = codes[0];
  if (main === undefined) throw new Error("site.config.ts has no languages");
  // For "https://you.github.io/portfolio/", the base is
  // "https://you.github.io/portfolio" and the root "/portfolio/".
  // An address that isn't one is for validate.ts to report, not to crash on.
  const base = config.url.replace(/\/+$/, "");
  const root = URL.canParse(config.url) ? basePath(config.url) : "/";
  const link = (href: string) => (/^\/(?!\/)/.test(href) ? root + href.slice(1) : href);
  const address = (path: string) => base + path;
  const page = (code: string) => (code === main ? "/" : `/${code}/`);
  return {
    config,
    host: config.host ?? "cloudflare",
    codes,
    main,
    lang(code) {
      const lang = config.languages[code];
      if (!lang) throw new Error(`site.config.ts has no language "${code}"`);
      return lang;
    },
    link,
    address,
    path: (code) => link(page(code)),
    url: (code) => address(page(code)),
  };
}

export const makePage = (site: Site, code: string): Page => ({ site, code, lang: site.lang(code) });
