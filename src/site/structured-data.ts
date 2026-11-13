/* A page's schema.org Person, for search engines: who the site is about. */

import { JSON_INDENT, scriptJson } from "./json.ts";
import type { Page, Site } from "./site.ts";

/** After the main page's address, the Person's id:
    "https://example.com/#person". It's one id on every page, so search
    engines read the languages' pages as being about one person. */
const PERSON_FRAGMENT = "#person";

/** As JSON, for the page's <script type="application/ld+json">. */
export function structuredData(site: Site, { code, language }: Page): string {
  const { config, codes } = site;
  const person = config.person ?? {};
  const nameInThisLanguage = language.person.name;
  // What the config leaves out is left out here too, not written empty.
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${site.pageUrl(site.main)}${PERSON_FRAGMENT}`,
    name: nameInThisLanguage,
    ...(nameInThisLanguage !== config.name ? { alternateName: config.name } : {}),
    url: site.pageUrl(code),
    ...(person.image ? { image: site.fileUrl(person.image) } : {}),
    jobTitle: language.person.jobTitle,
    ...(person.worksFor ? { worksFor: { "@type": "Organization", name: person.worksFor } } : {}),
    ...(person.alumniOf ? { alumniOf: { "@type": "CollegeOrUniversity", name: person.alumniOf } } : {}),
    ...(person.country ? { address: { "@type": "PostalAddress", addressCountry: person.country } } : {}),
    knowsLanguage: person.knowsLanguage ?? codes,
    email: `mailto:${config.links.email}`,
    sameAs: [config.links.github, config.links.linkedin].filter(Boolean),
  };
  return scriptJson(data, JSON_INDENT);
}
