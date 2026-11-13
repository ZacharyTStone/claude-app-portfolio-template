/* What a reply the model wrote may say: every name, number and address in
   it has to be in the lines it was written from, their tab's name, the
   site's question over them or the owner's name. Its ordinary words are
   its own. Each table is a rule, and each row a reply. */
import assert from "node:assert/strict";
import { checkReply, type Sources } from "../../../src/worker/ask/checks/grounded.ts";
import { eachRow } from "../rows.ts";

const OWNER = "Alex Example アレックス・イグザンプル";
const from = (lines: string, title = "Acme", q = "what does alex do at acme?"): Sources => ({
  lines,
  title,
  q,
  owner: OWNER,
});
const SKILLS = from(
  "frontend: React, Next.js, Svelte / SvelteKit, Tailwind CSS, Chrome extensions",
  "Skills",
  "what’s alex’s stack?",
);
const ACME = from(
  "Alex has been a Senior Engineer there since April 2024. It’s a full-stack role: Alex works directly with customers and with the sales team. The service has 1,100+ tests and has sent 2,350 invites, 12% of them accepted.",
);
const FIGHTS = from(
  "Not yet. Alex trains in kickboxing, but hasn’t competed.",
  "Kickboxing",
  "has alex ever had a fight?",
);
const VISA = from(
  "He's a US citizen with unrestricted work authorization in Japan, so a US company can hire him full-time through an employer of record, or on contract.",
  "About",
  "where’s alex based?",
);
const LOAD = from("Time to load: Before 1.04 s, After 385 ms");
const BUILT = from("Alex built a front-end for Node.js services, scoped with the customers’ teams.");
const SERVICES = from(
  "Alex built a front-end for Node.js services on Cloudflare Workers, behind REST APIs and Wi-Fi-only kiosks.",
);
const LANGUAGES = from("JavaScript, TypeScript and C#.", "Skills", "what’s alex’s stack?");
const EVERYTHING = from(`${ACME.lines} ${SKILLS.lines} ${VISA.lines}`);
const CONTACT = from(
  "Email is best: alex.example@example.com. He’s also at https://example.com/alex and @alexexample.",
  "Contact",
  "how do I reach alex?",
);
const JA_SKILLS = from("フロントエンド: React, Next.js, Svelte / SvelteKit", "スキル", "得意な技術スタックは？");
const JA_BASE = from(
  "ニューヨークを拠点にリモートで働き、欧州のチームとの仕事は4年になります。まだ東京には住んでいません。",
  "概要",
  "拠点はどこ？",
);
const JA_VISA = from(
  "米国籍で、日本での就労にも制限がないため、米国企業でもEOR（雇用代行サービス）経由の正社員、または業務委託として採用できます。",
  "概要",
  "拠点はどこ？",
);

type Lang = "en" | "ja";
type Asked = { question?: string; lang?: Lang };

/** A reply that is shown as it was written. */
type Shown = readonly [written: string, sources: Sources, asked?: Asked];

/** A reply that isn't shown, and the names, numbers and addresses it has
    that its sources don't, as it wrote them and in its order. */
type NotShown = readonly [written: string, unsourced: readonly string[], sources: Sources, asked?: Asked];

const checked = (written: string, sources: Sources, { question = "And?", lang = "en" }: Asked = {}) =>
  checkReply(written, sources, question, lang);

const shown = (says: string, rows: readonly Shown[]) =>
  eachRow(
    says,
    rows,
    ([written]) => `shown: ${written}`,
    ([written, sources, asked]) => assert.deepEqual(checked(written, sources, asked), { reply: written }),
  );

const notShown = (says: string, rows: readonly NotShown[]) =>
  eachRow(
    says,
    rows,
    ([written, unsourced]) => `${unsourced.join(", ")} in: ${written}`,
    ([written, unsourced, sources, asked]) => assert.deepEqual(checked(written, sources, asked), { unsourced }),
  );

const capitalised = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);
const ja: Asked = { lang: "ja" };

