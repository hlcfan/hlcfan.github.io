// Step 1 of the bake: build the scene groups in headless Chromium and write them as GLB.
import { build } from "esbuild";
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = `${root}tools/bake/out`;

await mkdir(out, { recursive: true });
const bundle = await build({
  entryPoints: [`${root}tools/bake/export-entry.js`],
  bundle: true,
  format: "iife",
  write: false,
  target: "es2020",
});

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.setContent("<!doctype html><title>bake</title>");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const { glb, meta } = await page.evaluate(() => window.exportBake());
  await writeFile(`${out}/scene.glb`, Buffer.from(glb, "base64"));
  await writeFile(`${out}/meta.json`, JSON.stringify(meta, null, 2));
  console.log(`wrote ${out}/scene.glb (${Math.round(glb.length * 0.75 / 1024)} KB)`);
} finally {
  await browser.close();
}
