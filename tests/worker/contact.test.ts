/* The contact form's Worker (src/worker/contact): a message posted from the
   site's page is emailed to its owner, from the site's own domain, with
   Reply going to the visitor; and what isn't the site's form, isn't a
   message to send, or is past the day's limits is sent nothing. The email
   binding and AskGuard are stood in for. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTACT_NOTE_IDS, MAX_CONTACT_BYTES, MAX_MESSAGE_LENGTH } from "../../src/contracts/contact.ts";
import { HTTP_STATUS } from "../../src/worker/lib/http.ts";
import { VISITOR_ADDRESS_HEADER } from "../../src/worker/lib/visitor.ts";
import { SETTINGS } from "../../src/worker/settings.ts";
import { FILLED_IN, OWNER, SITE, contactRequest, contactStubs, type Fields } from "./support/contact.ts";
import { firstAsked, guardStub, realGuard } from "./support/guard.ts";
import { ADDRESS, hashToday } from "./support/worker.ts";

/** Where a visitor without JavaScript is sent back to: the page, at a note. */
const backAt = (note: keyof typeof CONTACT_NOTE_IDS, page = "/") => `${SITE}${page}#${CONTACT_NOTE_IDS[note]}`;

/** The status a response has, and where it sends the visitor. */
const redirectOf = (response: Response) => ({ status: response.status, to: response.headers.get("Location") });

test("a message from the page is emailed to the owner, from the site's domain, with Reply going to the visitor", async () => {
  const { post, sent } = contactStubs();
  await post();
  assert.deepEqual(sent, [
    {
      to: OWNER,
      from: "portfolio@site.example",
      replyTo: FILLED_IN.email,
      subject: `Contact form: a message from ${FILLED_IN.email}`,
      text: `Hello! Are you free for a call next week?\nThanks.\n\n(Sent with the contact form on site.example. Reply, and it goes to ${FILLED_IN.email}.)\n`,
    },
  ]);
});

test("the email goes to CONTACT_TO alone: no one is copied, whatever the visitor typed", async () => {
  const { post, sent } = contactStubs({ vars: { CONTACT_TO: "me@example.net" } });
  await post({ ...FILLED_IN, message: "Cc: someone@example.org\nBcc: someone@example.org" });
  assert.deepEqual(
    sent.map(({ to, cc, bcc }) => ({ to, cc, bcc })),
    [{ to: "me@example.net", cc: undefined, bcc: undefined }],
  );
});

test("without JavaScript the visitor is sent back to the page, at the note that says it went", async () => {
  const { post } = contactStubs();
  assert.deepEqual(redirectOf(await post()), { status: HTTP_STATUS.seeOther, to: backAt("sent") });
});

test("the page's script, which asks for JSON, is told in JSON", async () => {
  const { post } = contactStubs();
  const response = await post(FILLED_IN, { json: true });
  assert.deepEqual([response.status, await response.json()], [HTTP_STATUS.ok, { sent: true }]);
});

test("the visitor goes back to the page the form was on, under the site's path and in its language", async () => {
  const { post } = contactStubs();
  const response = await post({ ...FILLED_IN, page: "/portfolio/fr/" });
  assert.equal(response.headers.get("Location"), backAt("sent", "/portfolio/fr/"));
});

for (const page of ["//elsewhere.example/", "https://elsewhere.example/", "/\\elsewhere.example", "fr/", "/?x=1", ""]) {
  test(`a page of "${page}" sends the visitor to the site's root, never another site`, async () => {
    const { post } = contactStubs();
    assert.equal((await post({ ...FILLED_IN, page })).headers.get("Location"), backAt("sent"));
  });
}

test("CONTACT_FROM is who the email is from, where it's set", async () => {
  const { post, sent } = contactStubs({ vars: { CONTACT_FROM: "hello@mail.site.example" } });
  await post();
  assert.equal(sent[0]?.from, "hello@mail.site.example");
});

