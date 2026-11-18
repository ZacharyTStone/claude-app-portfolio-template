/* The contact form's senders with an API (src/worker/contact/providers.ts,
   outbox.ts): with CONTACT_SENDER "resend" or "postmark", a message is the
   same email the binding would send, asked of that API with the site's key,
   to CONTACT_TO alone; and what the API says no with is logged by its status
   and code, never by its message, the key or anything the visitor sent.
   fetch() is stood in for: nothing reaches Resend or Postmark. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTACT_NOTE_IDS } from "../../src/contracts/contact.ts";
import { HTTP_STATUS } from "../../src/worker/lib/http.ts";
import { SETTINGS, type ContactSender } from "../../src/worker/settings.ts";
import { API_KEY, FILLED_IN, OWNER, SITE, contactStubs, type ApiAnswer, type Fields } from "./support/contact.ts";
import { firstAsked, realGuard } from "./support/guard.ts";
import { ADDRESS, hashToday } from "./support/worker.ts";

/** The email for FILLED_IN, as the binding is asked to send it. */
const EMAIL = {
  from: "portfolio@site.example",
  to: OWNER,
  replyTo: FILLED_IN.email,
  subject: `Contact form: a message from ${FILLED_IN.email}`,
  text: `Hello! Are you free for a call next week?\nThanks.\n\n(Sent with the contact form on site.example. Reply, and it goes to ${FILLED_IN.email}.)\n`,
};

/** Each API sender: where its API is, the header it reads the key from, and
    the email as it takes it, by its own docs. */
const API_SENDERS = [
  {
    sender: "resend",
    address: "https://api.resend.com/emails",
    keyHeader: ["authorization", `Bearer ${API_KEY}`],
    body: { from: EMAIL.from, to: EMAIL.to, reply_to: EMAIL.replyTo, subject: EMAIL.subject, text: EMAIL.text },
  },
  {
    sender: "postmark",
    address: "https://api.postmarkapp.com/email",
    keyHeader: ["x-postmark-server-token", API_KEY],
    body: {
      From: EMAIL.from,
      To: EMAIL.to,
      ReplyTo: EMAIL.replyTo,
      Subject: EMAIL.subject,
      TextBody: EMAIL.text,
      MessageStream: "outbound",
    },
  },
] as const satisfies Array<{ sender: ContactSender; [more: string]: unknown }>;

/** A world whose CONTACT_SENDER is `sender`. */
const sendingWith = (sender: ContactSender, options: Parameters<typeof contactStubs>[0] = {}) =>
  contactStubs({ ...options, vars: { CONTACT_SENDER: sender, ...options.vars } });

/** Where a visitor without JavaScript is sent back to: the main page, at a note. */
const backAt = (note: keyof typeof CONTACT_NOTE_IDS) => `${SITE}/#${CONTACT_NOTE_IDS[note]}`;

