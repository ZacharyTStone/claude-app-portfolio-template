/* llms.txt: the site as plain text, for a model reading it on someone's
   behalf (a recruiter pasting the address into an assistant): who this is,
   how to reach them, and every answer, in the words /ask reads (answers.ts). */

import type { AskAnswer } from "../shared/ask.ts";
import type { SiteConfig } from "../shared/config.ts";
import { plainAnswers } from "./answers.ts";
import { panelRows } from "./panel.ts";
import type { Site } from "./site.ts";

/** What sets one paragraph or heading of llms.txt apart from the next: an
    empty line, as in Markdown. */
const BLANK_LINE = "\n\n";

/** A section of llms.txt: its heading, and what's under it. */
const section = (heading: string, body: string): string => `## ${heading}${BLANK_LINE}${body}`;

/** llms.txt, as the text of the file. It's in the main language, and the
    same whether Ask is on or off. */
export function llmsTxt(site: Site): string {
  const { config, main } = site;
  const links = panelLinks(site);
  const everyAnswer = questionsAndAnswers(plainAnswers(site, main));
  const parts = [
    `# ${site.lang(main).meta.title}`,
    `> ${config.llms.summary}`,
    section("About", config.llms.about),
    section("Pages", pageList(site)),
    // A site whose panel links nowhere has no Links section.
    ...(links.length ? [section("Links", links.join("\n"))] : []),
    section("Contact", contactList(config.links)),
    section(
      "Questions and answers",
      `Every question the site answers, with its answer as plain text.${BLANK_LINE}${everyAnswer}`,
    ),
  ];
  return `${parts.join(BLANK_LINE)}\n`;
}

/** Each language's page, a line each: "- [Portfolio (EN)](https://example.com/)". */
const pageList = (site: Site): string =>
  site.codes.map((code) => `- [Portfolio (${code.toUpperCase()})](${site.url(code)})`).join("\n");

/** The details panel's links (the resume, a project's site), a line each,
    but for the contact links, which have their own section. */
function panelLinks(site: Site): string[] {
  const { email, github, linkedin } = site.config.links;
  const contactHrefs = [`mailto:${email}`, github, linkedin];
  const links: string[] = [];
  for (const { label, meta, href } of panelRows(site.lang(site.main).panel)) {
    if (!href || contactHrefs.includes(href)) continue;
    links.push(`- [${label}](${fullAddress(site, href)}): ${meta}`);
  }
  return links;
}

/** A link as an address of its own, for a reader with no page to follow it
    from: a link to a thread ("#about") is under the main page's address, a
    file on the site ("/resume.pdf") under the site's, and any other link
    is a full address already. */
function fullAddress(site: Site, href: string): string {
  if (href.startsWith("#")) return site.url(site.main) + href;
  if (href.startsWith("/")) return site.address(href);
  return href;
}

/** How to reach the owner, a line each: the email, then the profiles the
    config has. */
function contactList({ email, github, linkedin }: SiteConfig["links"]): string {
  const lines = [`- Email: ${email}`];
  if (github) lines.push(`- GitHub: ${github}`);
  if (linkedin) lines.push(`- LinkedIn: ${linkedin}`);
  return lines.join("\n");
}

/** Every answer under its question (in bold), a paragraph for each of the
    answer's lines, and the questions under their tab's name as a heading.
    A thread's answers share a tab, so its name is written once, over the
    first; a personal answer has a tab of its own. */
function questionsAndAnswers(answers: AskAnswer[]): string {
  const paragraphs: string[] = [];
  let previousTitle: string | null = null;
  for (const answer of answers) {
    if (answer.title !== previousTitle) paragraphs.push(`### ${answer.title}`);
    previousTitle = answer.title;
    paragraphs.push(`**${answer.q}**`, ...answer.text.split("\n"));
  }
  return paragraphs.join(BLANK_LINE);
}