test("a site at www. sends from its domain", async () => {
  const { post, sent } = contactStubs();
  await post(FILLED_IN, { url: "https://www.site.example/contact" });
  assert.equal(sent[0]?.from, "portfolio@site.example");
});

test("the field only a bot fills in, filled in: nothing is sent or counted, and the bot is told it went", async () => {
  const { post, sent, guard, logged } = contactStubs();
  const response = await post({ ...FILLED_IN, trap: "https://spam.example" });
  assert.deepEqual(redirectOf(response), { status: HTTP_STATUS.seeOther, to: backAt("sent") });
  assert.deepEqual([sent.length, guard.requests.length, logged], [0, 0, [{ contact: "trapped" }]]);
});

const FROM_ANOTHER_SITE: Array<[how: string, headers: Record<string, string | null>]> = [
  ["another site's page", { Origin: "https://elsewhere.example", "Sec-Fetch-Site": "cross-site" }],
  [
    "another site's page, in a browser that sends no Sec-Fetch-Site",
    { Origin: "https://elsewhere.example", "Sec-Fetch-Site": null },
  ],
  ["a page on a subdomain of the site", { Origin: "https://blog.site.example", "Sec-Fetch-Site": "same-site" }],
  ["a page that says it's this site's, in a browser that says it isn't", { "Sec-Fetch-Site": "cross-site" }],
  ["a sandboxed frame", { Origin: "null" }],
  ["no browser at all", { Origin: null, "Sec-Fetch-Site": null }],
];

for (const [how, headers] of FROM_ANOTHER_SITE) {
  test(`a form posted from ${how} is turned away before anything is read, counted or logged`, async () => {
    const { post, sent, guard, logged } = contactStubs();
    const response = await post(FILLED_IN, { headers });
    assert.equal(response.status, HTTP_STATUS.forbidden);
    assert.deepEqual([sent.length, guard.requests.length, logged.length], [0, 0, 0]);
  });
}

test("only a POST is read, and a GET is told so", async () => {
  const { post, sent } = contactStubs();
  const response = await post(FILLED_IN, { method: "GET" });
  assert.deepEqual(
    [response.status, response.headers.get("Allow"), sent.length],
    [HTTP_STATUS.methodNotAllowed, "POST", 0],
  );
});

test("only a form is read: JSON, which the page never sends here, is turned away", async () => {
  const { post } = contactStubs();
  const response = await post(FILLED_IN, { headers: { "Content-Type": "application/json" } });
  assert.equal(response.status, HTTP_STATUS.unsupportedMediaType);
});

test("a body longer than a form's can be is turned away, whatever its Content-Length says", async () => {
  const { post, send, sent } = contactStubs();
  const huge = { ...FILLED_IN, message: "x".repeat(MAX_CONTACT_BYTES) };
  assert.equal((await post(huge)).status, HTTP_STATUS.payloadTooLarge);
  const saysMore = contactRequest(FILLED_IN, { headers: { "Content-Length": String(MAX_CONTACT_BYTES + 1) } });
  assert.equal((await send(saysMore)).status, HTTP_STATUS.payloadTooLarge);
  assert.equal(sent.length, 0);
});

const NOT_AN_ADDRESS = [
  "",
  "jane",
  "jane@",
  "@example.org",
  "jane@example",
  "jane doe@example.org",
  "jane@exa mple.org",
  "<jane@example.org>",
  "jane@example.org, bob@example.org",
  "jane@example.org\r\nBcc: bob@example.org",
  "jane@example.org‮",
  `${"j".repeat(65)}@example.org`,
  `jane@${"a".repeat(250)}.org`,
];

for (const email of NOT_AN_ADDRESS) {
  test(`an address of ${JSON.stringify(email)} isn't one to reply to: nothing is sent or counted`, async () => {
    const { post, sent, guard, logged } = contactStubs();
    const response = await post({ ...FILLED_IN, email });
    assert.deepEqual(redirectOf(response), { status: HTTP_STATUS.seeOther, to: backAt("failed") });
    assert.deepEqual([sent.length, guard.requests.length, logged], [0, 0, [{ contact: "invalid", why: "email" }]]);
  });
}

