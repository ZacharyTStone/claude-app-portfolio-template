/* The config, and what every part of the build works out from it: the
   host, the languages in order, and where everything is. */

import { trimEnd } from "es-toolkit";
import type { Host, SiteConfig } from "../config/site-config.ts";
import type { Language } from "../config/language.ts";
import { basePath } from "./url.ts";

/** Who serves the site when the config's `host` is left out. */
const DEFAULT_HOST: Host = "cloudflare";

/** A site as the build sees it: its config, and the answers to "which
    languages?" and "where is it?", worked out from the config once. */
export type Site = {
  /** site.config.ts, as it's written. */
  config: SiteConfig;
  /** Who serves the built site: the config's `host`, or DEFAULT_HOST. */
  host: Host;
  /** The languages' codes ("en", "ja"), in the config's order. The first is
      the main one, at the site's root. */
  codes: string[];
  /** The main language's code. */
  main: string;
  /** A language's text, by its code. Throws for a code the config doesn't
      have. */
  language: (code: string) => Language;
  /** A path on the site, from its own root ("/assets/og.png"), as the pages
      link to it: under the site's path, if it has one
      ("/portfolio/assets/og.png"). Any other link (https:, mailto:,
      #thread or a relative one) is left as it is. */
  link: (href: string) => string;
  /** A path on the site as a full address: "https://example.com/assets/og.png". */
  fileUrl: (path: string) => string;
  /** A language's page, as the pages link to it: the site's root for the
      main one, <code>/ under it for the others. */
  pagePath: (code: string) => string;
  /** A language's page as a full address: "https://example.com/ja/". */
  pageUrl: (code: string) => string;
};

/** One language's page, which each part of it is drawn from. */
export type Page = {
  /** The language's code. */
  code: string;
  /** The language's text. */
  language: Language;
};

/** A path from the site's own root: "/assets/og.png", or "/" alone. Not
    "//example.com/og.png", which a browser reads as another site. */
const PATH_FROM_SITE_ROOT = /^\/(?!\/)/;

/** A config as a Site. Throws if the config has no languages. */
export function makeSite(config: SiteConfig): Site {
  const codes = Object.keys(config.languages);
  const main = codes[0];
  if (main === undefined) throw new Error("site.config.ts has no languages");
  // For "https://you.github.io/portfolio/", the site's address is
  // "https://you.github.io/portfolio" and its path "/portfolio/".
  // An address that isn't one is for the config's checks to report, not to crash on.
  const siteAddress = trimEnd(config.url, "/");
  const sitePath = URL.canParse(config.url) ? basePath(config.url) : "/";
  const link = (href: string) => (PATH_FROM_SITE_ROOT.test(href) ? sitePath + href.slice(1) : href);
  const fileUrl = (pathFromSiteRoot: string) => siteAddress + pathFromSiteRoot;
  // A language's page, from the site's own root: "/", or "/ja/".
  const pageFromSiteRoot = (code: string) => (code === main ? "/" : `/${code}/`);
  return {
    config,
    host: config.host ?? DEFAULT_HOST,
    codes,
    main,
    language(code) {
      const language = config.languages[code];
      if (!language) throw new Error(`site.config.ts has no language "${code}"`);
      return language;
    },
    link,
    fileUrl,
    pagePath: (code) => link(pageFromSiteRoot(code)),
    pageUrl: (code) => fileUrl(pageFromSiteRoot(code)),
  };
}

/** One language's page of a site. Throws for a code the config doesn't
    have. */
export const makePage = (site: Site, code: string): Page => ({ code, language: site.language(code) });
