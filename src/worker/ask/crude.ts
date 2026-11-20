/* Words no question about a person needs: obscenities, sexual words and
   slurs, in English and Japanese. A question with one is turned away before
   any model reads it, as if a model had called it inappropriate
   (handler.ts): its asker is blocked the same way, it costs nothing, and
   nothing of it is said to the owner.

   The two models judge the rest. Llama Guard looks for harm, so a crude
   word on its own can pass it, and the picker can read one as a question
   that isn't about the owner; this list makes the plainest cases certain.

   It is short on purpose, and holds only words with no innocent use in a
   question about someone's work. English words are matched whole, so
   "Dickens", "peacock" and "Scunthorpe" pass; "cum laude", "a naked domain"
   and "unisex" aren't on it. Japanese has no spaces between words, so its
   words are matched anywhere in the question. Each is compared after NFKC,
   so full-width letters and half-width kana count as what they are. */

const ENGLISH = new Set([
  "fuck",
  "fucks",
  "fucked",
  "fucking",
  "fucker",
  "motherfucker",
  "shit",
  "bullshit",
  "cunt",
  "cock",
  "cocks",
  "dickhead",
  "penis",
  "penises",
  "vagina",
  "pussy",
  "boob",
  "boobs",
  "tits",
  "titties",
  "porn",
  "porno",
  "nudes",
  "sexy",
  "blowjob",
  "handjob",
  "dildo",
  "whore",
  "slut",
  "bitch",
  "asshole",
  "rape",
  "nigger",
  "nigga",
  "faggot",
  "retard",
  "retarded",
]);

const JAPANESE = [
  "ちんこ",
  "チンコ",
  "ちんぽ",
  "チンポ",
  "まんこ",
  "マンコ",
  "おっぱい",
  "オッパイ",
  "きちがい",
  "キチガイ",
  "ガイジ",
];

/** A run of letters: a word, as the English list is matched. */
const WORD = /\p{L}+/gu;

/** Whether the question has a word no question needs. */
export function isCrude(question: string): boolean {
  const text = question.normalize("NFKC");
  const words = text.toLowerCase().match(WORD) ?? [];
  return words.some((word) => ENGLISH.has(word)) || JAPANESE.some((word) => text.includes(word));
}
