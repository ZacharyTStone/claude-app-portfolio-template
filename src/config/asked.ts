/* Each language's `asked`. */

import type { Markdown } from "./markdown.ts";

/** "Something else": the reply to a question the site has no answer for,
    with ways to ask you instead. In `email` and `message.text`, {question}
    is what the visitor asked: said to you where Ask can ("Do you…?"), as
    they typed it where it can't ("Does Alex…?"), and nothing at all for a
    blocked visitor. So give it a line of its own ("A question from your
    portfolio:", then {question}) rather than a place in a sentence. */
export type Asked = {
  /** The tab's name: "Something else". */
  title: string;
  /** A sample question: what the tab shows without JavaScript, and what's
      in the email and the message until a visitor asks their own. */
  q: string;
  /** The reply's paragraph, above the ways to reach you. */
  answer: Markdown;
  /** The link that opens the email: "Email it to me". */
  mail: string;
  /** The email's subject line. */
  subject: string;
  /** The email's body, with {question} where the question goes (the build
      checks it's there). */
  email: string;
  /** With links.linkedin: the link to your profile. */
  linkedin?: string;
  /** With links.linkedin: a message for the visitor to copy and send you
      there. */
  message?: {
    /** The heading over the message: "A message to copy". */
    label: string;
    /** The message, with {question} where the question goes. */
    text: string;
    /** The copy button's label and tooltip: "Copy message". */
    copy: string;
  };
};
