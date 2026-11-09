// Prints gzipped sizes and exits 1 if the loader or scene chunk is over budget.
import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

const dir = "assets/js/desk";
const budgets = { loader: 5 * 1024, scene: 200 * 1024 };
const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
let failed = false;

for (const f of files) {
  const kind = f === "main.js" ? "loader" : "scene";
  const size = gzipSync(readFileSync(`${dir}/${f}`)).length;
  const over = size > budgets[kind];
  failed ||= over;
  console.log(`${over ? "FAIL" : "ok  "} ${f} ${(size / 1024).toFixed(1)} KB gz (budget ${budgets[kind] / 1024} KB, ${kind})`);
}
process.exit(failed ? 1 : 0);
