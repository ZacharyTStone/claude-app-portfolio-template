/* Which of the site's languages a question is written in, as far as its
   letters tell: a question in English on the Japanese page ("Does Alex have
   the JLPT?") is answered from the English answers, in English, and one in
   Japanese on the English page from the Japanese. Only a script tells one
   language from another here, so two languages in the same one (English and
   Spanish) aren't told apart: the page's stays. A question in Japanese that
   names something in Latin letters ("Reactの経験は？") is still in Japanese. */

/** The letters a language's script (ISO 15924, as Intl.Locale gives it)
    is written in. Japanese and Korean mix scripts, and Chinese is Han. */
const MIXED_SCRIPTS: Record<string, string> = {
  Jpan: "\\p{Script=Han}\\p{Script=Hiragana}\\p{Script=Katakana}",
  Kore: "\\p{Script=Hangul}\\p{Script=Han}",
  Hans: "\\p{Script=Han}",
  Hant: "\\p{Script=Han}",
};

/** "Jpan" for "ja", "Latn" for "en": undefined for a code Intl can't read. */
function scriptOf(code: string): string | undefined {
  try {
    return new Intl.Locale(code).maximize().script;
  } catch {
    return undefined;
  }
}

/** A letter of these says more than a Latin one: "経験" is a word in two. */
const DENSE_LETTER_WEIGHT = 3;

/** How many of `question`'s letters are in `script`, a dense script's
    counted as several. */
function lettersIn(question: string, script: string): number {
  try {
    const letters = new RegExp(`[${MIXED_SCRIPTS[script] ?? `\\p{Script=${script}}`}]`, "gu");
    const count = question.match(letters)?.length ?? 0;
    return script in MIXED_SCRIPTS ? count * DENSE_LETTER_WEIGHT : count;
  } catch {
    return 0;
  }
}

/** The language to answer `question` in: the one of `offered` most of its
    letters are in, or `pageLang` when that's the page's own, when it has
    none of theirs, or when several are alike (two in the same script). */
export function questionLanguage(question: string, pageLang: string, offered: readonly string[]): string {
  const text = question.normalize("NFKC");
  const scores = offered.map((code) => {
    const script = scriptOf(code);
    return { code, letters: script === undefined ? 0 : lettersIn(text, script) };
  });
  const most = Math.max(0, ...scores.map(({ letters }) => letters));
  const leaders = scores.filter(({ letters }) => letters === most && most > 0).map(({ code }) => code);
  if (leaders.includes(pageLang)) return pageLang;
  const [only, ...others] = leaders;
  return only !== undefined && !others.length ? only : pageLang;
}
