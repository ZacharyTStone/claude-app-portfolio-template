/* /contact with everything it's bound to stood in for, as the Ask tests have
   /ask: the emails the send_email binding was asked to send, what a
   sender's API was asked (fetch() is stood in for), what AskGuard was
   asked, and what the Worker logged. Nothing is sent anywhere. */
import { CONTACT_FIELDS, CONTACT_JSON, CONTACT_PATH } from "../../../src/contracts/contact.ts";
import { handleContact } from "../../../src/worker/contact/handler.ts";
import type { ContactLogLine } from "../../../src/worker/contact/log.ts";
import type { Env } from "../../../src/worker/env.ts";
import type { Fetch } from "../../../src/worker/lib/http.ts";
import { VISITOR_ADDRESS_HEADER } from "../../../src/worker/lib/visitor.ts";
import { guardStub, type GuardStub } from "./guard.ts";
import { ADDRESS } from "./worker.ts";

/** Where the site is, as Cloudflare serves it. */
export const SITE = "https://site.example";

/** The owner's own address: CONTACT_TO, and the binding's destination. */
export const OWNER = "owner@mail.example";

/** The form's fields by what each holds, as ContactForm.astro names them. */
export type Fields = Partial<Record<keyof typeof CONTACT_FIELDS, string>>;

/** What a visitor typed, on the site's main page, with the field only a bot
    fills in left empty: what the page sends. */
export const FILLED_IN = {
  page: "/",
  email: "jane@example.org",
  message: "Hello! Are you free for a call next week?\r\nThanks.",
  trap: "",
} as const satisfies Fields;

/** How a request is sent, where it isn't as the page sends one. A header
    given as null is left out. */
export type ContactSend = {
  method?: string;
  url?: string;
  /** For the page's script: ask for JSON back. */
  json?: boolean;
  headers?: Record<string, string | null>;
};

/** The request the page sends: the form's fields, posted from the site's
    own page, as a form posts them. */
export function contactRequest(fields: Fields = FILLED_IN, how: ContactSend = {}): Request {
  const { method = "POST", url = `${SITE}${CONTACT_PATH}`, json = false } = how;
  const body = new URLSearchParams(
    Object.entries(fields).map(([field, value]) => [CONTACT_FIELDS[field as keyof Fields], value]),
  );
  const headers: Record<string, string | null> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Origin: new URL(url).origin,
    "Sec-Fetch-Site": "same-origin",
    [VISITOR_ADDRESS_HEADER]: ADDRESS,
    ...(json ? { Accept: CONTACT_JSON } : {}),
    ...how.headers,
  };
  const sent = Object.entries(headers).filter((header): header is [string, string] => header[1] !== null);
  return new Request(url, { method, headers: sent, body: method === "POST" ? body.toString() : undefined });
}

/** The site's key for a sender's API: a secret, as the Worker is given it. */
export const API_KEY = "re_s3cr3t-key-of-the-site";

/** What a sender's API answers: a status and the JSON it says, or what
    fetch() throws in place of an answer. */
export type ApiAnswer = { status: number; json?: unknown } | { throws: unknown };

/** What a sender's API says to an email it takes. */
const TAKEN: ApiAnswer = { status: 200, json: { id: "4ef9a417-02e9-4d39-ad75-9611e0fcc33c" } };

export type ContactOptions = {
  guard?: GuardStub;
  /** What the binding throws, for a send that fails. */
  sendThrows?: unknown;
  /** What a sender's API answers each time it's asked (it takes the email,
      unless this says otherwise). */
  api?: ApiAnswer;
  /** The settings (CONTACT_TO is OWNER unless it's given). */
  vars?: Partial<Record<keyof Env, string>>;
  /** Bindings and secrets to leave out. */
  without?: readonly ("ASK_GUARD" | "CONTACT_EMAIL" | "CONTACT_API_KEY")[];
};

/** A sender's API, stood in for: it answers `answer` to every request, and
    keeps what it was asked. */
function apiAnswering(answer: ApiAnswer) {
  const asked: Array<{ address: string; init: RequestInit }> = [];
  const fetch: Fetch = async (address, init) => {
    asked.push({ address, init });
    if ("throws" in answer) throw answer.throws;
    return Response.json(answer.json ?? null, { status: answer.status });
  };
  return { fetch, asked };
}

/** The Worker's bindings for /contact, stood in for; the emails sent, what
    a sender's API was asked, and the lines logged; and `post`, which sends
    it a request. */
export function contactStubs(options: ContactOptions = {}) {
  const { guard = guardStub(), sendThrows, api = TAKEN, vars = {}, without = [] } = options;
  const sent: EmailMessageBuilder[] = [];
  const { fetch, asked } = apiAnswering(api);
  const logged: ContactLogLine[] = [];
  const bindings: Record<string, unknown> = {
    CONTACT_TO: OWNER,
    CONTACT_API_KEY: API_KEY,
    ...vars,
    ASK_GUARD: guard,
    CONTACT_EMAIL: {
      send: async (message: EmailMessageBuilder) => {
        if (sendThrows !== undefined) throw sendThrows;
        sent.push(message);
        return { messageId: "<1@site.example>" };
      },
    },
  };
  for (const name of without) delete bindings[name];
  // Only what the Worker uses is stood in for, so this is cast to the real
  // bindings.
  const env = bindings as unknown as Env;
  const send = (request: Request) => handleContact(request, env, (line) => void logged.push(line), fetch);
  const post = (fields?: Fields, how?: ContactSend) => send(contactRequest(fields, how));
  return { env, guard, sent, asked, logged, send, post };
}
