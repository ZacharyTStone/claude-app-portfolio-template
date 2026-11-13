/* Stand-ins for the models: what each says, and what it was sent. */
import assert from "node:assert/strict";
import { LLAMA_GUARD_MODEL } from "../../../src/worker/ask/known-models.ts";
import { PICK_TOOL_NAME } from "../../../src/worker/ask/prompts/pick.ts";

/** What the tests read of what a model was sent: the picker with its tool,
    the writer and the call that says a question to the owner with none. */
export type ModelInput = {
  messages: { role: string; content: string }[];
  tools?: {
    function: {
      parameters: {
        properties: {
          thinking: { type: string };
          id: { type: string; enum: string[] };
          sentences: { type: string; maxItems: number };
        };
        required: string[];
      };
    };
  }[];
  [option: string]: unknown;
};
export type Call = { model: string; input: ModelInput };
export type Run = (model: string, input: ModelInput) => unknown;

/** The picker's reply when it calls pick_answer with `id`, and the
    `sentences` and `thinking` it gave, if any. */
export const toolCall = (id: string, sentences?: unknown, thinking?: unknown) => ({
  choices: [
    {
      message: {
        tool_calls: [
          {
            type: "function",
            function: { name: PICK_TOOL_NAME, arguments: JSON.stringify({ thinking, id, sentences }) },
          },
        ],
      },
    },
  ],
});

/** A model's reply that also says what its call used, as Workers AI does. */
export const using = <Reply extends object>(reply: Reply, prompt_tokens: number, completion_tokens: number) => ({
  ...reply,
  usage: { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens },
});

/** The model's reply when it writes `text`, and nothing of what it used
    unless `tokens` says. */
export const wrote = (text: string, tokens?: [read: number, written: number]) =>
  tokens ? using({ response: text }, ...tokens) : { response: text };

/** A stand-in Workers AI: `pick` answers the picker, `guard` Llama Guard.
    An Error is thrown; a Promise is waited for. */
export const models =
  (pick: unknown, guard: unknown = { response: "safe" }): Run =>
  (model) => {
    if (model !== LLAMA_GUARD_MODEL) return pick;
    if (guard instanceof Error) throw guard;
    return guard;
  };

/** What a call for a line of text was sent. */
export type Sent = { messages: { role: string; content: string }[]; [option: string]: unknown };

/** A stand-in model for a call that writes a line of text, on its own (not
    through /ask): it says each of `replies` in turn (an Error is thrown, a
    Promise waited for), and keeps what it was sent. */
export function writer(...replies: unknown[]) {
  const sent: Sent[] = [];
  const run = async (_model: string, input: Sent) => {
    // The messages go on being added to, so each call's are kept as they were.
    sent.push({ ...input, messages: [...input.messages] });
    const reply = replies[Math.min(sent.length, replies.length) - 1];
    if (reply instanceof Error) throw reply;
    return reply;
  };
  // Only what the call uses of Workers AI is stood in for.
  return { ai: { run } as unknown as Ai, sent };
}

/** The first call to the picker, which there must have been. */
export function firstCall(calls: Call[]): Call {
  const [call] = calls;
  assert.ok(call, "the model was called");
  return call;
}
export const systemMessage = (calls: Call[]) => firstCall(calls).input.messages[0]?.content ?? "";
export const offered = (calls: Call[]) => firstCall(calls).input.tools?.[0]?.function.parameters.properties.id.enum;
export const toolParameters = (calls: Call[]) => firstCall(calls).input.tools?.[0]?.function.parameters;
