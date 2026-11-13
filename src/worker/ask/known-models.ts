/* The Workers AI models Ask has been run with. The day's budget
   (ASK_DAILY_NEURONS) is counted with these prices, so when Cloudflare
   changes one, change it here. */

/** The model that picks and writes, unless ASK_MODEL names another. */
export const DEFAULT_MODEL = "@cf/zai-org/glm-4.7-flash";

/** Llama Guard, which reads every question beside the picker. */
export const LLAMA_GUARD_MODEL = "@cf/meta/llama-guard-3-8b";

/** Neurons for a million tokens read (`input`), and for a million written
    (`output`): developers.cloudflare.com/workers-ai/platform/pricing. */
export type Price = { input: number; output: number };

export type KnownModel = {
  price: Price;
  /** What keeps its own reasoning short or off. The thinking a pick needs
      is in the tool call, where it's a sentence or two and the log can
      show it. */
  reasoningOptions?: Record<string, unknown>;
  /** Those options turn its reasoning off altogether. */
  reasoningIsOff?: true;
};

export const KNOWN_MODELS: ReadonlyMap<string, KnownModel> = new Map<string, KnownModel>([
  [
    DEFAULT_MODEL,
    {
      price: { input: 5_500, output: 36_400 },
      reasoningOptions: { chat_template_kwargs: { enable_thinking: false } },
      reasoningIsOff: true,
    },
  ],
  [
    "@cf/qwen/qwen3.8-27b",
    { price: { input: 40_909, output: 290_909 }, reasoningOptions: { reasoning_effort: "low" } },
  ],
  [
    "@cf/deepseek-ai/deepseek-v4.1-flash-1017",
    {
      price: { input: 27_273, output: 109_091 },
      reasoningOptions: { reasoning_effort: "none" },
      reasoningIsOff: true,
    },
  ],
  [LLAMA_GUARD_MODEL, { price: { input: 44_003, output: 2_730 } }],
]);

/** The dearest picker's, so the budget stops early rather than late for a
    model that isn't listed; ASK_MODEL_PRICE gives its own. */
export const UNLISTED_MODEL_PRICE: Price = { input: 40_909, output: 290_909 };

export const priceOf = (model: string): Price => KNOWN_MODELS.get(model)?.price ?? UNLISTED_MODEL_PRICE;

/** Nothing for a model that isn't listed: it's called without options. */
export const reasoningOptionsOf = (model: string): Record<string, unknown> =>
  KNOWN_MODELS.get(model)?.reasoningOptions ?? {};

export const hasReasoningOff = (model: string): boolean => KNOWN_MODELS.get(model)?.reasoningIsOff === true;
