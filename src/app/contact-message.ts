/* What the contact form's message box says once "Something else" takes a
   question to it (contact-form.ts). It needs no page. */
import { MAX_MESSAGE_LENGTH } from "../contracts/contact.ts";

/** Between what the visitor had typed and the question after it. */
const BETWEEN = "\n\n";

/** The message with the question in: the question alone in an empty box,
    and after what the visitor had typed in one that isn't, which stays as
    it was. A box that has the question already, or hasn't room for it,
    is left as it is. */
export function messageWithQuestion(typed: string, question: string): string {
  if (!typed.trim()) return question;
  if (!question || typed.includes(question)) return typed;
  const withQuestion = `${typed.trimEnd()}${BETWEEN}${question}`;
  return withQuestion.length > MAX_MESSAGE_LENGTH ? typed : withQuestion;
}
