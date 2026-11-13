/* How a link behaves, the same whether a page or the browser code makes it. */

/** A link to another site opens in a new tab, and tells that site nothing
    about this one. Any other link gets no attributes. */
export const newTabAttributes = (href: string): { target?: string; rel?: string } =>
  /^https?:/i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};

/** Whether the browser code makes a link of one in the text it shows. It
    doesn't know the site's path, so a link to a file on the site
    ("/resume.pdf") is shown as its words. */
export const browserFollows = (href: string): boolean => /^(#|https?:|mailto:)/i.test(href);

/** In the config's asked.email and asked.message.text. */
export const QUESTION_PLACEHOLDER = "{question}";

/** A "$" in the question is just a "$", not a replacement pattern. */
export const withQuestion = (template: string, question: string): string =>
  template.replaceAll(QUESTION_PLACEHOLDER, () => question);

/** emailLink("mailto:alex@example.com", "Hi", "A question") is
    "mailto:alex@example.com?subject=Hi&body=A%20question". */
export const emailLink = (mailto: string, subject: string, body: string): string =>
  `${mailto}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
