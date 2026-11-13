/* The pick: a small model gets the visitor's question and every answer on
   the site (prompts/pick.ts), and calls its tool with what it makes of the
   question (its thinking, which no visitor sees), then an answer's id,
   "none" or "inappropriate", and the numbers of the lines that answer it. */
import { escapeRegExp } from "es-toolkit";
import { isString } from "../../contracts/guards.ts";
import { get } from "../lib/shape.ts";
import type { Choices } from "./answers.ts";
import { NO_TOKENS, type Tokens } from "./cost.ts";
import { hasReasoningOff, reasoningOptionsOf } from "./known-models.ts";
import { callModel, ranOutOfRoom, rawTextIn, toolCallArguments } from "./model.ts";
import { INAPPROPRIATE, PICK_TOOL_NAME, pickPrompt } from "./prompts/pick.ts";

/** The most the picker may write: its tool call, with the sentence or two
    of thinking the call starts with, and any reasoning of the model's own.
    What it writes costs several times what it reads. */
export const MAX_PICK_TOKENS = 1024;

/** The most a model told not to reason on its own may write: the call's
    thinking is a sentence or two, and the rest of it a few dozen tokens. */
export const MAX_PLAIN_PICK_TOKENS = 512;

/** How long the pick is waited for, in milliseconds. A reply is written
    after it, with a time limit of its own (write.ts), and the page gives
    up on /ask after 12 seconds: the two limits together are under that. */
export const PICK_TIMEOUT_MS = 6000;

/** The most of the picker's thinking that's kept, in characters: a log
    line is for reading, and the thinking was asked to be short. */
export const MAX_THOUGHT_LENGTH = 400;

/** What the model picked. */
export type Picked = {
  /** An answer's id, "inappropriate", or null for no pick. */
  id: string | null;
  /** With an answer's id: the numbers of the lines the model says answer
      the question, exactly as it gave them. Nothing has checked them yet.
      Named for the tool's parameter. */
  sentences?: unknown;
  /** What it thought on the way, for the log. */
  thought?: string;
  /** It ran out of room to write before it had picked. */
  ranOutOfRoom?: true;
  /** It hadn't picked when the time was up. */
  ranOutOfTime?: true;
  tokens: Tokens;
};

/** A pick_answer call, as far as it could be read. */
export type ToolCall = {
  /** The id it gave, trimmed. It may not be one that was offered. */
  id: string;
  /** The line numbers, as they came. */
  sentences: unknown;
  /** Its thinking on one line, cut to MAX_THOUGHT_LENGTH, if it gave any. */
  thought?: string;
};

/** Rejects when Workers AI can't run the model. */
export async function pick(ai: Ai, model: string, question: string, choices: Choices): Promise<Picked> {
  const offeredIds = choices.answers.map((answer) => answer.id);
  if (!offeredIds.length) return { id: null, tokens: NO_TOKENS };
  const prompt = pickPrompt(choices, question);
  const maxTokens = hasReasoningOff(model) ? MAX_PLAIN_PICK_TOKENS : MAX_PICK_TOKENS;
  const { modelReply, tokens } = await callModel(ai, model, {
    input: {
      ...prompt,
      tool_choice: { type: "function", function: { name: PICK_TOOL_NAME } },
      temperature: 0,
      max_completion_tokens: maxTokens,
      ...reasoningOptionsOf(model),
    },
    timeoutMs: PICK_TIMEOUT_MS,
    tokensIfUnreported: { prompt, maxOutputTokens: maxTokens },
  });
  if (modelReply === undefined) return { id: null, ranOutOfTime: true, tokens };
  return { ...readPick(modelReply, offeredIds), tokens };
}

// An id that wasn't offered is no pick.
function readPick(modelReply: unknown, offeredIds: readonly string[]): Omit<Picked, "tokens"> {
  const toolCall = readToolCall(modelReply);
  // Only a tool call can say "inappropriate": a word in some text shouldn't
  // block anyone.
  const id = toolCall ? toolCall.id : readTextPick(modelReply, offeredIds);
  const thought = toolCall?.thought;
  if (id === INAPPROPRIATE) return { id, thought };
  if (id === null || !offeredIds.includes(id)) {
    return { id: null, thought, ranOutOfRoom: ranOutOfRoom(modelReply) && !toolCall ? true : undefined };
  }
  return toolCall ? { id, sentences: toolCall.sentences, thought } : { id };
}

/** The first tool call that gives an id. */
export function readToolCall(modelReply: unknown): ToolCall | undefined {
  for (const sentArguments of toolCallArguments(modelReply)) {
    const id = get(sentArguments, "id");
    if (isString(id)) {
      return { id: id.trim(), sentences: get(sentArguments, "sentences"), thought: thoughtIn(sentArguments) };
    }
  }
  return undefined;
}

function thoughtIn(sentArguments: unknown): string | undefined {
  const thinking = get(sentArguments, "thinking");
  const onOneLine = isString(thinking) ? thinking.replace(/\s+/g, " ").trim() : "";
  return onOneLine ? onOneLine.slice(0, MAX_THOUGHT_LENGTH) : undefined;
}

/** For a model that wrote text instead of calling the tool: the one of
    `ids` the text names, or null for none or more than one. */
export function readTextPick(modelReply: unknown, ids: readonly string[]): string | null {
  const text = rawTextIn(modelReply);
  if (text === undefined) return null;
  const idsNamed = ids.filter((id) => namesId(text, id));
  return idsNamed.length === 1 ? (idsNamed[0] ?? null) : null;
}

// The id on its own, not inside a longer one: "about.12" doesn't name
// "about.1". Before and after it comes the text's start or end, or a
// character no id is written with.
const namesId = (text: string, id: string) => new RegExp(`(^|[^\\w.-])${escapeRegExp(id)}($|[^\\w.-])`).test(text);
