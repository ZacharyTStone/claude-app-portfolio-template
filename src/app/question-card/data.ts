/* The question card as the build wrote it into the page: its topics, its
   wording, and the personal answers. Each page carries its own language's. */
import type { QuestionCard } from "../../config/question-card.ts";
import { PAGE_IDS } from "../../contracts/page-ids.ts";
import { byId } from "../lib/dom.ts";

export const questionCard = JSON.parse(byId(PAGE_IDS.questionCardData).textContent) as QuestionCard;
