/* The interface's wording in English. A page in English says these
   wherever its language's `strings` leave one out, so a site in English
   states only what it changes, and a string added here later breaks no
   site. A page in any other language states every one itself. */

import type { Strings } from "./strings.ts";

export const ENGLISH_STRINGS: Required<Strings> = {
  skip: "Skip to content",
  tabs: "Tabs",
  hideTabs: "Hide tabs",
  closeTabs: "Close tabs",
  showTabs: "Show tabs",
  panelToggle: "Show or hide the details panel",
  panelToggleTitle: "Details",
  credit: "Design inspired by the Claude app. Not affiliated with Anthropic.",
  share: "Share",
  copyTab: "Copy link to this tab",
  copyTitle: "Copy link",
  question: "Question: ",
  followUpPlaceholder: "Ask a follow-up…",
  model: "Portfolio",
  status: "Read {file}",
  panel: "Details",
  closePanel: "Close the details panel",
  closePanelTitle: "Close",
  copied: "Copied",
  copyFailed: "Couldn’t copy",
  menuCopy: "Copy link",
  menuOptions: "Thread options",
  menuRename: "Rename",
  menuFollowUp: "Ask a follow-up",
  menuJump: "Jump to",
  menuMore: "More options",
  menuDelete: "Delete",
  thinking: "Thinking…",
  thinkingWords: "Thinking|Pondering|Mulling|Brewing|Tinkering|Puzzling|Wondering|Considering",
  chats: "Chats",
  chatDeleted: "Chat deleted",
  newChat: "New chat",
  moveSection: "Move {name}",
  resize: "Resize the tabs",
  askFrom: "From the {tab} tab",
  askRemoved: "Question removed",
  askLimited:
    "That’s the limit for today. Asking runs on a free service, so it’s capped at {limit} questions a day. Everything else is in the tabs.",
  askLeft: "Heads up: asking runs on a free service, so it’s capped per day: {n} left today.",
  askFromPersonal: "From “{tab}”",
  viewerOpen: "Open in a new tab",
  viewerClose: "Close",
  play: "Play",
  pause: "Pause",
};

/** Whether a language's page falls back on ENGLISH_STRINGS: "en", "en-GB". */
export const isEnglish = (languageCode: string): boolean => languageCode === "en" || languageCode.startsWith("en-");
