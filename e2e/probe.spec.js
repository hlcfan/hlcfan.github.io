import os from "node:os";
import { test } from "@playwright/test";

test("probe: frame cost and boot timeline on this machine", async ({ page }) => {
  console.log("PROBE cpus", os.cpus().length, os.cpus()[0].model, "mem GB", Math.round(os.totalmem() / 1e9));
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(Math.round(e.duration)))).observe({ entryTypes: ["longtask"] });
    window.__frames = [];
    let last = performance.now();
    const loop = () => { const n = performance.now(); window.__frames.push(Math.round(n - last)); last = n; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  const t0 = Date.now();
  await page.goto("/");
  await page.locator("html.scene-on").waitFor({ timeout: 60000 });
  console.log("PROBE scene-on after ms", Date.now() - t0);
  console.log("PROBE renderer", await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const i = gl.getExtension("WEBGL_debug_renderer_info");
    return gl.getParameter(i.UNMASKED_RENDERER_WEBGL);
  }));
  console.log("PROBE bake", await page.evaluate(() => document.documentElement.dataset.bake));
  await page.waitForTimeout(3000);
  await page.locator("#desk-power").focus();
  await page.keyboard.press("Enter");
  const t1 = Date.now();
  let last = "";
  while (Date.now() - t1 < 40000) {
    const s = await page.evaluate(() => document.documentElement.dataset.deskState);
    if (s !== last) { console.log("PROBE state", s, "at ms", Date.now() - t1); last = s; }
    if (s === "READY") break;
    await page.waitForTimeout(100);
  }
  console.log("PROBE longtasks", JSON.stringify(await page.evaluate(() => window.__long)));
  console.log("PROBE frame gaps ms", JSON.stringify(await page.evaluate(() => window.__frames.slice(0, 80))));
});
