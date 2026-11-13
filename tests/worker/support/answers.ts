/* A small ask.json, in the shape the build writes: what the Worker's tests
   have it pick from. */
import type { AskAnswer, AskIndex } from "../../../src/contracts/ask.ts";

export const EN: AskAnswer[] = [
  { id: "about.1", title: "About", q: "who is alex example?", text: "Alex is a senior software engineer." },
  { id: "about.2", title: "About", q: "where's alex based?", text: "New York, working with teams in Europe and Asia." },
  { id: "skills.1", title: "Skills", q: "what does alex work with?", text: "TypeScript, React, Node.js and Postgres." },
  { id: "skills.2", title: "Skills", q: "what languages does alex speak?", text: "English, and Japanese (JLPT N2)." },
  {
    id: "acme.1",
    title: "Acme",
    q: "what does alex do at acme?",
    text: "Alex has been at Acme since 2024. Alex moved the web app to server-rendered pages, which cut the time to first load by 40%.\nTime to load: Before 1.04 s, After 385 ms",
  },
  { id: "notes.2", title: "Pocket Notes", q: "what did alex build?", text: "An offline-first notes app." },
  { id: "contact.1", title: "Contact", q: "how do I reach alex?", text: "By email, or on LinkedIn." },
  { id: "personal-food.1", title: "Food", q: "what's alex's favorite food?", text: "Ramen." },
];
export const JA: AskAnswer[] = [
  { id: "about.1", title: "概要", q: "アレックス・イグザンプルとは？", text: "シニアソフトウェアエンジニアです。" },
  {
    id: "about.2",
    title: "概要",
    q: "どこに住んでいる？",
    text: "ニューヨーク在住で、欧州やアジアのチームと働いています。",
  },
  { id: "skills.1", title: "スキル", q: "使っている技術は？", text: "TypeScript、React、Node.js、Postgres。" },
  { id: "skills.2", title: "スキル", q: "日本語のレベルは？", text: "英語と日本語（JLPT N2）。" },
  {
    id: "acme.1",
    title: "Acme",
    q: "Acmeでは何をしている？",
    text: "2024年からAcmeで働いています。Webアプリをサーバーレンダリングに移行し、初回表示までの時間を40%短縮しました。",
  },
  { id: "notes.2", title: "Pocket Notes", q: "何を作った？", text: "オフライン対応のメモアプリ。" },
  { id: "contact.1", title: "連絡先", q: "連絡方法は？", text: "メールか LinkedIn で。" },
  { id: "personal-food.1", title: "食べ物", q: "好きな食べ物は？", text: "ラーメン。" },
];
export const INDEX: AskIndex = {
  name: "Alex Example",
  role: "a software engineer",
  main: "en",
  answers: { en: EN, ja: JA },
};
export const IDS = EN.map((a) => a.id);
