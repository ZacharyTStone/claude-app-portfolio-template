/* The answers the model picks from: /ask.json, an AskIndex the build
   writes from the site's config, read through ASSETS like any other file. */
import * as v from "valibot";
import { AskIndexSchema, type AskAnswer } from "../../contracts/ask.ts";
import { ASK_INDEX_PATH } from "../constants.ts";

/** What the model picks from for one question, and whose site it is. */
export type Choices = {
  /** The owner's name, as the site's main language writes it. */
  name: string;
  /** Their name as `lang` writes it (the same as `name` where it has no
      other). */
  localName: string;
  /** Who they are, in a few words ("a software engineer"). */
  role: string;
  /** The language the answers are in: the page's if the site has it, else
      the site's main one. */
  lang: string;
  /** Every language the site has, the main one first: a question may be in
      any of them (the model's instructions say which). */
  languages: string[];
  /** That language's answers. */
  answers: AskAnswer[];
};

/** The answers in the page's language (the site's main one's if it has
    none). An ask.json that can't be read, or isn't an AskIndex, throws. */
export async function readChoices(assets: Fetcher, request: Request, pageLang: string | undefined): Promise<Choices> {
  const response = await assets.fetch(new Request(new URL(ASK_INDEX_PATH, request.url)));
  if (!response.ok) throw new Error(`ask.json: ${response.status}`);
  const index = v.safeParse(AskIndexSchema, await response.json());
  if (!index.success) throw new Error("ask.json: not an AskIndex");
  const { name, names = {}, role, main, answers } = index.output;
  // Only a language the index itself lists: the page's is whatever the
  // request said, "__proto__" included.
  const lang = pageLang !== undefined && Object.hasOwn(answers, pageLang) ? pageLang : main;
  const localName = (Object.hasOwn(names, lang) ? names[lang] : undefined) ?? name;
  const languages = [main, ...Object.keys(answers).filter((code) => code !== main)];
  const answersInLang = (Object.hasOwn(answers, lang) ? answers[lang] : undefined) ?? [];
  return { name, localName, role, lang, languages, answers: answersInLang };
}
