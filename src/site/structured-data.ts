/* schema.org Person data, for search engines: who the site is about. */

import { PERSON } from "./constants.ts";
import { scriptJson } from "./script-json.ts";
import type { Page } from "./site.ts";

export function structuredData({ site, code, lang }: Page): string {
  const { config, codes } = site;
  const p = config.person ?? {};
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": site.address(`/${PERSON}`),
    name: lang.person.name,
    ...(lang.person.name !== config.name ? { alternateName: config.name } : {}),
    url: site.url(code),
    ...(p.image ? { image: site.address(p.image) } : {}),
    jobTitle: lang.person.jobTitle,
    ...(p.worksFor ? { worksFor: { "@type": "Organization", name: p.worksFor } } : {}),
    ...(p.alumniOf ? { alumniOf: { "@type": "CollegeOrUniversity", name: p.alumniOf } } : {}),
    ...(p.country ? { address: { "@type": "PostalAddress", addressCountry: p.country } } : {}),
    knowsLanguage: p.knowsLanguage ?? codes,
    email: `mailto:${config.links.email}`,
    sameAs: [config.links.github, config.links.linkedin].filter(Boolean),
  };
  return scriptJson(data, 2);
}
