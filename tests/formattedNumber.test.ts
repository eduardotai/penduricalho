import { test } from "node:test";
import assert from "node:assert/strict";
import { numberCanToggle } from "../src/lib/formatNumber";

test("abbreviated values can toggle between short and words", () => {
  assert.equal(numberCanToggle(25_000), true);
  assert.equal(numberCanToggle(12), false);
});

test("interactive={false} or a fixed style keeps the value from becoming a button", () => {
  assert.equal(numberCanToggle(25_000, { interactive: false }), false);
  assert.equal(numberCanToggle(12_000, { interactive: false }), false);
  assert.equal(numberCanToggle(25_000, { style: "short" }), false);
  assert.equal(numberCanToggle(25_000, { style: "words" }), false);
});
