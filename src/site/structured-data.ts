/* schema.org Person data, for search engines: who the site is about. */

import { JSON_INDENT, scriptJson } from "./json.ts";
import type { Page, Site } from "./site.ts";

/** The schema.org Person's id, after the site's address:
    "https://example.com/#person". */
const PERSON_FRAGMENT = "#person";

/** A page's schema.org Person, as JSON for its <script
    type="application/ld+json">: the owner's name and job title in the
    page's language, and what the config's `person` and `links` say. The
    Person has one id on every page, so search engines read the languages'
    pages as being about one person. */
export function structuredData(site: Site, { code, language }: Page): string {
  const { config, codes } = site;
  const person = config.person ?? {};
  const nameInThisLanguage = language.person.name;
  // What the config leaves out is left out here too, not written empty.
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": site.fileUrl(`/${PERSON_FRAGMENT}`),
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
