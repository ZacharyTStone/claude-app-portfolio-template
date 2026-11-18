/* Who takes the contact form's messages, by who serves the site: its Worker
   (src/worker/contact) on Cloudflare, which emails them to the site's owner,
   or Netlify Forms on Netlify, which keeps them and sends the owner a
   notification. On any other host nothing would take them, and the config's
   checks say so. */
import type { Host } from "../config/site-config.ts";
import type { ContactReceiver } from "../contracts/contact.ts";

const RECEIVERS: Partial<Record<Host, ContactReceiver>> = { cloudflare: "worker", netlify: "netlify" };

/** The hosts the form works on, in the order a problem names them. */
export const CONTACT_FORM_HOSTS = Object.keys(RECEIVERS) as Host[];

/** Who takes the form's messages on `host`; undefined where nothing would. */
export const contactFormReceiver = (host: Host): ContactReceiver | undefined => RECEIVERS[host];