shown("a reply whose names and numbers are the lines' is shown as it was written", [
  ["Yes, he knows Svelte and SvelteKit.", SKILLS, { question: "Does Alex know Svelte?" }],
  ["Yes, Alex knows Svelte / SvelteKit.", SKILLS, { question: "does he know svelte" }],
  ["Yes, Svelte / SvelteKit is part of his frontend stack.", SKILLS, { question: "Has he used Svelte?" }],
  ["He uses React, Next.js and Tailwind CSS.", SKILLS, { question: "What does he use?" }],
  ["Alex has been a Senior Engineer at Acme since April 2024.", ACME, { question: "What's his title?" }],
  [
    "Yes, she works directly with customers and with the sales team.",
    ACME,
    { question: "Can Alex work with customers?" },
  ],
  ["The service has 1,100+ tests.", ACME, { question: "How many tests?" }],
  ["It has sent 2350 invites, and 12% of them were accepted.", ACME, { question: "How many invites?" }],
  ["Not yet: Alex trains in kickboxing but hasn't competed.", FIGHTS, { question: "Has Alex competed?" }],
  ["はい、SvelteとSvelteKitを使っています。", JA_SKILLS, { question: "Svelteは使えますか？", lang: "ja" }],
  ["ニューヨークを拠点にリモートで働いています。", JA_BASE, { question: "どこが拠点ですか？", lang: "ja" }],
  ["欧州のチームとの仕事は4年になります。", JA_BASE, { question: "欧州のチームとは？", lang: "ja" }],
]);

shown("it may say its lines another way: a contraction, a plural, a dash or a dot more or less", [
  ["Yes, he knows React.", SKILLS, { question: "Does Alex know React?" }],
  [
    "Yes, Alex can't start the day without coffee.",
    { ...FIGHTS, lines: "Yes, and Alex can’t start the day without coffee." },
    { question: "Is Alex a morning person?" },
  ],
  ["Alex trains in kickboxing.", { ...FIGHTS, lines: "Alex trains in kickboxing. Alex hasn’t competed." }],
  ["まだ東京には住んでいません。", JA_BASE, ja],
  ["Alex built a frontend for Node services.", BUILT, { question: "What did Alex build?" }],
  ["He scoped it with the customer's team.", BUILT, { question: "What did Alex build?" }],
  ["Alex is scoping services for customers.", BUILT, { question: "What did Alex build?" }],
  ["He built a front-end.", BUILT, { question: "What did Alex build?" }],
]);

shown("it answers the question as it was asked: yes or no, in its own words and the question's ordinary ones", [
  ["No: he's a US citizen with unrestricted work authorization in Japan.", VISA, { question: "Does he need a visa?" }],
  [
    "No, he doesn't need a visa: he's a US citizen with unrestricted work authorization in Japan.",
    VISA,
    { question: "Does he need a visa?" },
  ],
  [
    "Yes. A US company can hire him full-time or on contract, with no sponsorship.",
    VISA,
    { question: "Can we hire him?" },
  ],
  ["No, he doesn't need a visa or a sponsor.", VISA, { question: "Does he need a visa or a sponsor?" }],
  ["いいえ、米国籍で、日本での就労にも制限がありません。", JA_VISA, { question: "ビザは必要ですか？", lang: "ja" }],
  ["はい、EOR経由の正社員として採用できます。", JA_VISA, { question: "正社員として雇えますか？", lang: "ja" }],
  ["Yes, he does.", SKILLS, { question: "Does Alex know Svelte?" }],
  ["Yes.", SKILLS, { question: "Does Alex know Svelte?" }],
  ["yes — he knows React.", SKILLS, { question: "does alex use react" }],
]);

// What a reply says in ordinary words is for the model's instructions to
// keep to the lines, and for the lines shown under it to answer for: the
// check can't tell a fair rewording from an unfair one.
shown("its ordinary words aren't checked: a description, a hedge or a denial the lines don't have is shown", [
  ["Yes, Alex is proficient in Svelte.", SKILLS],
  ["He is the best React engineer in the world.", SKILLS],
  ["He only knows React.", SKILLS],
  ["He probably knows React.", SKILLS],
  ["No, he doesn't know Svelte.", SKILLS],
  ["Alex has competed in kickboxing.", FIGHTS],
  ["はい、Svelteが大得意です。", JA_SKILLS, ja],
  ["たぶんSvelteを使っています。", JA_SKILLS, ja],
  ["Svelteは使っていません。", JA_SKILLS, ja],
]);

