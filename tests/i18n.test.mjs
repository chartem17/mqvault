import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const core = require("../.tmp-i18n-tests/core.js");
const { uk } = require("../.tmp-i18n-tests/uk.js");

function files(dir) {
  return readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? files(path) : /\.(tsx?|mjs)$/.test(name) ? [path] : []; });
}
const sources = files("src").filter(path => !path.includes(join("lib", "i18n")));
const unescape = raw => JSON.parse(`"${raw.replace(/\\'/g, "'").replace(/"/g, '\\"').replace(/\\\\"/g, '\\"')}"`);
const STRING = String.raw`"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|\x60((?:[^\x60\\$]|\\.)*)\x60`;
const pick = match => match.slice(1).find(value => value !== undefined);

test("plural categories follow Ukrainian rules", () => {
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25, 112].map(n => core.pluralCategory("uk", n)), ["one", "few", "many", "many", "one", "few", "many", "many"]);
  assert.equal(core.pluralCategory("en", 1), "one");
  assert.equal(core.pluralCategory("en", 0), "other");
});

test("translate falls back to English and fills placeholders", () => {
  assert.equal(core.translate(null, "Hello {name}", { name: "Ann" }), "Hello Ann");
  assert.equal(core.translate({ "Hello {name}": "Привіт, {name}" }, "Hello {name}", { name: "Ann" }), "Привіт, Ann");
  assert.equal(core.translate({}, "Missing"), "Missing");
  const dict = { "{count} trades": { one: "{count} угода", few: "{count} угоди", many: "{count} угод" } };
  assert.equal(core.translatePlural("uk", dict, 3, "{count} trade", "{count} trades"), "3 угоди");
  assert.equal(core.translatePlural("uk", dict, 11, "{count} trade", "{count} trades"), "11 угод");
  assert.equal(core.translatePlural("en", null, 1, "{count} trade", "{count} trades"), "1 trade");
});

test("every t()/msg() string has a Ukrainian translation", () => {
  const missing = new Set();
  const single = new RegExp(String.raw`\b(?:t|msg)\(\s*(?:${STRING})`, "g");
  const plural = new RegExp(String.raw`\btn\([^,()]*(?:\([^()]*\))?[^,()]*,\s*(?:${STRING})\s*,\s*(?:${STRING})`, "g");
  for (const path of sources) {
    const text = readFileSync(path, "utf8");
    for (const match of text.matchAll(single)) { const key = unescape(pick(match)); if (!(key in uk)) missing.add(`${path}: ${key}`); }
    for (const match of text.matchAll(plural)) {
      const groups = match.slice(1), other = unescape(groups.slice(3).find(value => value !== undefined));
      const entry = uk[other];
      if (!entry || typeof entry !== "object" || !entry.one || !entry.few || !entry.many) missing.add(`${path}: plural ${other}`);
    }
  }
  assert.deepEqual([...missing], []);
});

test("no hard-coded Ukrainian text outside the dictionary", () => {
  const offenders = [];
  for (const path of sources) {
    readFileSync(path, "utf8").split("\n").forEach((line, index) => {
      const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "").replace(/^\s*\*.*$/, "");
      if (/[А-Яа-яІЇЄҐіїєґ]/.test(code)) offenders.push(`${path}:${index + 1}`);
    });
  }
  assert.deepEqual(offenders, []);
});