for (const { sender, address, keyHeader, body } of API_SENDERS) {
  test(`with ${sender} as the sender, a message is POSTed to its API as JSON, with the key, to the owner alone, within a time limit`, async () => {
    const { post, asked, sent } = sendingWith(sender);
    await post();
    assert.deepEqual(
      asked.map(({ address: to, init }) => [to, init.method, init.signal instanceof AbortSignal]),
      [[address, "POST", true]],
    );
    const headers = new Headers(asked[0]?.init.headers);
    assert.deepEqual(
      [headers.get(keyHeader[0]), headers.get("content-type"), Boolean(headers.get("user-agent"))],
      [keyHeader[1], "application/json", true],
    );
    assert.deepEqual(JSON.parse(String(asked[0]?.init.body)), body);
    assert.equal(sent.length, 0, "the send_email binding isn't asked");
  });

  test(`with ${sender} as the sender, the visitor is told it went, and the log says so`, async () => {
    const { post, logged } = sendingWith(sender);
    const response = await post(FILLED_IN, { json: true });
    assert.deepEqual(
      [response.status, await response.json(), logged],
      [HTTP_STATUS.ok, { sent: true }, [{ contact: "sent" }]],
    );
  });

  test(`with ${sender} as the sender and no CONTACT_API_KEY, nothing is sent or counted, and the visitor is told it failed`, async () => {
    const { post, asked, guard, logged } = sendingWith(sender, { without: ["CONTACT_API_KEY"] });
    const response = await post(FILLED_IN, { json: true });
    assert.deepEqual([response.status, await response.json()], [HTTP_STATUS.serviceUnavailable, { sent: false }]);
    assert.deepEqual([asked.length, guard.requests.length, logged], [0, 0, [{ contact: "refused", why: "down" }]]);
  });

  test(`with ${sender} as the sender, the email goes to CONTACT_TO alone, whatever the visitor typed`, async () => {
    const { post, asked } = sendingWith(sender, { vars: { CONTACT_TO: "me@example.net" } });
    await post({ ...FILLED_IN, message: "Cc: someone@example.org\nBcc: someone@example.org" });
    const sentTo = JSON.parse(String(asked[0]?.init.body)) as Record<string, unknown>;
    assert.deepEqual(
      Object.entries(sentTo).filter(([field]) => /^(to|cc|bcc)$/i.test(field)),
      [[sender === "resend" ? "to" : "To", "me@example.net"]],
    );
  });

  test(`with ${sender} as the sender, CONTACT_FROM is who the email is from, where it's set`, async () => {
    const { post, asked } = sendingWith(sender, { vars: { CONTACT_FROM: "hello@mail.site.example" } });
    await post();
    const { from, From } = JSON.parse(String(asked[0]?.init.body)) as Record<string, unknown>;
    assert.equal(from ?? From, "hello@mail.site.example");
  });

  test(`with ${sender} as the sender, a visitor's message past the day's limit isn't sent`, async () => {
    const { post, asked, logged } = sendingWith(sender, { guard: realGuard(), vars: { CONTACT_VISITOR_LIMIT: "1" } });
    await post();
    await post();
    assert.equal(asked.length, 1);
    assert.deepEqual(logged, [{ contact: "sent" }, { contact: "refused", why: "limited" }]);
  });

  test(`with ${sender} as the sender, the guard counts the visitor by the hash of their address, as with the binding`, async () => {
    const { post, guard } = sendingWith(sender);
    await post();
    assert.equal(firstAsked(guard, "message")?.visitorHash, hashToday(SETTINGS.salt.default, ADDRESS));
  });
}

/** Resend's answers, by its docs: a domain that isn't verified, and a day
    past the account's quota. */
const RESEND_UNVERIFIED: ApiAnswer = {
  status: 403,
  json: {
    statusCode: 403,
    message: "The site.example domain is not verified. Please, add and verify your domain.",
    name: "validation_error",
  },
};
const RESEND_QUOTA: ApiAnswer = {
  status: 429,
  json: { statusCode: 429, message: "You have reached your daily email sending quota.", name: "daily_quota_exceeded" },
};

/** Postmark's, by its docs: a recipient marked inactive, and an account
    still waiting for approval, each with its ErrorCode. */
const POSTMARK_INACTIVE: ApiAnswer = {
  status: 422,
  json: { ErrorCode: 406, Message: `You tried to send to recipient(s) that have been marked as inactive: ${OWNER}` },
};
const POSTMARK_UNAPPROVED: ApiAnswer = {
  status: 422,
  json: {
    ErrorCode: 412,
    Message: `While your account is pending approval, all recipient addresses must share the same domain as the 'From' address: ${OWNER}`,
  },
};