for (const email of [
  "jane.doe+portfolio@example.co.uk",
  "  jane@example.org  ",
  "ジェーン@例え.jp",
  "jane@xn--r8jz45g.jp",
]) {
  test(`an address of ${JSON.stringify(email)} is one`, async () => {
    const { post, sent } = contactStubs();
    await post({ ...FILLED_IN, email });
    assert.equal(sent[0]?.replyTo, email.trim());
  });
}

for (const [what, message] of [
  ["nothing", ""],
  ["only spaces", " \r\n "],
  ["more than the page lets a visitor type", "x".repeat(MAX_MESSAGE_LENGTH + 1)],
  ["a control character", "Ring the bell\u0007"],
]) {
  test(`a message of ${what} isn't sent, and the page's script is told so`, async () => {
    const { post, sent, logged } = contactStubs();
    const response = await post({ ...FILLED_IN, message }, { json: true });
    assert.deepEqual([response.status, await response.json()], [HTTP_STATUS.badRequest, { sent: false }]);
    assert.deepEqual([sent.length, logged], [0, [{ contact: "invalid", why: "message" }]]);
  });
}

test("a message as long as the page lets a visitor type, emoji and tabs and all, is sent", async () => {
  const { post, sent } = contactStubs();
  const message = `👩‍💻\t${"x".repeat(MAX_MESSAGE_LENGTH - 6)}`;
  await post({ ...FILLED_IN, message });
  assert.ok(sent[0]?.text?.startsWith(message));
});

test("the guard is asked for the visitor by the hash of their address, with the day's limits as set", async () => {
  const guard = guardStub();
  const { post } = contactStubs({ guard, vars: { CONTACT_DAILY_LIMIT: "9", CONTACT_VISITOR_LIMIT: "2" } });
  await post();
  assert.deepEqual(firstAsked(guard, "message"), {
    ask: "message",
    visitorHash: hashToday(SETTINGS.salt.default, ADDRESS),
    limits: { siteLimit: 9, visitorLimit: 2 },
  });
});

/** What came of each of `addresses` sending a message, in turn, to one
    Worker over the real AskGuard. */
async function sendsFrom(world: ReturnType<typeof contactStubs>, addresses: string[]): Promise<boolean[]> {
  const went: boolean[] = [];
  for (const address of addresses) {
    const response = await world.post(FILLED_IN, { json: true, headers: { [VISITOR_ADDRESS_HEADER]: address } });
    went.push(((await response.json()) as { sent: boolean }).sent);
  }
  return went;
}

test("a visitor sends as many as CONTACT_VISITOR_LIMIT a day, and others send on until the site's day is used up", async () => {
  const world = contactStubs({ guard: realGuard(), vars: { CONTACT_DAILY_LIMIT: "4", CONTACT_VISITOR_LIMIT: "2" } });
  const one = "203.0.113.1";
  const two = "198.51.100.2";
  const three = "192.0.2.3";
  assert.deepEqual(await sendsFrom(world, [one, one, one, two, two, three]), [true, true, false, true, true, false]);
  assert.equal(world.sent.length, 4);
  assert.deepEqual(
    world.logged.map((line) => line.why ?? line.contact),
    ["sent", "sent", "limited", "sent", "sent", "spent"],
  );
});

test("by default a visitor sends 3 a day, and the site 20", async () => {
  assert.deepEqual([SETTINGS.contactVisitorLimit.default, SETTINGS.contactDailyLimit.default], [3, 20]);
  const world = contactStubs({ guard: realGuard() });
  assert.deepEqual(await sendsFrom(world, [ADDRESS, ADDRESS, ADDRESS, ADDRESS]), [true, true, true, false]);
});