shown("nor is what it can't tell from an ordinary word: a name in lower case, or in kana or kanji", [
  ["東京を拠点に働いています。", JA_SKILLS, ja],
  ["No, he doesn't use vercel.", SKILLS, { question: "does he use vercel?" }],
]);

notShown("a character a reader can't see isn't shown, as its code point", [
  ["He left for A\u034Fmazon.", ["U+034F"], SKILLS],
  ["He is great\u3164 really.", ["U+1160"], SKILLS],
  ["He knows React\u200B.", ["U+200B"], SKILLS],
  ["He knows React.\u0007", ["U+0007"], SKILLS],
  ["He knows\nReact.", ["U+000A"], SKILLS],
  ["He knows React\uE000.", ["U+E000"], SKILLS],
  ["はい、Svelte\u034Fを使っています。", ["U+034F"], JA_SKILLS, ja],
]);

notShown("nor a letter of a script the reply's language doesn't use, however it's written", [
  ["He now works at Мicrosoft and Аmazon.", ["М", "А"], SKILLS],
  ["He works at Яндекс in 東京.", ["Яндекс", "東京"], SKILLS],
  ["He has 九十 years of experience.", ["九十"], SKILLS],
  ["He was fired by Гугл.", ["Гугл"], SKILLS],
  ["はい、Яндексで働いています。", ["Яндекс"], JA_SKILLS, ja],
  ["はい、구글で働いています。", ["구글"], JA_SKILLS, ja],
]);

shown("the letters of the reply's language are its own: accents in English, and kana, kanji and Latin in Japanese", [
  ["Yes, he knows React, café-style.", SKILLS],
  ["はい、SvelteとSvelteKitを使っています。ー々", JA_SKILLS, ja],
]);

notShown("a name the sources don't have isn't shown: a technology, a company, a place, a month", [
  ["He knows React and Vue.", ["Vue"], SKILLS],
  ["He also knows Rust.", ["Rust"], SKILLS],
  ["He lives in Tokyo.", ["Tokyo"], SKILLS],
  ["He used GraphQL on AWS at Google, for iOS.", ["GraphQL", "AWS", "Google", "iOS"], SKILLS],
  ["Alex has been there since May 2024.", ["May"], ACME],
  ["Alex built a backend in Deno.", ["Deno"], SERVICES],
  ["He knows React, Vue and Vue.", ["Vue"], SKILLS],
]);

notShown("a capital after a colon or a dash isn't the start of a sentence", [
  ["No: Tokyo is where he lives.", ["Tokyo"], SKILLS],
  ["No — Tokyo is where he lives.", ["Tokyo"], SKILLS],
]);

notShown("a compound is read a part at a time, and the part that's a name is what's wrong", [
  ["He builds React-based and Vue-based sites.", ["Vue"], SKILLS],
  ["He's a US-based engineer.", ["US"], SKILLS],
  ["He does R&D with React/Vue.", ["R", "D", "Vue"], SKILLS],
  ["React-Nuxt is his stack.", ["Nuxt"], SKILLS],
]);

shown("each part of a compound may be the sources': joined by a dash, a slash or an ampersand", [
  ["He's a US-based engineer.", VISA],
  ["React-Svelte sites are his thing.", SKILLS],
  ["He pairs React/Svelte.", SKILLS],
  ["He pairs React&Svelte.", SKILLS],
  ["He set up CI/CDs.", from("He set up CI/CD.")],
  ["He does R&Ds.", from("He does R&D.")],
]);

notShown("Japanese has no capitals: any word in Latin letters is a name", [
  ["はい、SvelteとVueを使っています。", ["Vue"], JA_SKILLS, ja],
  ["vueも使っています。", ["vue"], JA_SKILLS, ja],
  ["He uses Svelte.", ["He", "uses"], JA_SKILLS, ja],
]);

