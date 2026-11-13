/* The shape of site.config.ts: everything the site says, in every
   language. This folder is the config's manual: each field says what it is,
   where it shows on the page, and what happens when it's left out.

   Reading order: SiteConfig, here (the whole site), then language.ts (one
   language's page and its parts, in the order the page draws them),
   strings.ts (the page's wording), question-card.ts (the question card)
   and blocks.ts (what an answer is made of: paragraphs, cards, figures).

   Types can't say everything. That a `tab` names a thread, an `icon` is one
   the stylesheet has, and every language has the same threads is checked
   before a build (src/site/checks), which stops with a message that
   names the field. */

import type { Language } from "./language.ts";

/** The whole site: what site.config.ts exports. */
export type SiteConfig = {
  /** Where the site is: "https://example.com". If it is served under a
      path, as a GitHub project site is, include it:
      "https://you.github.io/portfolio/". Every link the pages make then
      starts with that path. Paths elsewhere in the config
      ("/assets/og.png") are from the site's own root, wherever that is. */
  url: string;
  /** Who serves the built site, dist/ ("cloudflare" if left out). It decides
      how the security headers in src/site/security-headers.ts reach the browser:
      - "cloudflare" and "netlify" read a _headers file, which the build
        writes into dist/. Cloudflare (Workers static assets, set up by
        your own wrangler.jsonc) is the only host that runs Ask's Worker.
      - "vercel", "github-pages" and "static" (any other host: S3, nginx,
        Caddy…) get no file, so every page carries its
        Content-Security-Policy and referrer policy in <meta> tags
        (browsers take no others from a page). Set the rest on the host
        where it lets you.
      Each host runs `npm run build` and publishes dist/. */
  host?: Host;
  /** Strict-Transport-Security's extras, includeSubDomains and preload.
      Both are hard to undo: leave them out unless every subdomain is
      HTTPS for good. */
  hsts?: Hsts;
  /** Your name, as the site writes it everywhere ("Alex Example"): the
      wordmark at the top of the sidebar, the window's title after an open
      tab's name ("About · Alex Example"), the label under every tab's
      composer (before strings.model), the 404 page's title, and what Ask's
      model calls you. A language that writes it another way says so in its
      own `person.name`. */
  name: string;
  /** The language your name is written in ("en"), so pages in other
      languages mark it (lang="en" on the wordmark, for a screen reader to
      say it right). Leave out if no page needs to. */
  nameLang?: string;
  /** Your time zone, for the clock in the account menu ("Asia/Tokyo"): an
      IANA name, which the build checks. */
  timezone: string;
  /** How to reach you. */
  links: ContactLinks;
  /** More about you for search engines (schema.org Person data in the
      page's <head>). None of it shows on the page. Leave out, or leave any
      field out, to say less. */
  person?: SchemaPerson;
  /** The social card: the picture a link to the site is previewed with. */
  social: SocialCard;
  /** The colour a browser draws its own bars in around the page, where it
      does (<meta name="theme-color">): "#191919", or a colour's name. */
  themeColor: string;
  /** A question typed into the card goes to /ask (ASK_PATH, in src/contracts/ask.ts), where a
      small model picks which of the site's answers it's asking for. Leave
      out to turn that off: a typed question then always gets the
      "Something else" reply. It needs host "cloudflare", where its Worker
      runs. */
  ask?: {
    /** Who you are, in a few words, for the model: "a software engineer". */
    role: string;
  };
  /** Links that open in the site's own viewer, a panel beside the
      conversation (the whole screen on a phone), instead of in a new tab:
      each link's address, exactly as an `href` in this config has it, and
      the address the viewer shows in a frame. Wherever a link card, a
      picture or a row of the details panel links to one of them, it opens
      in the viewer.

          viewer: {
            "https://docs.google.com/document/d/abc123/edit": "https://docs.google.com/document/d/abc123/preview",
          }

      A Google Doc, Sheet or Slides deck that anyone with the link can view
      is shown at its address ending "/preview". Not every site lets itself
      be shown in a frame (GitHub and LinkedIn don't): open the viewer once
      and look.

      What a frame shows is loaded from that other site, which sees the
      visitor as any site they open does. It's the one thing a page of
      yours loads from anywhere else, and only once the visitor opens it:
      the security policy (src/site/security-headers.ts) lets frames come from
      these addresses' sites and no other. Without JavaScript the link
      opens as any link does.

      It needs strings.viewerOpen and strings.viewerClose in each
      language. Leave out for a site with no viewer: every link then opens
      as links do. */
  viewer?: Record<string, string>;
  /** llms.txt, the site as plain text for a model reading it on someone's
      behalf: a one-line summary, and a paragraph about you. The build adds
      the rest: the details panel's links, how to reach you, and every
      question the site answers with its answer, in the main language. */
  llms: {
    /** One line, quoted under the file's heading: who you are and what the
        site is. */
    summary: string;
    /** A paragraph under "About". */
    about: string;
  };
  /** Each language's text, by its code ("en", "ja", "pt-BR"). The first is
      the site's main one, at /. Each other one is at /<code>/, gets a
      switch in the sidebar, and has the same threads and questions with
      the same ids. With one language the site has no switch.

          languages: { en: { …the English page… }, ja: { …the Japanese page… } } */
  languages: Record<string, Language>;
};

/** The hosts `host` can name. */
export const HOSTS = ["cloudflare", "netlify", "vercel", "github-pages", "static"] as const;

/** One of HOSTS. */
export type Host = (typeof HOSTS)[number];

/** How to reach you: the account menu, "Something else", the printed page,
    llms.txt and the schema.org data all read these. */
export type ContactLinks = {
  /** Your email address ("alex@example.com", no "mailto:"). It's the
      account menu's first row and the link "Something else" offers. */
  email: string;
  /** Your GitHub profile's address ("https://github.com/alex-example").
      With it, the account menu has a GitHub row. Leave out for none. */
  github?: string;
  /** Your LinkedIn profile's address. With it, "Something else" also
      offers a message to send there (each language then needs
      asked.linkedin and asked.message). Leave out for none. */
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
  /** Where you're based: "JP". */
  country?: string;
  /** The languages you speak, as codes: ["en", "ja"] (the site's own
      languages, if left out). */
  knowsLanguage?: string[];
};

/** The picture a link to the site is previewed with (Open Graph and
    Twitter cards). Each language's meta.imageAlt says what it shows. */
export type SocialCard = {
  /** A path on the site: "/assets/og.png". */
  image: string;
  /** Its size in pixels: 1200 by 630 is the usual. */
  width: number;
  height: number;
};

/** Strict-Transport-Security's two extras, from site.config.ts. Both are
    hard to undo, so they're off unless a site asks for them. */
export type Hsts = {
  /** Every subdomain too: only if every one of them is HTTPS for good. */
  includeSubDomains?: boolean;
  /** Ask browsers to build the site in as HTTPS-only (hstspreload.org).
      Needs includeSubDomains. */
  preload?: boolean;
};
