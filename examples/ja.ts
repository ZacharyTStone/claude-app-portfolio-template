/* A Japanese version of the sample in site.config.ts, to show how a second
   language works. To try it, add to site.config.ts, under its import:

     import japanese from "./examples/ja.ts";

   and to `languages`, after `en`:

     ja: japanese(me),

   then follow docs/languages.md. A language of your own works the same
   way: copy this file and translate it. It needs the same thread ids, as
   many answers in each, and the same personal answers and home prompts,
   in the same order; the build says if it doesn't. */
import type { Language } from "../src/config/language.ts";

/** The facts this page takes from site.config.ts's `me`. They are spelt
    out here, not imported, so that a config whose `me` has changed shape
    still type-checks until it asks for this page. */
type SampleFacts = {
  first: string;
  email: string;
  github: string;
  linkedin: string;
  resume: string;
  jobs: { acme: { company: string }; globex: { company: string } };
  project: { name: string; site: string; href: string };
};

/** The facts as Japanese writes them. The rest come from `me`. */
const ja = {
  name: "アレックス・エグザンプル",
  first: "アレックス",
  place: "ニューヨーク",
  role: "ソフトウェアエンジニア",
  titles: { acme: "シニアソフトウェアエンジニア", globex: "フロントエンドエンジニア" },
  years: { acme: "2024年〜現在", globex: "2021年〜2024年" },
};

