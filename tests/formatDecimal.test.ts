import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDecimal } from "../src/lib/formatNumber";
import { en, pt } from "../src/i18n/strings";

test("decimals use a comma in pt and a dot in en", () => {
  assert.equal(formatDecimal(5.1, "pt"), "5,1");
  assert.equal(formatDecimal(5.1, "en"), "5.1");
  assert.equal(formatDecimal(1.3, "pt"), "1,3");
  assert.equal(formatDecimal(0.4, "pt", 2), "0,40");
  assert.equal(formatDecimal(6, "pt"), "6");
});

test("the map card pulse text reads 5,1s in pt", () => {
  assert.equal(pt.customize.pulseEvery(formatDecimal(5.1, "pt")), "pulso a cada 5,1s");
  assert.equal(en.customize.pulseEvery(formatDecimal(5.1, "en")), "pulse every 5.1s");
});

test("the in-run hint is translated", () => {
  assert.notEqual(pt.controls.runHint, en.controls.runHint);
});