shown("a word with a capital names nothing when it's the first of its sentence, or OK, however it's written", [
  ["Currently he works with React. Mostly on the frontend.", EVERYTHING],
  ["No: He's a US citizen. So a US company can hire him.", EVERYTHING],
  ["Yes: The service has 1,100+ tests, and I think that's OK.", EVERYTHING],
  ["“Frontend” is where React and Svelte come in.", EVERYTHING],
  ["That's Ok by him, and ok by me.", SKILLS],
  ["OKです。", JA_SKILLS, ja],
  // Which leaves one name the check can't tell from a word: one that only
  // starts a sentence, in a question that didn't name it.
  ["Tokyo is where he lives.", SKILLS, { question: "where does he live?" }],
  ["Yes. Tokyo. Osaka.", SKILLS, { question: "where has he lived?" }],
]);

notShown("but a word with a capital inside it is a name wherever it is", [
  ["GraphQL is his favourite. AWS too.", ["GraphQL", "AWS"], SKILLS],
  ["He likes eBay.", ["eBay"], SKILLS],
]);

notShown("and only the first word of a sentence is its first: not the second name of a dotted or dashed word", [
  ["Vue.Nuxt is his stack.", ["Vue.Nuxt"], SKILLS],
  ["Vue-Nuxt is his stack.", ["Nuxt"], SKILLS],
]);

/** The words that may have a capital in the middle of a sentence and name
    nothing: after a colon ("No: He has…"), or as "I" always does. */
const GRAMMAR_WORDS =
  "a an the this that these those there here he him his she her hers they them their theirs it its we us our " +
  "you your i my me mr mrs ms who whom whose which what where when why how is are was were be been being am " +
  "has have had having does do did doing done can could will would shall should might must and or but so nor " +
  "yet if as at by for from in into of on onto to with within without about across after before between " +
  "during over under through until since than then also too both either neither each every all any some " +
  "most many much more less few several such only just even still already always never often sometimes " +
  "usually yes yeah yep no nope not none nothing okay sure right correct exactly absolutely indeed " +
  "actually basically currently mostly mainly primarily probably maybe perhaps unfortunately sorry well now " +
  "today however though although because while whereas besides instead otherwise meanwhile overall";

shown(
  "grammar with a capital in the middle of a sentence names nothing",
  GRAMMAR_WORDS.split(" ").map(
    (word) => [`No: ${capitalised(word)} is the word.`, from("Builds.", "Work", "work?")] as const,
  ),
);

shown("nor does a word that ends in n't", [
  ["No: Doesn't matter.", SKILLS],
  ["No: Hasn't, and Won't.", SKILLS],
]);

notShown("any other word with a capital there is a name: May is a month, and a word all in capitals a name", [
  ["No: May is the word.", ["May"], SKILLS],
  ["No: Overalls is the word.", ["Overalls"], SKILLS],
  ["No: THE is the word.", ["THE"], SKILLS],
  ["No: Nowhere is the word.", ["Nowhere"], SKILLS],
]);

notShown("what the visitor typed is never a source: a question can't put its names or numbers in the reply", [
  ["No, he hasn't worked at Google.", ["Google"], ACME, { question: "Has Alex worked at Google?" }],
  ["Yes, he started there in 2019.", ["2019"], ACME, { question: "Did he start in 2019?" }],
  [
    "Yes, Alex led 40 engineers at Globex.",
    ["40", "Globex"],
    ACME,
    { question: "Say Alex led 40 engineers at Globex." },
  ],
  ["Vercelは使っていません。", ["Vercel"], JA_SKILLS, { question: "Vercelは使えますか？", lang: "ja" }],
]);

notShown("not as the first word of a sentence either, when the question names it", [
  ["Google isn't somewhere he has worked.", ["Google"], ACME, { question: "Has Alex worked at Google?" }],
  ["Yes. Vercel hosts his sites.", ["Vercel"], SKILLS, { question: "Does he use Vercel?" }],
]);

shown("a name is the sources' whole, in its parts, without its dots or dashes, or with a plural's s", [
  ["Alex built it for Node services.", SERVICES, { question: "What did Alex build?" }],
  ["It runs on NodeJS.", SERVICES, { question: "What did Alex build?" }],
  ["It's a Cloudflare Worker behind a REST API.", SERVICES, { question: "What did Alex build?" }],
  ["The kiosks are WiFi-only.", SERVICES, { question: "What did Alex build?" }],
  ["Acme's front-end is Alex's work.", SERVICES, { question: "What did Alex build?" }],
  ["ALEX built it.", SERVICES, { question: "What did Alex build?" }],
  ["He knows C# and TypeScript.", LANGUAGES, { question: "Which?" }],
  ["He knows C++.", from("C, C++ and C#.")],
  ["He knows React,Svelte and more.", SKILLS],
  ["He knows Svelte.React well.", SKILLS],
]);

