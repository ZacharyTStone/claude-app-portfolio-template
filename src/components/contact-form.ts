/* What the contact form (ContactForm.astro) is, beyond its boxes, by who takes its messages
   (src/site/contact-form.ts): where it posts, what it says to Netlify, and its hidden fields. */
import {
  CONTACT_FIELDS,
  CONTACT_NOTE_IDS,
  CONTACT_PATH,
  NETLIFY_FORM_NAME_FIELD,
  netlifyFormName,
  type ContactReceiver,
} from "../contracts/contact.ts";
import { DATA } from "../contracts/page-attributes.ts";
import { contactFormReceiver } from "../site/contact-form.ts";
import { tabHref } from "../site/pages.ts";
import type { Site } from "../site/site.ts";

export type ContactFormParts = {
  /** The <form>'s attributes, but its class and method. */
  attributes: Record<string, string>;
  /** Its hidden fields, by name: each one's value. */
  hidden: Record<string, string>;
};

/** What Netlify finds a form by in the deployed HTML, and the field it drops a message for (the one only a bot
    fills in). It takes both out of the HTML it serves. */
const NETLIFY_FORM = { "data-netlify": "true", "netlify-honeypot": CONTACT_FIELDS.trap };

/** The form on the page in `code`. To the Worker, it posts to /contact, with the page to send the visitor back to.
    To Netlify Forms, it's a Netlify form, one for each language, which posts to its own tab's page: Netlify takes the
    message there and answers with that page, which the address opens at the note that says it went. */
export function contactFormParts(site: Site, code: string): ContactFormParts {
  // The form's own tab's page, which opens on it.
  const tabPage = tabHref(site, code, site.config.contactForm?.tab ?? "");
  // The config's checks stop a build on a host where nothing takes the messages.
  const receiver: ContactReceiver = contactFormReceiver(site.host) ?? "worker";
  if (receiver === "worker") {
    return {
      attributes: { action: site.link(CONTACT_PATH), [DATA.contactReceiver]: receiver },
      hidden: { [CONTACT_FIELDS.page]: tabPage },
    };
  }
  const name = netlifyFormName(code);
  return {
    attributes: {
      action: `${tabPage}#${CONTACT_NOTE_IDS.sent}`,
      name,
      [DATA.contactReceiver]: receiver,
      ...NETLIFY_FORM,
    },
    hidden: { [NETLIFY_FORM_NAME_FIELD]: name },
  };
}
