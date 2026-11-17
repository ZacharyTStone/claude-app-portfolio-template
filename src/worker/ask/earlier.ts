/* What a follow-up is asked after: the turns before it in its chat or tab,
   as the request had them, with each answer the visitor was shown read
   from the site's own answers. The models read an earlier answer in the
   site's words, never in a reply the page was sent. */
import type { AskAnswer } from "../../contracts/ask.ts";
import type { Choices } from "./answers.ts";
import type { CheckedTurn } from "./request.ts";

/** An earlier turn: what was asked, which is the visitor's words, and the
    answer they were shown for it, if the site has that answer. */
export type EarlierTurn = { question: string; answer?: AskAnswer };

/** Each turn with its answer, from `choices`: an id the site has no answer
    for (in the page's language) is read as none sent. */
export const earlierTurns = (turns: readonly CheckedTurn[], choices: Choices): EarlierTurn[] =>
  turns.map(({ question, id }) => {
    const answer = choices.answers.find((offered) => offered.id === id);
    return answer ? { question, answer } : { question };
  });

/** The earlier questions, oldest first. */
export const earlierQuestions = (earlier: readonly EarlierTurn[]): string[] => earlier.map(({ question }) => question);
