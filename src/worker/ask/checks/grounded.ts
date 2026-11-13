/* Whether a reply the model wrote names and counts only what the site does.
   The model may put its lines in its own words; what it may not do is bring
   in a fact of its own, and the facts a check can tell from ordinary words
   are names, numbers and addresses (claims.ts). Each has to be in the
   reply's sources (vocabulary.ts).

   What the check can't tell from an ordinary word, it lets through, and it
   doesn't judge what a reply says in ordinary words: "No" on lines that
   mean yes passes. That's why the page shows the lines under the reply. */
import { namedIn } from "../coverage.ts";
import { withPlainCharacters } from "../text/words.ts";
import { claimsIn, type Claim } from "./claims.ts";
import { hasAddress, hasNumber, hasWord, vocabularyOf, type Vocabulary } from "./vocabulary.ts";

/** How the check reads each language a reply can be written in. Japanese
    has no capitals to tell a name by. */
const READS = {
  en: { isEveryLatinWordAName: false },
  ja: { isEveryLatinWordAName: true },
} as const;

export type CheckedLanguage = keyof typeof READS;

export const isCheckedLanguage = (lang: string): lang is CheckedLanguage => Object.hasOwn(READS, lang);

/** What a reply's names, numbers and addresses may come from. What the
    visitor typed is never one of them. */
export type Sources = {
  /** The lines it's written from. */
  lines: string;
  /** The name of the tab they're in. */
  title: string;
  /** The site's own question they answer. */
  q: string;
  /** The owner's names, in every way the page writes them. */
  owner: string;
};

/** The reply as it may be shown; or, when it may not be, what it claims
    that its sources don't have, as it wrote it: for the log, and for asking
    the model again. */
export type CheckedReply = { reply: string; unsourced?: undefined } | { reply?: undefined; unsourced: string[] };

function isSourced(claim: Claim, vocabulary: Vocabulary): boolean {
  if (claim.kind === "address") return hasAddress(vocabulary, claim.text);
  // A word the sources have as it's written is theirs, whatever it claims.
  if (hasWord(vocabulary, claim.word) || hasWord(vocabulary, claim.text)) return true;
  if (claim.kind === "number") return hasNumber(vocabulary, claim.text);
  if (claim.kind === "site") return false;
  return claim.names.every((name) => hasWord(vocabulary, name));
}

/** `written`, as it may be shown: every name, number and address in it has
    to be in `sources`. `question` is what the visitor typed, and `lang` the
    language the reply is in. */
export function checkReply(written: string, sources: Sources, question: string, lang: CheckedLanguage): CheckedReply {
  const vocabulary = vocabularyOf(sources.lines, sources.title, sources.q, sources.owner);
  const claims = claimsIn(withPlainCharacters(written), {
    ...READS[lang],
    namedInQuestion: new Set(namedIn(question, sources.owner)),
  });
  const unsourced = [...new Set(claims.filter((claim) => !isSourced(claim, vocabulary)).map((claim) => claim.text))];
  return unsourced.length ? { unsourced } : { reply: written };
}
