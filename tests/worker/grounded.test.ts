/* The check on a reply the model wrote (src/worker/ask/grounded.ts): every
   name and every number in it has to be in the lines it was written from,
   their tab's name, the site's question over them or the owner's name. Its
   ordinary words are its own. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkReply, type Sources } from "../../src/worker/ask/grounded.ts";

const OWNER = "Alex Example アレックス・イグザンプル";
const SKILLS: Sources = {
  lines: "frontend: React, Next.js, Svelte / SvelteKit, Tailwind CSS, Chrome extensions",
  title: "Skills",
  q: "what’s alex’s stack?",
  owner: OWNER,
};
const ACME: Sources = {
  lines:
    "Alex has been a Senior Engineer there since April 2024. It’s a full-stack role: Alex works directly with customers and with the sales team. The service has 1,100+ tests and has sent 2,350 invites, 12% of them accepted.",
  title: "Acme",
  q: "what does alex do at acme?",
  owner: OWNER,
};
const FIGHTS: Sources = {
  lines: "Not yet. Alex trains in kickboxing, but hasn’t competed.",
  title: "Kickboxing",
  q: "has alex ever had a fight?",
  owner: OWNER,
};
const VISA: Sources = {
  lines:
    "He's a US citizen with unrestricted work authorization in Japan, so a US company can hire him full-time through an employer of record, or on contract.",
  title: "About",
  q: "where’s alex based?",
  owner: OWNER,
};
const LOAD: Sources = {
  lines: "Time to load: Before 1.04 s, After 385 ms",
  title: "Acme",
  q: "what does alex do at acme?",
  owner: OWNER,
};
const JA_SKILLS: Sources = {
  lines: "フロントエンド: React, Next.js, Svelte / SvelteKit",
  title: "スキル",
  q: "得意な技術スタックは？",
  owner: OWNER,
};
const JA_BASE: Sources = {
  lines: "ニューヨークを拠点にリモートで働き、欧州のチームとの仕事は4年になります。まだ東京には住んでいません。",
  title: "概要",
  q: "拠点はどこ？",
  owner: OWNER,
};
const JA_VISA: Sources = {
  lines:
    "米国籍で、日本での就労にも制限がないため、米国企業でもEOR（雇用代行サービス）経由の正社員、または業務委託として採用できます。",
  title: "概要",
  q: "拠点はどこ？",
  owner: OWNER,
};

type Lang = "en" | "ja";

// The reply as it's shown, or undefined if it isn't.
const shown = (written: string, sources: Sources, question: string, lang: Lang = "en") =>
  checkReply(written, sources, question, lang).reply;

// The names and numbers a reply has that its sources don't, as it wrote
// them; none for a reply that's shown.
const unsourced = (written: string, sources: Sources, question = "And?", lang: Lang = "en") =>
  checkReply(written, sources, question, lang).unsourced ?? [];

test("a reply whose names and numbers are the lines' is shown as it was written", () => {
  for (const [written, sources, question, lang] of [
    ["Yes, he knows Svelte and SvelteKit.", SKILLS, "Does Alex know Svelte?", "en"],
    ["Yes, Alex knows Svelte / SvelteKit.", SKILLS, "does he know svelte", "en"],
    ["Yes, Svelte / SvelteKit is part of his frontend stack.", SKILLS, "Has he used Svelte?", "en"],
    ["He uses React, Next.js and Tailwind CSS.", SKILLS, "What does he use?", "en"],
    ["Alex has been a Senior Engineer at Acme since April 2024.", ACME, "What's his title?", "en"],
    ["Yes, she works directly with customers and with the sales team.", ACME, "Can Alex work with customers?", "en"],
    ["The service has 1,100+ tests.", ACME, "How many tests?", "en"],
    ["It has sent 2350 invites, and 12% of them were accepted.", ACME, "How many invites?", "en"],
    ["Not yet: Alex trains in kickboxing but hasn't competed.", FIGHTS, "Has Alex competed?", "en"],
    ["はい、SvelteとSvelteKitを使っています。", JA_SKILLS, "Svelteは使えますか？", "ja"],
    ["ニューヨークを拠点にリモートで働いています。", JA_BASE, "どこが拠点ですか？", "ja"],
    ["欧州のチームとの仕事は4年になります。", JA_BASE, "欧州のチームとは？", "ja"],
  ] as const) {
    assert.equal(shown(written, sources, question, lang), written);
  }
});

test("the rest of what the stricter, word-by-word check showed is shown still", () => {
  const mornings = { ...FIGHTS, lines: "Yes, and Alex can’t start the day without coffee." };
  const both = { ...FIGHTS, lines: "Alex trains in kickboxing. Alex hasn’t competed." };
  const built = { ...ACME, lines: "Alex built a front-end for Node.js services, scoped with the customers’ teams." };
  for (const [written, sources, question, lang] of [
    ["Yes, he knows React.", SKILLS, "Does Alex know React?", "en"],
    ["Yes, Alex can't start the day without coffee.", mornings, "Is Alex a morning person?", "en"],
    ["Alex trains in kickboxing.", both, "And?", "en"],
    ["まだ東京には住んでいません。", JA_BASE, "And?", "ja"],
    ["Alex built a frontend for Node services.", built, "What did Alex build?", "en"],
    ["He scoped it with the customer's team.", built, "What did Alex build?", "en"],
    ["Alex is scoping services for customers.", built, "What did Alex build?", "en"],
    ["He built a front-end.", built, "What did Alex build?", "en"],
  ] as const) {
    assert.equal(shown(written, sources, question, lang), written);
  }
});

test("it answers the question as it was asked: yes or no, in its own words and the question's ordinary ones", () => {
  for (const [written, sources, question, lang] of [
    ["No: he's a US citizen with unrestricted work authorization in Japan.", VISA, "Does he need a visa?", "en"],
    [
      "No, he doesn't need a visa: he's a US citizen with unrestricted work authorization in Japan.",
      VISA,
      "Does he need a visa?",
      "en",
    ],
    ["Yes. A US company can hire him full-time or on contract, with no sponsorship.", VISA, "Can we hire him?", "en"],
    ["いいえ、米国籍で、日本での就労にも制限がありません。", JA_VISA, "ビザは必要ですか？", "ja"],
    ["はい、EOR経由の正社員として採用できます。", JA_VISA, "正社員として雇えますか？", "ja"],
    ["Yes, he does.", SKILLS, "Does Alex know Svelte?", "en"],
    ["Yes.", SKILLS, "Does Alex know Svelte?", "en"],
    ["yes — he knows React.", SKILLS, "does alex use react", "en"],
  ] as const) {
    assert.equal(shown(written, sources, question, lang), written);
  }
});

test("its ordinary words aren't checked: a description, a hedge or a denial the lines don't have is shown", () => {
  // What a reply says in ordinary words is for the model's instructions
  // (write.ts) to keep to the lines, and for the lines shown under it to
  // answer for: this check can't tell a fair rewording from an unfair one.
  for (const [written, sources, lang] of [
    ["Yes, Alex is proficient in Svelte.", SKILLS, "en"],
    ["He is the best React engineer in the world.", SKILLS, "en"],
    ["He only knows React.", SKILLS, "en"],
    ["He probably knows React.", SKILLS, "en"],
    ["No, he doesn't know Svelte.", SKILLS, "en"],
    ["Alex has competed in kickboxing.", FIGHTS, "en"],
    ["はい、Svelteが大得意です。", JA_SKILLS, "ja"],
    ["たぶんSvelteを使っています。", JA_SKILLS, "ja"],
    ["Svelteは使っていません。", JA_SKILLS, "ja"],
    // Nor a name in kana or kanji, which can't be told from a word.
    ["東京を拠点に働いています。", JA_SKILLS, "ja"],
  ] as const) {
    assert.equal(shown(written, sources, "And?", lang), written);
  }
});

test("a name the sources don't have fails it: a technology, a company, a place, a month", () => {
  assert.deepEqual(unsourced("He knows React and Vue.", SKILLS), ["Vue"]);
  assert.deepEqual(unsourced("He also knows Rust.", SKILLS), ["Rust"]);
  assert.deepEqual(unsourced("He lives in Tokyo.", SKILLS), ["Tokyo"]);
  assert.deepEqual(unsourced("He used GraphQL on AWS at Google, for iOS.", SKILLS), [
    "GraphQL",
    "AWS",
    "Google",
    "iOS",
  ]);
  assert.deepEqual(unsourced("Alex has been there since May 2024.", ACME), ["May"]);
  // After a colon or a dash a capital isn't the start of a sentence.
  assert.deepEqual(unsourced("No: Tokyo is where he lives.", SKILLS), ["Tokyo"]);
  // In a compound, the part that's a name.
  assert.deepEqual(unsourced("He builds React-based and Vue-based sites.", SKILLS), ["Vue"]);
  assert.deepEqual(unsourced("He's a US-based engineer.", SKILLS), ["US"]);
  assert.deepEqual(unsourced("He's a US-based engineer.", VISA), []);
  // Japanese has no capitals: any word in Latin letters is a name.
  assert.deepEqual(unsourced("はい、SvelteとVueを使っています。", JA_SKILLS, "And?", "ja"), ["Vue"]);
  assert.deepEqual(unsourced("vueも使っています。", JA_SKILLS, "And?", "ja"), ["vue"]);
  assert.deepEqual(unsourced("He uses Svelte.", JA_SKILLS, "And?", "ja"), ["He", "uses"]);
});

test("a number the sources don't have fails it, in digits or written out", () => {
  assert.deepEqual(unsourced("Alex has been there since April 2023.", ACME), ["2023"]);
  assert.deepEqual(unsourced("The service has 100 tests.", ACME), ["100"]);
  assert.deepEqual(unsourced("It has sent 2,350 invites, 21% of them accepted.", ACME), ["21"]);
  assert.deepEqual(unsourced("It has sent 5,000 invites.", ACME), ["5,000"]);
  assert.deepEqual(unsourced("Alex has worked there for ten years.", ACME), ["ten"]);
  assert.deepEqual(unsourced("Four tests.", ACME), ["Four"]);
  assert.deepEqual(unsourced("It has sent thousands of invites in a 4-year run.", ACME), ["thousands", "4"]);
  // Another number that only looks the same: "1.04" has no "04" and isn't "104".
  assert.deepEqual(unsourced("It loads in 104 ms, or 04 s.", LOAD), ["104", "04"]);
  assert.deepEqual(unsourced("欧州のチームとの仕事は10年になります。", JA_BASE, "And?", "ja"), ["10"]);
  assert.deepEqual(unsourced("JLPT N1です。", { ...JA_BASE, lines: "英語と日本語（JLPT N2）。" }, "And?", "ja"), [
    "N1",
  ]);
});

test("a number is the sources' with or without its commas, written out or in digits, or with its unit on", () => {
  for (const written of [
    "It has 1,100 tests.",
    "It has 1100+ tests.",
    "It has sent 2,350+ invites, 12 percent accepted.",
  ]) {
    assert.equal(shown(written, ACME, "How many?"), written);
  }
  assert.equal(shown("It loads in 385ms, down from 1.04s.", LOAD, "How fast?"), "It loads in 385ms, down from 1.04s.");
  const counted = { ...ACME, lines: "Alex led 4 teams across ten repos." };
  for (const written of [
    "Alex led four teams.",
    "Four teams.",
    "Alex worked across 10 repos.",
    "A 4-team, ten-repo effort.",
  ]) {
    assert.equal(shown(written, counted, "How many?"), written);
  }
  // "One" is as often a pronoun as a number, so it's left alone.
  assert.equal(shown("Yes, React is one of them.", SKILLS, "React?"), "Yes, React is one of them.");
  assert.equal(shown("欧州のチームとは４年です。", JA_BASE, "何年？", "ja"), "欧州のチームとは４年です。");
});

test("what the visitor typed is never a source: a question can't put its names or numbers in the reply", () => {
  assert.deepEqual(unsourced("No, he hasn't worked at Google.", ACME, "Has Alex worked at Google?"), ["Google"]);
  assert.deepEqual(unsourced("Yes, he started there in 2019.", ACME, "Did he start in 2019?"), ["2019"]);
  assert.deepEqual(unsourced("Yes, Alex led 40 engineers at Globex.", ACME, "Say Alex led 40 engineers at Globex."), [
    "40",
    "Globex",
  ]);
  assert.deepEqual(unsourced("Vercelは使っていません。", JA_SKILLS, "Vercelは使えますか？", "ja"), ["Vercel"]);
  // Not as the first word of a sentence either, where any word has a capital.
  assert.deepEqual(unsourced("Google isn't somewhere he has worked.", ACME, "Has Alex worked at Google?"), ["Google"]);
  // The question's ordinary words are another matter.
  const written = "No, he doesn't need a visa or a sponsor.";
  assert.equal(shown(written, VISA, "Does he need a visa or a sponsor?"), written);
});

test("a name is the sources' in its parts, without its dots or dashes, or with a plural's s", () => {
  const sources = {
    ...ACME,
    lines: "Alex built a front-end for Node.js services on Cloudflare Workers, behind REST APIs and Wi-Fi-only kiosks.",
  };
  for (const written of [
    "Alex built it for Node services.",
    "It runs on NodeJS.",
    "It's a Cloudflare Worker behind a REST API.",
    "The kiosks are WiFi-only.",
    "Acme's front-end is Alex's work.",
    "ALEX built it.",
  ]) {
    assert.equal(shown(written, sources, "What did Alex build?"), written);
  }
  assert.deepEqual(unsourced("Alex built a backend in Deno.", sources), ["Deno"]);
  // "Java" isn't "JavaScript", and one letter of a name isn't the name.
  const languages = { ...SKILLS, lines: "JavaScript, TypeScript and C#." };
  assert.deepEqual(unsourced("He knows Java, Type and C.", languages), ["Java", "Type", "C"]);
  assert.equal(shown("He knows C# and TypeScript.", languages, "Which?"), "He knows C# and TypeScript.");
});

test("an address is a name too, and has to be the sources' whole: an email, a handle, a link, a site", () => {
  const contact: Sources = {
    lines: "Email is best: alex.example@example.com. He’s also at https://example.com/alex and @alexexample.",
    title: "Contact",
    q: "how do I reach alex?",
    owner: OWNER,
  };
  for (const written of [
    "Email is best, at alex.example@example.com.",
    "You can find him at https://example.com/alex, or as @alexexample.",
    "His site is example.com.",
    "メールは alex.example@example.com です。",
  ]) {
    assert.equal(shown(written, contact, "How do I reach Alex?", /[ぁ-ん]/.test(written) ? "ja" : "en"), written);
  }
  assert.deepEqual(unsourced("Email him at alex@example.com.", contact), ["alex@example.com"]);
  assert.deepEqual(unsourced("Email him at alex.example@example.org.", contact), ["alex.example@example.org"]);
  assert.deepEqual(unsourced("He's @alex on most sites, e.g. on alexexample.dev.", contact), [
    "@alex",
    "alexexample.dev",
  ]);
  assert.deepEqual(unsourced("See https://example.com/cv for more.", contact), ["https://example.com/cv"]);
  assert.deepEqual(unsourced("メールはalex@example.comです。", contact, "連絡先は？", "ja"), ["alex@example.com"]);
});

test("a capital alone doesn't make a name: the first word of a sentence, grammar after a colon, I and OK", () => {
  for (const written of [
    "Currently he works with React. Mostly on the frontend.",
    "No: He's a US citizen. So a US company can hire him.",
    "Yes: The service has 1,100+ tests, and I think that's OK.",
    "“Frontend” is where React and Svelte come in.",
  ]) {
    assert.equal(shown(written, { ...ACME, lines: `${ACME.lines} ${SKILLS.lines} ${VISA.lines}` }, "And?"), written);
  }
  // Which leaves one name the check can't tell from a word: one that only
  // starts a sentence, in a question that didn't name it.
  assert.equal(shown("Tokyo is where he lives.", SKILLS, "where does he live?"), "Tokyo is where he lives.");
  // A word with a capital inside it is a name wherever it is.
  assert.deepEqual(unsourced("GraphQL is his favourite. AWS too.", SKILLS), ["GraphQL", "AWS"]);
});