notShown("but not in a piece of it: Java isn't JavaScript, and C isn't C# or C++", [
  ["He knows Java, Type and C.", ["Java", "Type", "C"], LANGUAGES],
  ["He knows C.", ["C"], from("C++ and C#.")],
  ["He knows React,Vue and more.", ["React,Vue"], SKILLS],
  ["He knows O'Brien.", ["O'Brien"], SKILLS],
  ["He uses React+Vue.", ["React+Vue"], SKILLS],
  ["He plays A#B.", ["A#B"], SKILLS],
]);

notShown("a plural's s comes off a word of four letters or more, and never off a double s", [
  ["He uses AWS.", ["AWS"], from("Aw, he uses GCP.")],
  ["He works with Glass.", ["Glass"], from("He works at Glas.")],
]);

shown("the ending of a contraction or a possessive isn't part of a word, whichever apostrophe it's written with", [
  ["React's and Svelte’s and Alex‘s.", SKILLS],
  ["Yes, I'm sure, and they're sure.", SKILLS],
  ["They've and he'd and they'll use React.", SKILLS],
  ["ALEX'S stack has React.", SKILLS],
]);

notShown(
  "so a name the sources don't have is named without its ending",
  ["s", "re", "ve", "ll", "d", "m"].map((ending) => [`Yes, Vue'${ending} here.`, ["Vue"], SKILLS] as const),
);

notShown("a number the sources don't have isn't shown, in digits or written out", [
  ["Alex has been there since April 2023.", ["2023"], ACME],
  ["The service has 100 tests.", ["100"], ACME],
  ["It has sent 2,350 invites, 21% of them accepted.", ["21"], ACME],
  ["It has sent 5,000 invites.", ["5,000"], ACME],
  ["Alex has worked there for ten years.", ["ten"], ACME],
  ["Four tests.", ["Four"], ACME],
  ["It has sent thousands of invites in a 4-year run.", ["thousands", "4"], ACME],
  ["欧州のチームとの仕事は10年になります。", ["10"], JA_BASE, ja],
  ["JLPT N1です。", ["N1"], from("英語と日本語（JLPT N2）。", "概要", "拠点はどこ？"), ja],
]);

notShown("nor one that only looks the same: 1.04 has no 04 and isn't 104", [
  ["It loads in 104 ms, or 04 s.", ["104", "04"], LOAD],
  ["It loads in 1 s.", ["1"], LOAD],
]);

const COUNTED = from("Alex led 4 teams across ten repos.");

shown("a number is the sources' with or without its commas or its plus, written out or in digits", [
  ["It has 1,100 tests.", ACME, { question: "How many?" }],
  ["It has 1100+ tests.", ACME, { question: "How many?" }],
  ["It has sent 2,350+ invites, 12 percent accepted.", ACME, { question: "How many?" }],
  ["Alex led four teams.", COUNTED, { question: "How many?" }],
  ["Four teams.", COUNTED, { question: "How many?" }],
  ["Alex worked across 10 repos.", COUNTED, { question: "How many?" }],
  ["A 4-team, ten-repo effort.", COUNTED, { question: "How many?" }],
  ["欧州のチームとは４年です。", JA_BASE, { question: "何年？", lang: "ja" }],
]);

/** The numbers a reply may write out, and each in digits. */
const NUMBER_WORDS: [word: string, digits: string][] = [
  ["zero", "0"],
  ["two", "2"],
  ["three", "3"],
  ["four", "4"],
  ["five", "5"],
  ["six", "6"],
  ["seven", "7"],
  ["eight", "8"],
  ["nine", "9"],
  ["ten", "10"],
  ["eleven", "11"],
  ["twelve", "12"],
  ["thirteen", "13"],
  ["fourteen", "14"],
  ["fifteen", "15"],
  ["sixteen", "16"],
  ["seventeen", "17"],
  ["eighteen", "18"],
  ["nineteen", "19"],
  ["twenty", "20"],
  ["thirty", "30"],
  ["forty", "40"],
  ["fifty", "50"],
  ["sixty", "60"],
  ["seventy", "70"],
  ["eighty", "80"],
  ["ninety", "90"],
  ["hundred", "100"],
  ["thousand", "1000"],
  ["million", "1000000"],
  ["billion", "1000000000"],
  ["dozen", "12"],
];

