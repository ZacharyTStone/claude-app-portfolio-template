/* ask.json, what /ask picks from: every answer on the site as plain text
   (../plain-answers.ts). */

import type { AskIndex } from "../../contracts/ask.ts";
import { JSON_INDENT } from "../json.ts";
import { plainAnswers } from "../plain-answers.ts";
import type { Site } from "../site.ts";

/** /ask.json, as the text of the file: whose site it is, and every answer
    in every language (AskIndex). It's written only for a site with Ask on;
    for any other the owner's role is "". */
export function askIndexJson(site: Site): string {
  const index: AskIndex = {
    name: site.config.name,
    names: Object.fromEntries(site.codes.map((code) => [code, site.language(code).person.name])),
    role: site.config.ask?.role ?? "",
    main: site.main,
    answers: Object.fromEntries(site.codes.map((code) => [code, plainAnswers(site, code)])),
  };
  return `${JSON.stringify(index, null, JSON_INDENT)}\n`;
}
