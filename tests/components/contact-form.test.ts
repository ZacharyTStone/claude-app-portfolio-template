/* What the contact form is, beyond its boxes (src/components/contact-form.ts):
   on Cloudflare, a form the Worker takes at /contact; on Netlify, a Netlify
   form for each language, which Netlify takes at its own tab's page. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { contactFormParts } from "../../src/components/contact-form.ts";
import {
  CONTACT_FIELDS,
  CONTACT_NOTE_IDS,
  CONTACT_PATH,
  NETLIFY_FORM_NAME_FIELD,
  netlifyFormName,
} from "../../src/contracts/contact.ts";
import { DATA } from "../../src/contracts/page-attributes.ts";
import { tabHref } from "../../src/site/pages.ts";
import { makeSite, type Site } from "../../src/site/site.ts";
import { sampleConfig } from "../site/sample.ts";

const cloudflare = makeSite(sampleConfig({ host: "cloudflare" }));
const netlify = makeSite(sampleConfig({ host: "netlify", ask: undefined }));
const TAB = sampleConfig().contactForm?.tab ?? "";

/** The form's own tab's page in `code`, as the pages link to it ("/portfolio/fr/about/"). */
const tabPageOf = (site: Site, code: string): string => tabHref(site, code, TAB);

test("on Cloudflare, the form posts to /contact, under the site's path, with its own tab's page to come back to", () => {
  for (const code of cloudflare.codes) {
    assert.deepEqual(contactFormParts(cloudflare, code), {
      attributes: { action: cloudflare.link(CONTACT_PATH), [DATA.contactReceiver]: "worker" },
      hidden: { [CONTACT_FIELDS.page]: tabPageOf(cloudflare, code) },
    });
  }
});

test("on Netlify, each language's form is a Netlify form of its own name, posted to its tab's page, at the note that says it went", () => {
  assert.ok(netlify.codes.length > 1, "the sample has two languages");
  for (const code of netlify.codes) {
    const name = netlifyFormName(code);
    assert.deepEqual(contactFormParts(netlify, code), {
      attributes: {
        action: `${tabPageOf(netlify, code)}#${CONTACT_NOTE_IDS.sent}`,
        name,
        [DATA.contactReceiver]: "netlify",
        "data-netlify": "true",
        "netlify-honeypot": CONTACT_FIELDS.trap,
      },
      hidden: { [NETLIFY_FORM_NAME_FIELD]: name },
    });
  }
});

test("on Netlify, the form has no page to come back to, which only the Worker reads", () => {
  for (const code of netlify.codes) {
    assert.ok(!(CONTACT_FIELDS.page in contactFormParts(netlify, code).hidden), code);
  }
});
