/* What a value in the config has to look like before a page can carry it.
   The pages escape everything they write into an attribute or an address,
   but escaping doesn't make a javascript: link safe to follow, or a
   language code that isn't one a folder's name. Each function here answers
   one question about one value; the config's checks (../validate.ts) say
   what to tell the person when the answer is no. */

/** "en", "pt-BR": two or three lowercase letters, then any number of
    "-Part"s. Not "English", and not "../en". */
const LANGUAGE_CODE = /^[a-z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

/** Whether `code` can be a page's `lang` attribute and its folder's name. */
export const isLanguageCode = (code: string): boolean => LANGUAGE_CODE.test(code);

/** "en_US", or "en" alone: a language, then maybe "_" and a region in
    capitals, as Open Graph writes a locale. Not "en-US". */
const LOCALE = /^[a-z]{2,3}(_[A-Z]{2})?$/;

/** Whether `locale` can be a page's og:locale. */
export const isLocale = (locale: string): boolean => LOCALE.test(locale);

/** "#191919", "#fff", or a colour's name ("black"): a # and 3, 4, 6 or 8
    hex digits, or letters alone. Nothing with a quote, a space or a bracket
    in it. */
const COLOUR = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|[a-z]+)$/i;

/** Whether `colour` can be the page's theme-color. */
export const isColour = (colour: string): boolean => COLOUR.test(colour);

/** "https://github.com/alex": http:// or https://, then anything but a
    space, a quote, an angle bracket or a backslash. */
const WEB_ADDRESS = /^https?:\/\/[^\s"'<>\\]+$/;

/** Whether `address` is a full web address. */
export const isWebAddress = (address: string): boolean => WEB_ADDRESS.test(address);

/** Whether `address` is a web address that a browser reads as https://:
    the only kind a page served over HTTPS can show in a frame. */
export const isHttpsAddress = (address: string): boolean =>
  isWebAddress(address) && URL.canParse(address) && new URL(address).protocol === "https:";

/** "https://example.com", "https://alex.github.io/portfolio/": a web
    address with no query and no #, and no empty step in its path. Not
    "https://example.com/?q=1", and not "https://example.com//": every link
    on that site would start "//", which a browser reads as another site. */
const SITE_ADDRESS = /^https?:\/\/[^\s"'<>\\/?#]+(\/[^\s"'<>\\/?#]+)*\/?$/;

/** Whether `address` can be where the site is: every link the pages make
    to the site is built on it. */
export const isSiteAddress = (address: string): boolean => SITE_ADDRESS.test(address);

/** "/assets/og.png": one slash, then anything but a space, a quote, an
    angle bracket or a backslash. Not "assets/og.png" (which would be read
    from the page's own folder), and not "//example.com/og.png" (another
    site). */
const PATH_ON_SITE = /^\/(?!\/)[^\s"'<>\\]*$/;

/** Whether `path` names a file on this site, from the site's own root. */
export const isPathOnSite = (path: string): boolean => PATH_ON_SITE.test(path);

/** "alex@example.com": something, an @, something, with no space, quote,
    angle bracket, backslash or second @. It only has to be safe in a
    mailto: link; whether mail gets there is the owner's to try. */
const EMAIL_ADDRESS = /^[^\s@"'<>\\]+@[^\s@"'<>\\]+$/;

/** Whether `address` can follow "mailto:" in a link. */
export const isEmailAddress = (address: string): boolean => EMAIL_ADDRESS.test(address);

/** Whether `size` is a size in pixels a picture can have: a whole number
    above zero. */
export const isPixelCount = (size: number): boolean => Number.isInteger(size) && size > 0;

/** Whether the account menu's clock can tell the time in `zone`: it uses
    this constructor (src/app/account.ts), which throws for a zone it
    doesn't know ("Tokyo", for "Asia/Tokyo"). */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** A space, a line break or a control character, anywhere in a link. A
    browser drops some of them before it reads the link's scheme, so
    "java\nscript:alert(1)" would run. */
const SPACE_OR_CONTROL_CHARACTER = /[\s\x00-\x1f\x7f]/;

/** A link's scheme, if it has one: "https" in "https://example.com",
    "mailto" in "mailto:alex@example.com", "javascript" in
    "javascript:alert(1)". "#about", "/resume.pdf" and "resume.pdf" have
    none. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;

/** The schemes a link on the site may have. Any other (javascript:, data:,
    vbscript:) could run code or show a page of someone's making. */
const SAFE_SCHEMES = ["http", "https", "mailto"];

/** Whether a link is safe to follow: a web or mailto address, #thread or a
    path, with nothing a browser would skip over (spaces or control
    characters, as in "java\nscript:"). */
export function isSafeHref(href: string): boolean {
  if (SPACE_OR_CONTROL_CHARACTER.test(href)) return false;
  const scheme = href.match(SCHEME)?.[1];
  return scheme === undefined || SAFE_SCHEMES.includes(scheme.toLowerCase());
}