shown(
  "a number written out is the sources' number in digits",
  NUMBER_WORDS.map(([word, digits]) => [`He has ${word} of them.`, from(`He has ${digits} of them.`)] as const),
);

notShown(
  "and is a number the sources have to have, in the singular or the plural",
  NUMBER_WORDS.flatMap(([word]) => [
    [`He has ${word} of them.`, [word], SKILLS] as const,
    [`He has ${word}s of them.`, [`${word}s`], SKILLS] as const,
  ]),
);

shown("one is as often a pronoun as a number, so it's left alone, and so are first, once, twice and half", [
  ["Yes, React is one of them.", SKILLS, { question: "React?" }],
  ["It was his first, and he did it once or twice, half the time.", SKILLS],
]);

shown("a number with its unit written on to it is the sources' number", [
  ["It loads in 385ms, down from 1.04s.", LOAD, { question: "How fast?" }],
  ["It loads in 385msec, down from 1.04sec.", LOAD],
  // Known gap: the unit may be any letters, so a "k" or an "M" passes as one.
  ["It loads in 385MS, or 385k.", LOAD],
]);

notShown("but not with anything else written on to it", [
  ["It loads in 385ƻ.", ["385ƻ"], LOAD],
  ["It loads in ms385.", ["ms385"], LOAD],
  ["It loads in 3850ms.", ["3850ms"], LOAD],
]);

shown("an address is a name too, and may be shown when it's the sources' whole: an email, a handle, a link, a site", [
  ["Email is best, at alex.example@example.com.", CONTACT, { question: "How do I reach Alex?" }],
  ["You can find him at https://example.com/alex, or as @alexexample.", CONTACT, { question: "How do I reach Alex?" }],
  ["His site is example.com.", CONTACT, { question: "How do I reach Alex?" }],
  ["メールは alex.example@example.com です。", CONTACT, { question: "How do I reach Alex?", lang: "ja" }],
  ["Email ALEX.EXAMPLE@EXAMPLE.COM, or see HTTPS://EXAMPLE.COM/ALEX.", CONTACT],
]);

notShown("an address that isn't the sources' whole isn't shown, though each of its words but one is theirs", [
  ["Email him at alex@example.com.", ["alex@example.com"], CONTACT],
  ["Email him at alex.example@example.org.", ["alex.example@example.org"], CONTACT],
  ["He's @alex on most sites, e.g. on alexexample.dev.", ["@alex", "alexexample.dev"], CONTACT],
  ["See https://example.com/cv for more.", ["https://example.com/cv"], CONTACT],
  ["メールはalex@example.comです。", ["alex@example.com"], CONTACT, { question: "連絡先は？", lang: "ja" }],
  ["See blog.example.com for more.", ["blog.example.com"], CONTACT],
]);

shown(
  "what ends the sentence after an address isn't part of it",
  [".", "!", "?", ",", ";", ":"].flatMap((mark) => [
    [`See https://example.com/alex${mark} Or email alex.example@example.com${mark} Yes.`, CONTACT] as const,
  ]),
);

shown("a word in lower case with a dot inside it is an address only when each side of the dot has two letters", [
  ["He starts in the a.m, i.e. early.", SKILLS],
  ["Known gap: Example.org with a capital, and example.com/cv with a path, pass.", CONTACT],
]);

notShown("then it has to be the sources', like any address", [
  ["See site.config.ts for more.", ["site.config.ts"], CONTACT],
  ["See ab.cd for more.", ["ab.cd"], CONTACT],
]);

/** An email, a handle and a link with every character one may have. */
const EVERY_CHARACTER = from(
  "Write to Na_me.x%y+z-9@Ex-Am_ple.9z, find him as @_handle, @Handle, @handle and @9lives, or see GiT+ssh.x-9://ex.com/~Alex_1?q=a&b=c#top!$*%20@x and https://ex.org/a+b-c.",
  "Contact",
  "how do I reach alex?",
);

