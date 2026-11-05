import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCount, formatCount } from "../lib/motion.mjs";

test("count-up keeps the display format of each kind of figure", () => {
  for (const text of [
    "1.234,50 €",
    "12,50 €",
    "1.234",
    "48",
    "45,5 %",
    "4.5x",
    "€ 1.250.000",
  ]) {
    const parsed = parseCount(text);
    assert.equal(formatCount(parsed, parsed.value), text, text);
  }
  assert.equal(parseCount("1.234,50 €").value, 1234.5);
  assert.equal(parseCount("4.5x").value, 4.5);
  assert.equal(formatCount(parseCount("1.234,50 €"), 0), "0,00 €");
  assert.equal(parseCount("Sin datos"), null);
});
