/* The checks of one language's wording: the words a part of the site
   can't do without, and where the page fills something into them. */

import { answerBlocksIn, picturesIn } from "../../config/blocks.ts";
import { PART_STRINGS } from "../../config/strings.ts";
import { isFilledIn, type LanguageCheck } from "./reporting.ts";

/** Where the page puts the visitor's question into the email that
    "Something else" drafts. */
const QUESTION_PLACEHOLDER = "{question}";

/** Where the page puts the file's name into a thread's "Read …" line. */
const FILE_PLACEHOLDER = "{file}";

/** Without its placeholder the email would be sent without the question,
    and the file's name would run on from the last word of "Read …". */
const checkPlaceholders: LanguageCheck = ({ language, problemUnless }) => {
  problemUnless(
    language.asked.email.includes(QUESTION_PLACEHOLDER),
    `asked.email should have ${QUESTION_PLACEHOLDER} in it, where the question goes`,
  );
  problemUnless(
    language.strings.status.includes(FILE_PLACEHOLDER),
    `strings.status should have ${FILE_PLACEHOLDER} in it, where the file goes ("Read ${FILE_PLACEHOLDER}")`,
  );
};

const checkLanguageRow: LanguageCheck = ({ site, language, problemUnless }) => {
  const isOnlyLanguage = site.codes.length <= 1;
  if (isOnlyLanguage) return;
  problemUnless(
    isFilledIn(language.account.language),
    "account.language is missing: the account menu's row that opens the other language",
  );
};

/** With a LinkedIn profile, "Something else" also offers a message to send
    there. */
const checkLinkedInWording: LanguageCheck = ({ site, language, problemUnless }) => {
  if (!site.config.links.linkedin) return;
  problemUnless(isFilledIn(language.asked.linkedin), "asked.linkedin is missing (links.linkedin needs it)");
  problemUnless(isFilledIn(language.asked.message), "asked.message is missing (links.linkedin needs it)");
};

/** A part only some sites have, as the check of its wording sees it. */
type OptionalPart = {
  /** Whether this site has the part, in this language. */
  isOnTheSite: boolean;
  /** What a problem calls it: "strings.viewerOpen is missing (viewer needs it)". */
  nameInProblem: string;
};

/** The wording for a part only some sites have is optional in the config's
    type, so only this check can say that a site with the part left it out. */
const checkPartWording: LanguageCheck = ({ site, language, problemUnless }) => {
  const parts = {
    viewer: { isOnTheSite: Boolean(site.config.viewer), nameInProblem: "viewer" },
    // Only the picture's own file says whether it's one a visitor plays, so
    // any picture that moves asks for the words.
    movingPictures: {
      isOnTheSite: answerBlocksIn(language).some((block) => picturesIn(block).some((picture) => picture.still)),
      nameInProblem: "a picture with a still",
    },
  } satisfies Record<keyof typeof PART_STRINGS, OptionalPart>;
  for (const partName of Object.keys(PART_STRINGS) as Array<keyof typeof PART_STRINGS>) {
    const part = parts[partName];
    if (!part.isOnTheSite) continue;
    for (const key of PART_STRINGS[partName]) {
      problemUnless(isFilledIn(language.strings[key]), `strings.${key} is missing (${part.nameInProblem} needs it)`);
    }
  }
};

/** In the order their problems are listed. */
export const WORDING_CHECKS: LanguageCheck[] = [
  checkPlaceholders,
  checkLanguageRow,
  checkLinkedInWording,
  checkPartWording,
];
