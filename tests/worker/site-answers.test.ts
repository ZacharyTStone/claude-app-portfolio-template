/* The answers the build writes for Ask (src/site/plain-answers.ts), read
   as the Worker reads them: the sample site's, and this site's own. */
import assert from "node:assert/strict";
import { test } from "node:test";
import ownConfig from "../../site.config.ts";
import { isLabel, labelled } from "../../src/contracts/ask.ts";
import { plainAnswers } from "../../src/site/plain-answers.ts";
import { makeSite } from "../../src/site/site.ts";
import { neededFor, numbered, pointsBack } from "../../src/worker/ask/lines.ts";
import { quote } from "../../src/worker/ask/quote.ts";
import sampleConfig from "../sample/site.config.ts";

test("a picture's caption and a link's name are labels in Ask's answers, which Ask reads but doesn't quote", () => {
  const site = makeSite(sampleConfig);
  const workText = plainAnswers(site, "en").find((answer) => answer.id === "work.1")?.text ?? "";
  const labels = workText.split("\n").filter(isLabel);
  assert.ok(labels.includes(labelled("picture", "Sam's icon.")), workText);
  assert.ok(labels.includes(labelled("picture", "Sam's icon, as if it moved.")), workText);
  assert.ok(labels.includes(labelled("link", "The icon")), workText);
  for (const label of labels) {
    const piece = numbered(workText).find(({ text }) => text === label);
    assert.ok(piece && piece.n === undefined, `"${label}" has no number to quote it by`);
  }
});

/** Every answer on this site, in every language, with where it is: "en work.1". */
function ownAnswers(): Array<{ where: string; text: string }> {
  const site = makeSite(ownConfig);
  return site.codes.flatMap((code) =>
    plainAnswers(site, code).map(({ id, text }) => ({ where: `${code} ${id}`, text })),
  );
}

/** Asserts that a reply quoting the line numbered `n` of `text` starts at a line that doesn't point back. */
function checkQuoteStartsWell(where: string, text: string, n: number): void {
  const pieces = numbered(text);
  const pieceIndex = pieces.findIndex((piece) => piece.n === n);
  const firstNeeded = pieces[neededFor(pieces, pieceIndex)?.[0] ?? -1];
  assert.ok(
    firstNeeded && !pointsBack(firstNeeded),
    `${where}: "${pieces[pieceIndex]?.text}" would start at "${firstNeeded?.text}"`,
  );
  const reply = quote(text, [n])?.reply;
  if (reply !== undefined) assert.ok(reply.startsWith(firstNeeded.text), `${where}: ${reply}`);
}

test("no reply Ask can quote from this site opens by pointing back at a line it left out", () => {
  for (const { where, text } of ownAnswers()) {
    for (const { n } of numbered(text)) {
      if (n !== undefined) checkQuoteStartsWell(where, text, n);
    }
  }
});
