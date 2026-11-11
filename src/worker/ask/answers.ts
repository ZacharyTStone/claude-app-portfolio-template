/* The answers the model picks from: /ask.json, an AskIndex the build
   writes from the site's config, read through ASSETS like any other file. */
import type { AskAnswer, AskIndex } from "../../shared/ask.ts";
import { isArrayOf, isRecord, isString } from "../../shared/guards.ts";
import { ASK_INDEX_PATH } from "../constants.ts";

/** One language's answers, whose they are (and the owner's name as that
    language writes it), the language they're in and the site's languages
    (for the model's instructions). */
export type Choices = Pick<AskIndex, "name" | "role"> & {
  localName: string;
  lang: string;
  languages: string[];
  answers: AskAnswer[];
};

const isAnswer = (value: unknown): value is AskAnswer =>
  isRecord(value) && isString(value.id) && isString(value.title) && isString(value.q) && isString(value.text);

const isAskIndex = (value: unknown): value is AskIndex =>
  isRecord(value) &&
  isString(value.name) &&
  isString(value.role) &&
  isString(value.main) &&
  (value.names === undefined || (isRecord(value.names) && Object.values(value.names).every(isString))) &&
  isRecord(value.answers) &&
  Object.values(value.answers).every((answers) => isArrayOf(answers, isAnswer));

/** The answers in the page's language (the site's main one's if it has
    none). An ask.json that can't be read, or isn't an AskIndex, throws. */
export async function readChoices(assets: Fetcher, request: Request, lang: string | undefined): Promise<Choices> {
  const response = await assets.fetch(new Request(new URL(ASK_INDEX_PATH, request.url)));
  if (!response.ok) throw new Error(`ask.json: ${response.status}`);
  const index: unknown = await response.json();
  if (!isAskIndex(index)) throw new Error("ask.json: not an AskIndex");
  const { name, names, role, main, answers } = index;
  const has = (code: string | undefined): code is string => code !== undefined && Object.hasOwn(answers, code);
  const languages = [main, ...Object.keys(answers).filter((code) => code !== main)];
  const used = has(lang) ? lang : main;
  const localName = (names && Object.hasOwn(names, used) ? names[used] : undefined) ?? name;
  return { name, localName, role, lang: used, languages, answers: (has(used) ? answers[used] : undefined) ?? [] };
}
