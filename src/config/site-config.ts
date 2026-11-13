/* What site.config.ts exports. This folder is the config's manual: an editor
   shows a field's comment as the field is written, and docs/ has the guides.
   What types can't say (a `tab` names a thread, every language has the same
   threads) the build checks, and names the field (src/site/validate.ts). */

import type { Language } from "./language.ts";

export type SiteConfig = {
  /** Where the site is: "https://example.com". Served under a path, as a
      GitHub project site is, it includes the path
      ("https://you.github.io/portfolio/"), and every link the pages make
      starts with it. Paths elsewhere in the config ("/assets/og.png") are
      from the site's own root. */
  url: string;
  /** Who serves the built site ("cloudflare" if left out). "cloudflare"
      and "netlify" read the security headers from a file the build writes;
      on any other host the pages carry what a page can, in <meta> tags.
      Only "cloudflare" runs Ask. */
  host?: Host;
  /** Strict-Transport-Security's extras. Both are hard to undo: leave them
      out unless every subdomain is HTTPS for good. */
  hsts?: Hsts;
  /** As the site writes it everywhere ("Alex Example"): the top of the
      sidebar, the window's title, under every tab's composer, the 404
      page, and what Ask's model calls you. A language that writes it
      another way says so in its own `person.name`. */
  name: string;
  /** The language your name is written in ("en"), so pages in other
      languages mark it for a screen reader to say it right. Leave out if
      no page needs to. */
  nameLang?: string;
  /** For the clock in the account menu: an IANA name ("Asia/Tokyo"),
      which the build checks. */
  timezone: string;
  /** How to reach you. */
  links: ContactLinks;
  /** More about you for search engines (schema.org Person data). None of
      it shows on the page. Leave out, or leave any field out, to say less. */
  person?: SchemaPerson;
  /** The picture a link to the site is previewed with. */
  social: SocialCard;
  /** The colour a browser draws its own bars in around the page, where it
      does: "#191919", or a colour's name. */
  themeColor: string;
  /** Ask: a question typed into the card goes to a small model, which
      picks which of the site's answers it's asking for. Leave out to turn
      it off: a typed question then gets the "Something else" reply. It
      needs host "cloudflare". */
  ask?: {
    /** Who you are, in a few words, for the model: "a software engineer". */
    role: string;
  };
  /** Links that open in a panel beside the conversation, in a frame,
      instead of in a new tab: each link's `href` exactly as this config has
      it, and the address the frame shows
      ({ "https://docs.google.com/document/d/abc/edit": "https://docs.google.com/document/d/abc/preview" }).
      Each language then needs strings.viewerOpen and strings.viewerClose.
      Leave out for no viewer. */
  viewer?: Record<string, string>;
  /** llms.txt, the site as plain text for a model reading it on someone's
      behalf. The build adds the panel's links, how to reach you, and every
      question with its answer, in the main language. */
  llms: {
    /** One line, quoted under the file's heading: who you are and what the
        site is. */
    summary: string;
    /** A paragraph under "About". */
    about: string;
  };
  /** Each language's text, by its code ("en", "ja", "pt-BR"). The first is
      the main one, at /. Each other one is at /<code>/, gets a switch in
      the sidebar, and has the same threads and questions with the same
      ids. */
  languages: Record<string, Language>;
};

export const HOSTS = ["cloudflare", "netlify", "vercel", "github-pages", "static"] as const;

export type Host = (typeof HOSTS)[number];

/** The account menu, "Something else", the printed page, llms.txt and the
    schema.org data all read these. */
export type ContactLinks = {
  /** Without "mailto:" ("alex@example.com"). It's the account menu's first
      row and the link "Something else" offers. */
  email: string;
  /** Your profile's address ("https://github.com/alex-example"). With it,
      the account menu has a GitHub row. */
  github?: string;
  /** Your profile's address. With it, "Something else" also offers a
      message to send there (each language then needs asked.linkedin and
      asked.message). */
  linkedin?: string;
};

/** What the schema.org Person data says beyond your name and job title
    (those are each language's `person`). */
export type SchemaPerson = {
  /** A picture of you: a path on the site ("/assets/portrait.webp"). */
  image?: string;
  /** Your employer's name: "Acme". */
  worksFor?: string;
  /** Where you studied: "Example University". */
  alumniOf?: string;
  /** Where you're based, as a country's code: "JP". */
  country?: string;
  /** The languages you speak, as codes: ["en", "ja"] (the site's own
      languages, if left out). */
  knowsLanguage?: string[];
};

/** For Open Graph and Twitter cards. Each language's meta.imageAlt says
    what the picture shows. */
export type SocialCard = {
  /** A path on the site: "/assets/og.png". */
  image: string;
  /** The picture's width in pixels: 1200 is the usual. */
  width: number;
  /** The picture's height in pixels: 630 is the usual. */
  height: number;
};

export type Hsts = {
  /** Every subdomain too: only if every one of them is HTTPS for good. */
  includeSubDomains?: boolean;
  /** Ask browsers to build the site in as HTTPS-only (hstspreload.org).
      Needs includeSubDomains. */
  preload?: boolean;
};