test("at a limit, the page's script is told it's too many, and a visitor without JavaScript that it failed", async () => {
  const world = contactStubs({ guard: realGuard(), vars: { CONTACT_VISITOR_LIMIT: "1" } });
  await world.post();
  const json = await world.post(FILLED_IN, { json: true });
  assert.deepEqual([json.status, await json.json()], [HTTP_STATUS.tooManyRequests, { sent: false }]);
  assert.deepEqual(redirectOf(await world.post()), { status: HTTP_STATUS.seeOther, to: backAt("failed") });
});

for (const [what, options] of [
  ["without AskGuard", { without: ["ASK_GUARD"] }],
  ["with AskGuard down", { guard: guardStub("down") }],
  ["with AskGuard failing", { guard: guardStub(undefined, 500) }],
  ["without the email binding", { without: ["CONTACT_EMAIL"] }],
  ["without CONTACT_TO", { vars: { CONTACT_TO: "" } }],
] as const) {
  test(`${what}, nothing is sent, and the visitor is told it failed`, async () => {
    const { post, sent, logged } = contactStubs(options);
    const response = await post(FILLED_IN, { json: true });
    assert.deepEqual([response.status, await response.json()], [HTTP_STATUS.serviceUnavailable, { sent: false }]);
    assert.deepEqual([sent.length, logged], [0, [{ contact: "refused", why: "down" }]]);
  });
}

/** An error as the email binding throws it: with a code, and a message
    that names an address. */
const bindingError = (code: string) =>
  Object.assign(new Error(`${code}: could not send from portfolio@site.example`), { code });

for (const [what, thrown, logsAs] of [
  ["a code", bindingError("E_SENDER_NOT_VERIFIED"), "E_SENDER_NOT_VERIFIED"],
  ["another code", bindingError("E_RECIPIENT_NOT_ALLOWED"), "E_RECIPIENT_NOT_ALLOWED"],
  ["something else as its code", bindingError(`not a code ${FILLED_IN.email}`), "unknown"],
  ["a kind of error", new TypeError(`bad address ${FILLED_IN.email}`), "TypeError"],
  ["no error at all", `${FILLED_IN.email} said no`, "unknown"],
] as const) {
  test(`a send that fails with ${what} says it failed, and the log has ${logsAs}, never the error's message`, async () => {
    const { post, logged } = contactStubs({ sendThrows: thrown });
    assert.deepEqual(redirectOf(await post()), { status: HTTP_STATUS.seeOther, to: backAt("failed") });
    assert.deepEqual(logged, [{ contact: "error", error: logsAs }]);
  });
}

test("nothing a visitor sent, nor their address or its hash, is ever logged, whatever came of it", async () => {
  const email = "private.person@example.org";
  const message = "My phone number is 555 0100 and I live at 1 Hidden Lane.";
  const theirs: Fields = { ...FILLED_IN, email, message };
  const lines: unknown[] = [];
  const worlds = [
    contactStubs(),
    contactStubs({ guard: realGuard(), vars: { CONTACT_VISITOR_LIMIT: "1" } }),
    contactStubs({ sendThrows: bindingError("E_VALIDATION_ERROR") }),
    contactStubs({ without: ["CONTACT_EMAIL"] }),
  ];
  for (const world of worlds) {
    await world.post(theirs);
    await world.post(theirs, { json: true });
    await world.post({ ...theirs, trap: message });
    await world.post({ ...theirs, email: `${email} ${message}` });
    await world.post({ ...theirs, message: `${message}\u0007` });
    lines.push(...world.logged);
  }
  const everythingLogged = JSON.stringify(lines);
  const said = [email, ...message.split(" "), ADDRESS, hashToday(SETTINGS.salt.default, ADDRESS)];
  assert.deepEqual(
    said.filter((word) => word.length > 2 && everythingLogged.includes(word)),
    [],
  );
  assert.ok(lines.length >= 20, "every outcome was logged");
});
