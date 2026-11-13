/* llms.txt: the site as plain text, for a model reading it on someone's
   behalf (a recruiter pasting the address into an assistant): who this is,
   how to reach them, and every answer, in the words /ask reads (../plain-answers.ts). */

import type { AskAnswer } from "../../contracts/ask.ts";
import type { SiteConfig } from "../../config/site-config.ts";
import { plainAnswers } from "../plain-answers.ts";
import { panelRows } from "../panel.ts";
import type { Site } from "../site.ts";

/** Between two paragraphs or headings, as in Markdown. */
const BLANK_LINE = "\n\n";

const section = (heading: string, body: string): string => `## ${heading}${BLANK_LINE}${body}`;

/** In the main language, and the same whether Ask is on or off. */
export function llmsTxt(site: Site): string {
  const { config, main } = site;
  const links = panelLinks(site);
  const everyAnswer = questionsAndAnswers(plainAnswers(site, main));
  const parts = [
    `# ${site.language(main).meta.title}`,
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

/** "- [Portfolio (EN)](https://example.com/)", for each language. */
const pageList = (site: Site): string =>
  site.codes.map((code) => `- [Portfolio (${code.toUpperCase()})](${site.pageUrl(code)})`).join("\n");

/** The details panel's links, but for the contact links, which have their
    own section. */
function panelLinks(site: Site): string[] {
  const { email, github, linkedin } = site.config.links;
  const contactHrefs = [`mailto:${email}`, github, linkedin];
  const links: string[] = [];
  for (const { label, meta, href } of panelRows(site.language(site.main).panel)) {
    if (!href || contactHrefs.includes(href)) continue;
    links.push(`- [${label}](${fullAddress(site, href)}): ${meta}`);
  }
  return links;
}

/** A link as an address of its own, for a reader with no page to follow
    "#about" or "/resume.pdf" from. */
function fullAddress(site: Site, href: string): string {
  if (href.startsWith("#")) return site.pageUrl(site.main) + href;
  if (href.startsWith("/")) return site.fileUrl(href);
  return href;
}

function contactList({ email, github, linkedin }: SiteConfig["links"]): string {
  const lines = [`- Email: ${email}`];
  if (github) lines.push(`- GitHub: ${github}`);
  if (linkedin) lines.push(`- LinkedIn: ${linkedin}`);
  return lines.join("\n");
}

/** Each answer under its question, a paragraph for each of its lines. A
    thread's answers share a tab, so its name heads them once. */
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