const REFUSALS: Array<[sender: ContactSender, what: string, answer: ApiAnswer, logsAs: object]> = [
  ["resend", "an unverified domain", RESEND_UNVERIFIED, { error: "validation_error", status: 403 }],
  ["resend", "a day past its quota", RESEND_QUOTA, { error: "daily_quota_exceeded", status: 429 }],
  ["postmark", "an inactive recipient", POSTMARK_INACTIVE, { error: "406", status: 422 }],
  ["postmark", "an account still waiting for approval", POSTMARK_UNAPPROVED, { error: "412", status: 422 }],
  ["resend", "an answer that isn't JSON", { status: 502 }, { error: "unknown", status: 502 }],
  [
    "resend",
    "a code that's a sentence",
    { status: 400, json: { name: `bad ${FILLED_IN.email}` } },
    { error: "unknown", status: 400 },
  ],
  [
    "postmark",
    "a code that isn't one",
    { status: 422, json: { ErrorCode: { of: OWNER } } },
    { error: "unknown", status: 422 },
  ],
];

for (const [sender, what, answer, logsAs] of REFUSALS) {
  test(`${sender} saying no for ${what}: the visitor is told it failed, and the log has its status and code, never its message`, async () => {
    const { post, logged } = sendingWith(sender, { api: answer });
    assert.equal((await post()).headers.get("Location"), backAt("failed"));
    assert.deepEqual(logged, [{ contact: "error", ...logsAs }]);
  });
}

for (const [what, thrown, kind] of [
  ["no connection", new TypeError("fetch failed: api.resend.com"), "TypeError"],
  ["no answer in time", new DOMException("The operation timed out.", "TimeoutError"), "TimeoutError"],
] as const) {
  test(`a sender's API with ${what}: the visitor is told it failed, and the log has the error's kind`, async () => {
    const { post, logged } = sendingWith("postmark", { api: { throws: thrown } });
    const response = await post(FILLED_IN, { json: true });
    assert.deepEqual([response.status, await response.json()], [HTTP_STATUS.serviceUnavailable, { sent: false }]);
    assert.deepEqual(logged, [{ contact: "error", error: kind }]);
  });
}

test("the key, the visitor's address and what they sent are never logged or told to the visitor, whatever the API says", async () => {
  const email = "private.person@example.org";
  const message = "My phone number is 555 0100 and I live at 1 Hidden Lane.";
  const theirs: Fields = { ...FILLED_IN, email, message };
  const echoing: ApiAnswer = { status: 422, json: { ErrorCode: 300, Message: `${API_KEY} ${email} ${message}` } };
  const worlds = [
    sendingWith("resend"),
    sendingWith("postmark", { api: echoing }),
    sendingWith("resend", { api: { status: 403, json: { name: "validation_error", message: `${email} ${API_KEY}` } } }),
    sendingWith("resend", { api: { throws: new TypeError(`${API_KEY} ${email}`) } }),
  ];
  const said: string[] = [];
  for (const world of worlds) {
    for (const how of [{}, { json: true }]) {
      const response = await world.post(theirs, how);
      said.push(response.headers.get("Location") ?? "", await response.text());
    }
    said.push(...world.logged.map((line) => JSON.stringify(line)));
  }
  const everything = said.join("\n");
  const secret = [API_KEY, email, ...message.split(" "), ADDRESS];
  assert.deepEqual(
    secret.filter((word) => word.length > 2 && everything.includes(word)),
    [],
  );
});

test("the key goes to the sender's API alone, in its header, and never in the email", async () => {
  for (const { sender } of API_SENDERS) {
    const { post, asked } = sendingWith(sender);
    await post();
    assert.deepEqual(
      asked.map(({ address }) => new URL(address).hostname),
      [sender === "resend" ? "api.resend.com" : "api.postmarkapp.com"],
    );
    assert.ok(!String(asked[0]?.init.body).includes(API_KEY), sender);
  }
});

test("with Cloudflare as the sender, the default, the binding sends it and no API is asked", async () => {
  for (const vars of [{}, { CONTACT_SENDER: "cloudflare" }, { CONTACT_SENDER: "sendgrid" }]) {
    const { post, sent, asked } = contactStubs({ vars });
    await post();
    assert.deepEqual([sent, asked.length], [[EMAIL], 0], JSON.stringify(vars));
  }
});
