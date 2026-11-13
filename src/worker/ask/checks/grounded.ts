/* Whether a reply the model wrote names and counts only what the site does.

   A reply is written from the lines the picker chose, in the model's own
   words: it may rephrase them, say yes or no, deny, hedge, and use the
   ordinary words of the question it answers. What it may not do is bring in
   a fact of its own, and the facts a check can tell from ordinary words are
   names, numbers and addresses (claims.ts). So each of those has to be in
   the reply's sources (vocabulary.ts).

   What the check can't tell from an ordinary word, it lets through: a name
   that only starts a sentence ("Tokyo is…", unless the question names it),
   a name in lower case, in kana or in kanji, a number in kanji, and "one",
   which is as often a pronoun. Nor does it judge what a reply says in
   ordinary words: "No" on lines that mean yes passes. Keeping a reply to
   what its lines say is the job of the model's instructions, and the page
   shows those lines under the reply, so a visitor can see what it was made
   from. */
import { namedIn } from "../coverage.ts";
import { withPlainCharacters } from "../text/words.ts";
import { claimsIn, type Claim } from "./claims.ts";
import { hasAddress, hasNumber, hasWord, vocabularyOf, type Vocabulary } from "./vocabulary.ts";

/** The languages a reply can be written, and checked, in. */
export const CHECKABLE_LANGUAGES: readonly string[] = ["en", "ja"];

/** Of those, the ones written without capitals. */
const LANGUAGES_WITHOUT_CAPITALS: readonly string[] = ["ja"];

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
    language the reply is in (one of CHECKABLE_LANGUAGES). */
export function checkReply(written: string, sources: Sources, question: string, lang: string): CheckedReply {
  const vocabulary = vocabularyOf(sources.lines, sources.title, sources.q, sources.owner);
  const claims = claimsIn(withPlainCharacters(written), {
    isEveryLatinWordAName: LANGUAGES_WITHOUT_CAPITALS.includes(lang),
    namedInQuestion: new Set(namedIn(question, sources.owner)),
  });
  const unsourced = [...new Set(claims.filter((claim) => !isSourced(claim, vocabulary)).map((claim) => claim.text))];
  return unsourced.length ? { unsourced } : { reply: written };
}
