/* llms.txt: the site as plain text, for a model reading it on someone's
   behalf (a recruiter pasting the address into an assistant): who this is,
   how to reach them, and every answer, in the words /ask reads (answers.ts). */

import type { AskAnswer } from "../shared/ask.ts";
import type { PanelRow } from "../shared/config.ts";
import type { Site } from "./site.ts";
import { plainAnswers } from "./answers.ts";

// Each answer under its question, a paragraph for each of its blocks, the
// questions under their tab's name (a thread's answers share one; a
// personal answer has its own).
function answered(answers: AskAnswer[]): string {
  const parts: string[] = [];
  let title: string | null = null;
  for (const answer of answers) {
    if (answer.title !== title) parts.push(`### ${answer.title}`);
    title = answer.title;
    parts.push(`**${answer.q}**`, ...answer.text.split("\n"));
  }
  return parts.join("\n\n");
}

export function llms(site: Site): string {
  const { config, codes, main } = site;
  const { email, github, linkedin } = config.links;
  const { panel, meta } = site.lang(main);
  const contact = [`mailto:${email}`, github, linkedin];
  // A link as an address of its own: one to a thread or a file on the site
  // is under the site's.
  const absolute = (href: string) =>
    href.startsWith("#") ? site.url(main) + href : href.startsWith("/") ? site.address(href) : href;
  // The details panel's links (the resume, a project's site), but for the
  // contact links, which have their own section.
  const rows: PanelRow[] = [...(panel.outputs?.rows ?? []), ...(panel.context?.rows ?? [])];
  const links = rows.flatMap(({ label, meta, href }) =>
    href && !contact.includes(href) ? [`- [${label}](${absolute(href)}): ${meta}`] : [],
  );
  return `# ${meta.title}

> ${config.llms.summary}

## About

${config.llms.about}

## Pages

${codes.map((c) => `- [Portfolio (${c.toUpperCase()})](${site.url(c)})`).join("\n")}
${links.length ? `\n## Links\n\n${links.join("\n")}\n` : ""}
## Contact

- Email: ${email}${github ? `\n- GitHub: ${github}` : ""}${linkedin ? `\n- LinkedIn: ${linkedin}` : ""}

## Questions and answers

Every question the site answers, with its answer as plain text.

${answered(plainAnswers(site, main))}
`;
}
