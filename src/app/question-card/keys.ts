/* What a key pressed in the question card does, outside its box. */

export type CardKeyAction =
  /** Typing goes into "Ask your own question", as it would into a composer,
      instead of being lost on the choice that has focus. */
  | { kind: "type"; character: string }
  /** A choice's number picks it. */
  | { kind: "pick"; choiceNumber: number }
  /** From a topic's tabs, back to the topics. */
  | { kind: "back" }
  | { kind: "moveFocus"; by: 1 | -1 };

const CHOICE_NUMBER = /^[1-9]$/;

/** A key that types has a name one character long ("Enter" is longer). The
    space isn't typed: it presses the choice that has focus, as it does any
    button. */
const typesACharacter = (key: string): boolean => key.length === 1 && key !== " ";

/** Null for a key the card leaves alone. */
export function actionForKey(key: string, isListingATopicsTabs: boolean): CardKeyAction | null {
  if (CHOICE_NUMBER.test(key)) return { kind: "pick", choiceNumber: Number(key) };
  if (typesACharacter(key)) return { kind: "type", character: key };
  if (key === "ArrowLeft" && isListingATopicsTabs) return { kind: "back" };
  if (key === "ArrowDown") return { kind: "moveFocus", by: 1 };
  if (key === "ArrowUp") return { kind: "moveFocus", by: -1 };
  return null;
}