export default function japanese(me: SampleFacts): Language {
  const { acme, globex } = me.jobs;
  return {
    label: "日本語",
    name: "日本語",
    locale: "ja_JP",
    meta: {
      title: `${ja.name} — ${ja.role}`,
      description: `${ja.role} · TypeScript · React · Node.js · ${ja.place} · リモート`,
      imageAlt: `${ja.name}、${ja.role}`,
      preload: ["/assets/fonts/inter.woff2", "/assets/fonts/noto-sans-jp.woff2", "/assets/fonts/noto-serif-jp.woff2"],
    },
    person: { name: ja.name, jobTitle: ja.role },
    home: {
      greeting: {
        default: "こんにちは。",
        morning: "おはようございます。",
        afternoon: "こんにちは。",
        evening: "こんばんは。",
        late: "お疲れさまです。",
      },
      intro: `${ja.name}は、${ja.place}を拠点に、データベースからボタンまでWebアプリを作る${ja.role}です。`,
      hint: "左のタブから詳しくご覧ください。",
      tagline: `${ja.place}を拠点にリモートで働く${ja.role}`,
      prompts: [
        { q: `${ja.name}ってどんな人？`, answer: "about.1" },
        { q: `${acme.company}では何を作ったの？`, answer: "acme.2" },
        { q: `${me.project.name}はオフラインでどう動くの？`, answer: "notes.2" },
        { q: "コーヒーはどう飲むの？", answer: "personal-coffee.1" },
      ],
    },
    sidebar: {
      newTab: "新しいタブ",
      nav: [
        { tab: "about", icon: "about", label: "プロフィール" },
        { tab: "skills", icon: "skills", label: "スキル" },
        { tab: "resume", icon: "file", label: "履歴書" },
        { tab: "contact", icon: "contact", label: "連絡先" },
      ],
      groups: [
        {
          id: "work",
          label: "経歴",
          tabs: [
            { tab: "acme", title: acme.company, subtitle: `${ja.titles.acme} · ${ja.years.acme}`, live: "現職" },
            { tab: "globex", title: globex.company, subtitle: `${ja.titles.globex} · ${ja.years.globex}` },
          ],
        },
        {
          id: "projects",
          label: "プロジェクト",
          tabs: [{ tab: "notes", title: me.project.name, subtitle: "TypeScript · React · IndexedDB" }],
        },
      ],
    },
    threads: [
      {
        id: "about",
        title: "プロフィール",
        messages: [
          {
            q: `${ja.name}ってどんな人？`,
            a: [
              `${ja.first}は、データベースからボタンまでWebアプリを作る**${ja.role}**です。実際に使う人たちと近い距離で働くのが好きです。`,
            ],
          },
          {
            q: "拠点はどこ？",
            a: [
              `${ja.place}を拠点に、さまざまなタイムゾーンのチームとリモートで働いています。`,
              {
                card: {
                  file: "profile.yaml",
                  lines: [
                    ["based_in", ja.place],
                    ["work_style", "リモート中心"],
                    ["languages", "英語 · スペイン語"],
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        id: "acme",
        title: acme.company,
        pill: { label: "現職", live: true },
        messages: [
          {
            q: `${ja.first}って${acme.company}で何してるの？`,
            read: {
              file: "experience/acme.md",
              card: {
                file: "role.yaml",
                lines: [
                  ["company", acme.company, "開発者向けツール（リモート）"],
                  ["role", ja.titles.acme, ja.years.acme],
                  ["focus", { accent: "Webアプリ" }],
                ],
              },
            },
            a: [`2024年に${acme.company}に入社し、顧客が毎日使うWebアプリを担当しています。`],
          },
          {
            q: "そこで何を作ったの？",
            a: [
              [
                "メインのダッシュボードを作り直し、1秒以内に表示されるようにしました。",
                "セルフサービスの請求管理を追加し、サポートに連絡せずにプランを変更できるようにしました。",
                "チーム全体で使う共通コンポーネントのライブラリを立ち上げました。",
              ],
              {
                bars: {
                  title: "ダッシュボードの表示時間",
                  note: "3倍速く",
                  rows: [
                    { label: "以前", value: "2.4秒", amount: 2400 },
                    { label: "現在", value: "0.8秒", amount: 800, accent: true },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        id: "globex",
        title: globex.company,
        messages: [
          {
            q: `${ja.first}って${globex.company}では何してたの？`,
            read: {
              file: "experience/globex.md",
              card: {
                file: "role.yaml",
                lines: [
                  ["company", globex.company, "制作会社（リモート）"],
                  ["role", ja.titles.globex, ja.years.globex],
                ],
              },
            },
            a: [`制作会社の${globex.company}で、クライアントのサイトやアプリを作っていました。`],
          },
          {
            q: "いちばん大きなプロジェクトは？",
            a: [
              "複数のクリニック向けの予約アプリで、毎週数千人の患者が使っています。最初のプロトタイプからリリースまで、フロントエンドを率いました。",
              {
                flow: {
                  title: "最初のプロトタイプからリリースまで",
                  steps: [
                    { name: "プロトタイプ", note: "受付スタッフが試用" },
                    { name: "パイロット", note: "1つのクリニック" },
                    { name: "リリース", note: "すべてのクリニック" },
                  ],
                },
              },
              {
                quote: {
                  text: "電話しなくても、患者さんが1分で予約できるようになりました。",
                  by: "クリニックの運営責任者",
                },
              },
            ],
          },
        ],
      },
      {
        id: "notes",
        title: me.project.name,
        pill: { label: "サイドプロジェクト" },
        messages: [
          {
            q: `${me.project.name}って何？`,
            a: [
              "オフラインファーストのWebアプリの仕組みを学ぶために作った、小さなメモアプリです。",
              {
                image: {
                  src: "/assets/pocket-notes.webp",
                  alt: "Pocket Notes：左にメモの一覧、右に開いているメモ。",
                  width: 1280,
                  height: 800,
                  caption: `ブラウザで動く${me.project.name}。`,
                },
              },
              { link: { name: me.project.site, kind: "Webサイト", href: me.project.href, icon: "globe" } },
            ],
          },
          {
            q: "オフラインでどう動くの？",
            a: [
              "メモはまずブラウザに保存されるので、入力がネットワークを待つことはありません。オフラインの間の変更はたまっていき、接続が戻ると同期されます。",
              {
                image: {
                  src: "/assets/saving-a-note-ja.svg",
                  still: "/assets/saving-a-note-ja-still.svg",
                  alt: "図。メモに行が入力されるたびに、ブラウザの中のIndexedDBにすぐ保存されます。変更は同期キューに入り、「オフライン」のゲートの前で待ちます。「オンライン」に変わると、変更は1件ずつサーバーに送られます。",
                  width: 1600,
                  height: 540,
                  caption: "接続のないまま書いたメモは、すぐに保存され、あとで同期されます。",
                },
              },
              {
                card: {
                  file: "stack.yaml",
                  lines: [
                    ["language", "TypeScript"],
                    ["frontend", "React"],
                    ["storage", "IndexedDB"],
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        id: "skills",
        title: "スキル",
        messages: [
          {
            q: `${ja.first}の得意な技術スタック教えて`,
            a: [
              "フロントエンドからバックエンドまでTypeScriptで、速くて使いやすいインターフェースが得意です。",
              {
                card: {
                  file: "skills.yaml",
                  lines: [
                    ["languages", "TypeScript, JavaScript, HTML, CSS"],
                    ["frontend", ["React, Next.js, Tailwind CSS,", "Vite, Playwright"]],
                    ["backend", "Node.js, PostgreSQL, GraphQL"],
                    ["tooling", "GitHub Actions, Sentry, Figma"],
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        id: "resume",
        title: "履歴書",
        messages: [
          {
            q: `${ja.first}の履歴書見せて`,
            a: ["どうぞ：", { link: { name: "履歴書", kind: "ドキュメント · PDF", href: me.resume, icon: "file" } }],
          },
        ],
      },
      {
        id: "contact",
        title: "連絡先",
        messages: [
          {
            q: `${ja.first}に連絡したいんだけど、どうすればいい？`,
            a: [
              `メールがいちばんです：[${me.email}](mailto:${me.email})`,
              `[GitHub](${me.github})と[LinkedIn](${me.linkedin})にもいます。`,
            ],
          },
        ],
      },
    ],
    questions: {
      ask: `${ja.first}の何について知りたいですか？`,
      topics: [
        {
          label: "仕事",
          hint: `${acme.company}、${globex.company}、サイドプロジェクト`,
          ask: "どの仕事・プロジェクトについて？",
          choices: [{ tab: "acme" }, { tab: "globex" }, { tab: "notes" }],
        },
        {
          label: `${ja.first}について`,
          hint: "プロフィール、スキル、履歴書",
          ask: "どれについて？",
          choices: [{ tab: "about" }, { tab: "skills" }, { tab: "resume" }],
        },
        { label: "プライベートなこと", hint: "出身地、趣味など", ask: "何が知りたいですか？", personal: true },
        { label: "連絡先", tab: "contact" },
      ],
      personal: [
        {
          id: "from",
          title: "出身",
          q: `${ja.first}ってどこ出身？`,
          hint: "出身地と、今住んでいるところ",
          a: [`シカゴ育ちで、2019年に${ja.place}へ引っ越しました。`],
        },
        {
          id: "fun",
          title: "趣味",
          q: "仕事以外は何してるの？",
          hint: "仕事以外の過ごし方",
          a: [
            [
              "🏃 毎年春にハーフマラソンを走っています。",
              "📷 フィルムカメラで街の写真を撮っています。",
              "🍜 いつも街でいちばんおいしいラーメンを探しています。",
            ],
          ],
        },
        {
          id: "coffee",
          title: "コーヒー",
          q: "コーヒーはどう飲むの？",
          hidden: true,
          a: ["ハンドドリップのブラックで、午後3時以降は飲みません。"],
        },
      ],
      ui: {
        else: "ほかの質問",
        elseLabel: "ほかの質問：自由に入力",
        send: "質問する",
        back: "戻る",
        step: "{n} / {total}",
        followUp: "続けて質問する",
      },
    },
    asked: {
      title: "ほかの質問",
      q: "別のことを聞きたいんだけど",
      answer: `その質問は、${ja.first}本人に聞くのがいちばんです。メールで送るか、LinkedInでメッセージしてください。`,
      mail: "この質問をメールで送る",
      subject: "ポートフォリオからの質問",
      email: `${ja.first}様\n\nポートフォリオを拝見し、お聞きしたいことがありご連絡しました。\n\n{question}\n\nよろしくお願いいたします。\n[お名前]`,
      linkedin: "LinkedInでメッセージ",
      message: {
        label: "LinkedInで送るメッセージ",
        text: `${ja.first}さん、こんにちは。ポートフォリオを拝見しました。\n\n{question}\n\nよろしくお願いします！`,
        copy: "メッセージをコピー",
      },
    },
    panel: {
      progress: {
        title: "経歴の歩み",
        steps: [
          { tab: "globex", title: ja.titles.globex, when: `${globex.company} · ${ja.years.globex}` },
          { tab: "acme", title: ja.titles.acme, when: `${acme.company} · ${ja.years.acme}`, now: true },
        ],
      },
      outputs: {
        title: "成果物",
        rows: [
          { label: "履歴書", meta: "PDF", icon: "file", href: me.resume },
          { label: me.project.site, meta: "Web", icon: "globe", href: me.project.href },
        ],
      },
      context: {
        title: "つながり",
        rows: [
          { label: "GitHub", meta: "リンク", icon: "github", href: me.github },
          { label: "LinkedIn", meta: "リンク", icon: "linkedin", href: me.linkedin },
          { label: "メール", meta: "リンク", icon: "contact", href: `mailto:${me.email}` },
          { label: `${ja.place} · リモート`, meta: "拠点", icon: "globe" },
        ],
      },
    },
    account: {
      initial: me.first.charAt(0),
      name: me.first,
      sub: `· ${ja.place} · リモート`,
      label: "アカウント",
      clock: {
        me: `${ja.first}（${ja.place}）`,
        zone: `${ja.place}（米国東部時間）`,
        you: "あなた",
        ahead: "あなたより{n}時間進んでいます",
        behind: "あなたより{n}時間遅れています",
        same: "あなたと同じ時間帯です",
        moods: {
          morning: "まずはコーヒーから。",
          day: "たぶんプルリクエストに没頭中。",
          evening: "たぶん誰かのプルリクをレビュー中。",
          late: "たぶん就寝中。",
        },
      },
      language: "言語",
      upgrade: { label: `${me.first} Proにアップグレード`, hire: "採用のご相談", tab: "contact" },
      logout: {
        label: "ログアウト",
        title: "またお会いしましょう。",
        text: `ご覧いただきありがとうございました。${ja.first}への連絡はこちらから：`,
        back: "もう一度ログイン",
      },
    },
    notFound: {
      title: "ページが見つかりません。",
      text: "このアドレスには何もありません。",
      back: "日本語のポートフォリオへ",
    },
    strings: {
      skip: "コンテンツへスキップ",
      tabs: "タブ",
      hideTabs: "タブを隠す",
      closeTabs: "タブを閉じる",
      showTabs: "タブを表示",
      panelToggle: "詳細パネルの表示・非表示",
      panelToggleTitle: "詳細",
      credit: "デザインはClaudeアプリを参考にしています。Anthropicとは関係ありません。",
      share: "共有",
      copyTab: "このタブのリンクをコピー",
      copyTitle: "リンクをコピー",
      question: "質問：",
      followUpPlaceholder: "続けて質問する…",
      model: "ポートフォリオ",
      status: "{file}を読み込みました",
      panel: "詳細",
      closePanel: "詳細パネルを閉じる",
      closePanelTitle: "閉じる",
      copied: "コピーしました",
      copyFailed: "コピーできませんでした",
      menuCopy: "リンクをコピー",
      menuOptions: "スレッドのメニュー",
      menuRename: "名前を変更",
      menuFollowUp: "続けて質問する",
      menuJump: "質問へ移動",
      menuMore: "その他の操作",
      menuDelete: "削除",
      thinking: "考え中…",
      thinkingWords: "考え中|思案中|検討中|模索中|整理中|試行錯誤中",
      chats: "チャット",
      chatDeleted: "チャットを削除しました",
      newChat: "新しいチャット",
      moveSection: "{name}を移動",
      resize: "タブの幅を変更",
      viewerOpen: "新しいタブで開く",
      viewerClose: "閉じる",
      play: "再生",
      pause: "一時停止",
      askFrom: "「{tab}」タブより",
      askFromPersonal: "「{tab}」より",
      askRemoved: "質問は削除されました",
      askLimited: `今日の質問はここまでです。無料のサービスで動いているため、1日{limit}問までになっています。${ja.first}のことはタブからすべてご覧いただけます。連絡方法は[連絡先](#contact)をどうぞ。`,
      askLeft: "お知らせ：無料のサービスで動いているため、質問は1日の上限があります。今日はあと{n}問です。",
    },
  };
}
