import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { csvCell, tradesCsv, CSV_COLUMNS } = require("../.tmp-trades-csv-tests/lib/journal/trades-csv.js");

test("cells: quoting, empty values and spreadsheet formulas", () => {
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(1.5), "1.5");
  assert.equal(csvCell(-12.4), "-12.4", "negative numbers stay numbers");
  assert.equal(csvCell('He said "go", then left'), '"He said ""go"", then left"');
  assert.equal(csvCell("line1\nline2"), '"line1\nline2"');
  assert.equal(csvCell("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell("+cmd"), "'+cmd");
  assert.equal(csvCell("@sum"), "'@sum");
});

test("rows use the account name and the fixed column order", () => {
  const csv = tradesCsv([{ id: "t1", account_id: "a1", symbol: "EURUSD", net_pnl: 10 }], new Map([["a1", "Prop, phase 1"]]));
  const [header, row] = csv.trimEnd().split("\r\n");
  assert.equal(header, CSV_COLUMNS.join(","));
  assert.ok(row.startsWith('t1,"Prop, phase 1",EURUSD,'));
  assert.equal(row.split(",").length, CSV_COLUMNS.length + 1, "one extra comma inside the quoted account name");
});
