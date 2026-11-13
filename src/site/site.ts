/* A site as the build reads it: the config, and what's worked out from it
   once (who serves it, its languages in order, where everything is, and
   every string a page says). */

import { omitBy, pick, trimEnd } from "es-toolkit";
import { ENGLISH_STRINGS, isEnglish } from "../config/english-strings.ts";
import type { Language } from "../config/language.ts";
import type { Host, SiteConfig } from "../config/site-config.ts";
import { PAGE_STRING_NAMES, REQUIRED_SCRIPT_STRING_NAMES, type Strings } from "../config/strings.ts";
import { basePath } from "./url.ts";

/** Who serves the site when the config's `host` is left out. */
const DEFAULT_HOST: Host = "cloudflare";

/** A language as the pages read it: the config's, with every string a page
    says, so nothing built from it meets one that's left out. */
export type SiteLanguage = Omit<Language, "strings"> & { strings: Strings };

export type Site = {
  /** site.config.ts, as it's written. */
  config: SiteConfig;
  host: Host;
  /** The languages' codes ("en", "ja"), in the config's order. */
  codes: string[];
  /** The main language's code: its page is at the site's root. */
  main: string;
  /** Throws for a code the config doesn't have. */
  language: (code: string) => SiteLanguage;
  /** A path on the site, from its own root ("/assets/og.png"), as the pages
      link to it: under the site's path, if it has one
      ("/portfolio/assets/og.png"). Any other link (https:, mailto:,
      #thread or a relative one) is left as it is. */
  link: (href: string) => string;
  /** A path on the site as a full address: "https://example.com/assets/og.png". */
  fileUrl: (path: string) => string;
  /** A language's page, as the pages link to it: "/", or "/ja/". */
  pagePath: (code: string) => string;
  /** A language's page as a full address: "https://example.com/ja/". */
  pageUrl: (code: string) => string;
};

/** One language's page, which each part of it is drawn from. */
export type Page = {
  code: string;
  language: SiteLanguage;
};

/** What a page in another language says for a string its config leaves
    out, which the config's checks call a problem. Only English's own page
    takes the strings for the parts a site may not have. */
const ENGLISH_FOR_WHAT_EVERY_PAGE_SAYS = pick(ENGLISH_STRINGS, [...PAGE_STRING_NAMES, ...REQUIRED_SCRIPT_STRING_NAMES]);

function withEveryString(code: string, language: Language): SiteLanguage {
  const fallback = isEnglish(code) ? ENGLISH_STRINGS : ENGLISH_FOR_WHAT_EVERY_PAGE_SAYS;
  const stated = omitBy(language.strings ?? {}, (wording) => wording === undefined);
  return { ...language, strings: { ...fallback, ...stated } };
}

/** "/assets/og.png", or "/" alone. Not "//example.com/og.png", which a
    browser reads as another site. */
const PATH_FROM_SITE_ROOT = /^\/(?!\/)/;

/** Throws if the config has no languages. */
export function makeSite(config: SiteConfig): Site {
  const languages = new Map(
    Object.entries(config.languages).map(([code, language]) => [code, withEveryString(code, language)]),
  );
  const codes = [...languages.keys()];
  const main = codes[0];
  if (main === undefined) throw new Error("site.config.ts has no languages");
  // For "https://you.github.io/portfolio/", the site's address is
  // "https://you.github.io/portfolio" and its path "/portfolio/".
  // An address that isn't one is for the config's checks to report, not to crash on.
  const siteAddress = trimEnd(config.url, "/");
  const sitePath = URL.canParse(config.url) ? basePath(config.url) : "/";
  const link = (href: string) => (PATH_FROM_SITE_ROOT.test(href) ? sitePath + href.slice(1) : href);
  const fileUrl = (pathFromSiteRoot: string) => siteAddress + pathFromSiteRoot;
  const pageFromSiteRoot = (code: string) => (code === main ? "/" : `/${code}/`);
  return {
    config,
    host: config.host ?? DEFAULT_HOST,
    codes,
    main,
    language(code) {
      const language = languages.get(code);
      if (!language) throw new Error(`site.config.ts has no language "${code}"`);
      return language;
    },
    link,
    fileUrl,
    pagePath: (code) => link(pageFromSiteRoot(code)),
    pageUrl: (code) => fileUrl(pageFromSiteRoot(code)),
  };
}

/** Throws for a code the config doesn't have. */
export const makePage = (site: Site, code: string): Page => ({ code, language: site.language(code) });