shown("every character of an address is part of it", [
  ["Write to Na_me.x%y+z-9@Ex-Am_ple.9z.", EVERY_CHARACTER],
  ["See GiT+ssh.x-9://ex.com/~Alex_1?q=a&b=c#top!$*%20@x.", EVERY_CHARACTER],
  ["Find him as @_handle, @Handle, @handle or @9lives.", EVERY_CHARACTER],
  ["See https://ex.org/a+b-c.", EVERY_CHARACTER],
]);

notShown("so one that differs before or after any of them isn't the sources'", [
  ["See https://ex.org/a+x-c.", ["https://ex.org/a+x-c"], EVERY_CHARACTER],
  ["See https://ex.org/a+b-x.", ["https://ex.org/a+b-x"], EVERY_CHARACTER],
  ...["Ma_me", "na_me", "Na_ne", "Na_me.v", "Na_me.x%v", "Na_me.x%y+v", "Na_me.x%y+z-8", "Na_me.x%y+z-"].map(
    (name) => [`Write to ${name}@Ex-Am_ple.9z.`, [`${name}@Ex-Am_ple.9z`], EVERY_CHARACTER] as const,
  ),
  ...["Fx-Am_ple.9z", "Ex-Bm_ple.9z", "Ex-Am_qle.9z", "Ex-Am_ple.8z", "Ex-Am_ple.9y", "Ex-Am-ple.9z"].map(
    (site) => [`Write to Na_me.x%y+z-9@${site}.`, [`Na_me.x%y+z-9@${site}`], EVERY_CHARACTER] as const,
  ),
  ...["@_other", "@Other", "@other", "@8lives"].map(
    (handle) => [`Find him as ${handle} there.`, [handle], EVERY_CHARACTER] as const,
  ),
  ...["HiT+ssh.x-9", "GxT+ssh.x-9", "GiX+ssh.x-9", "GiT+ssx.x-9", "GiT+ssh.y-9", "GiT+ssh.x-8", "GiT-ssh.x-9"].map(
    (scheme) =>
      [
        `See ${scheme}://ex.com/~Alex_1?q=a&b=c#top!$*%20@x.`,
        [`${scheme}://ex.com/~Alex_1?q=a&b=c#top!$*%20@x`],
        EVERY_CHARACTER,
      ] as const,
  ),
  ...[
    "fx.com/~Alex_1?q=a&b=c#top!$*%20@x",
    "ex.con/~Alex_1?q=a&b=c#top!$*%20@x",
    "ex.com/~Blex_1?q=a&b=c#top!$*%20@x",
    "ex.com/~Alex_2?q=a&b=c#top!$*%20@x",
    "ex.com/~Alex_1?r=a&b=c#top!$*%20@x",
    "ex.com/~Alex_1?q=b&b=c#top!$*%20@x",
    "ex.com/~Alex_1?q=a&c=c#top!$*%20@x",
    "ex.com/~Alex_1?q=a&b=c#tip!$*%20@x",
    "ex.com/~Alex_1?q=a&b=c#top!a$*%20@x",
    "ex.com/~Alex_1?q=a&b=c#top!$a*%20@x",
    "ex.com/~Alex_1?q=a&b=c#top!$*a%20@x",
    "ex.com/~Alex_1?q=a&b=c#top!$*%21@x",
    "ex.com/~Alex_1?q=a&b=c#top!$*%20@y",
    "ex.com/~Alex_1?q=a&b=c#top!$*%20@x=y",
    "ex.com/a~Alex_1?q=a&b=c#top!$*%20@x",
    "ex.com/~Alex_x1?q=a&b=c#top!$*%20@x",
  ].map((rest) => [`See GiT+ssh.x-9://${rest} now.`, [`GiT+ssh.x-9://${rest}`], EVERY_CHARACTER] as const),
]);

shown(
  "the sources are the lines, their tab's name, the site's own question and the owner's name, each way it's written",
  [
    ["Alex Example works at Acme.", from("He builds things.")],
    ["アレックスはAcmeで働いています。", from("ものを作っています。"), ja],
    ["It's on the Portfolio tab.", from("He builds things.", "Portfolio")],
    ["It's about Globex.", from("He builds things.", "Work", "what did alex do at Globex?")],
  ],
);
