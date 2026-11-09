import { test, expect } from "@playwright/test";

test("desk page loads the scene on desktop Chromium", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await expect(page.locator("#desk-canvas")).toBeVisible();
});

test("without WebGL2 the plain list stays visible", async ({ page }) => {
  await page.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return type === "webgl2" ? null : orig.call(this, type, ...rest);
    };
  });
  await page.goto("/");
  await expect(page.locator("html.scene-on")).toHaveCount(0);
  await expect(page.locator(".post-list a").first()).toBeVisible();
});

// Rain, dust and camera sway run for 10 s after load or input (ACTIVE_WINDOW_MS), then the scene goes quiet.
const QUIET_MS = 11000;

test("existing URLs still resolve", async ({ request }) => {
  for (const url of ["/about/", "/domains/", "/category/tech.html", "/feed.xml", "/assets/main.css"]) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
  }
});

test("an idle scene renders no frames once the ambient window has passed", async ({ page }) => {
  await page.addInitScript(() => {
    window.__raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { window.__raf++; return orig(cb); };
  });
  // Not open(): that helper waits through the ambient window, and its own rAF calls would be counted.
  await page.goto("/");
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  const early = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => window.__raf), "ambient life right after load").toBeGreaterThan(early);
  await page.waitForTimeout(QUIET_MS);
  const before = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => window.__raf)).toBe(before);
});

test("scene survives context loss when the context is restored", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.evaluate(() => {
    const gl = document.getElementById("desk-canvas").getContext("webgl2");
    const ext = gl.getExtension("WEBGL_lose_context");
    ext.loseContext();
    setTimeout(() => ext.restoreContext(), 500);
  });
  await page.waitForTimeout(4000);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
});

test("scene falls back to the plain list when the context is not restored", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.evaluate(() => {
    document.getElementById("desk-canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext();
  });
  await expect(page.locator("html.list-open")).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator("html.scene-on")).toHaveCount(0);
});

test("dragging wakes the render loop", async ({ page }) => {
  await page.addInitScript(() => {
    window.__raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { window.__raf++; return orig(cb); };
  });
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.waitForTimeout(QUIET_MS);
  const idle = await page.evaluate(() => window.__raf);
  await page.mouse.move(640, 300);
  await page.mouse.down();
  await page.mouse.move(400, 260, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__raf)).toBeGreaterThan(idle);
});

// ---- M2 and M3: terminal, power, focus --------------------------------------

// The first frames compile shaders. On a software renderer that freezes the page for seconds, and
// the freeze delays every timer. Tests that time the boot or the animations start after it.
async function open(page, url = "/") {
  await page.goto(url);
  await page.locator("html.scene-on").waitFor({ timeout: 60000 });
  await page.locator("html[data-bake]").waitFor({ state: "attached", timeout: 60000 });
  await page.evaluate(() => new Promise((resolve) => {
    let last = performance.now();
    let calm = 0;
    const tick = () => {
      const now = performance.now();
      calm = now - last < 100 ? calm + 1 : 0;
      last = now;
      if (calm >= 10) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
}

const state = (page) => page.evaluate(() => document.documentElement.dataset.deskState);
const layoutOf = (page) => page.evaluate(() => document.documentElement.dataset.deskLayout);
const fast = (page) => page.addInitScript(() => localStorage.setItem("desk.booted", "1"));

async function powerOn(page) {
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.locator("#desk-power").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => state(page), { timeout: 25000 }).toBe("READY");
}

async function run(page, line) {
  await page.locator("#desk-input").focus();
  await page.keyboard.type(line);
  await page.keyboard.press("Enter");
}

test("desktop: power on, type ls posts/, see a post in the live region", async ({ page }) => {
  await fast(page);
  await powerOn(page);
  await run(page, "ls posts/");
  await expect(page.locator("[role=log]")).toContainText("golang-context.md");
  await expect(page.locator("[role=log]")).toContainText("System ready");
  expect(await layoutOf(page)).toBe("wide");
});

test("cold boot walks POWERING, POST, BOOTING, READY", async ({ page }) => {
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  expect(await state(page)).toBe("OFF");
  await page.locator("#desk-power").focus();
  await page.keyboard.press("Enter");
  const seen = new Set();
  await expect
    .poll(async () => { seen.add(await state(page)); return await state(page); }, { timeout: 12000, intervals: [50] })
    .toBe("READY");
  expect(seen.has("POWERING")).toBe(true);
});

test("a click during the boot skips to READY, but the power button halts", async ({ page }) => {
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.locator("#desk-power").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => state(page)).toBe("POWERING");
  await page.mouse.click(100, 100);
  await expect.poll(() => state(page), { timeout: 3000 }).toBe("READY");
  await page.locator("#desk-power").focus();
  await page.keyboard.press("Enter");
  await expect.poll(() => state(page)).toMatch(/HALTING|OFF/);
  await expect.poll(() => state(page), { timeout: 3000 }).toBe("OFF");
});

test("a held key does not skip the boot it started", async ({ page }) => {
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.locator("#desk-power").focus();
  await page.keyboard.down("Enter");
  await page.keyboard.down("Enter"); // auto-repeat
  await page.keyboard.up("Enter");
  expect(await state(page)).toBe("POWERING");
});

test("iPhone 13: 40 column layout, zoomed in, no horizontal scroll", async ({ browser, playwright }) => {
  const ctx = await browser.newContext({ ...playwright.devices["iPhone 13"] });
  const page = await ctx.newPage();
  await fast(page);
  await powerOn(page);
  expect(await layoutOf(page)).toBe("narrow");
  await run(page, "ls posts/");
  await expect(page.locator("[role=log]")).toContainText("golang-context");
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  expect(w[0]).toBeLessThanOrEqual(w[1]);
  await ctx.close();
});

test("reduced motion goes straight to READY", async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.locator("#desk-power").focus();
  const t0 = Date.now();
  await page.keyboard.press("Enter");
  await expect.poll(() => state(page), { timeout: 500 }).toBe("READY");
  expect(Date.now() - t0).toBeLessThan(500);
  await ctx.close();
});

test("keyboard only: Tab order, Enter powers on, Esc moves focus to mute, machine stays READY", async ({ page }) => {
  await fast(page);
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(page.locator("#skip-link")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#desk-power")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => state(page), { timeout: 25000 }).toBe("READY");
  await page.keyboard.press("Tab");
  await expect(page.locator("#desk-input")).toBeFocused();
  await page.keyboard.type("echo hello | wc -l");
  await page.keyboard.press("Enter");
  await expect(page.locator("[role=log]")).toContainText("1");
  await page.keyboard.press("Escape");
  await expect(page.locator("#desk-mute")).toBeFocused();
  expect(await state(page)).toBe("READY");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.locator("#desk-mute")).toBeFocused();
});

test("shutdown and reboot run through HALTING", async ({ page }) => {
  await fast(page);
  await powerOn(page);
  await run(page, "reboot");
  await expect.poll(() => state(page), { timeout: 4000 }).toMatch(/HALTING|OFF|POWERING/);
  await expect.poll(() => state(page), { timeout: 25000 }).toBe("READY");
  await run(page, "shutdown");
  await expect.poll(() => state(page), { timeout: 4000 }).toBe("OFF");
});

test("#cat=slug powers on by itself and prints the post", async ({ page }) => {
  await fast(page);
  await page.goto("/#cat=golang-context");
  await expect.poll(() => state(page), { timeout: 25000 }).toBe("READY");
  await expect(page.locator("[role=log]")).toContainText("context", { timeout: 25000, ignoreCase: true });
});

test("exit opens the plain list and the back button returns", async ({ page }) => {
  await fast(page);
  await powerOn(page);
  await run(page, "exit");
  await expect(page.locator("html.list-open")).toHaveCount(1);
  await expect(page.locator(".post-list a").first()).toBeVisible();
  await page.locator("#list-close").click();
  await expect(page.locator("html.list-open")).toHaveCount(0);
});

test("skip link shows the plain list", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.locator("#skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("html.list-open")).toHaveCount(1);
  await expect(page.locator(".post-list a").first()).toBeVisible();
});

test("grep -i searches the index through the terminal", async ({ page }) => {
  await fast(page);
  await powerOn(page);
  await run(page, "grep -i goroutine posts | head -n 2");
  await expect(page.locator("[role=log]")).toContainText(".md:", { timeout: 25000 });
});

// ---- M6: props ---------------------------------------------------------------

async function clickPart(page, name) {
  const p = await page.evaluate((n) => window.__deskTest.point(n), name);
  await page.mouse.click(p.x, p.y);
}

test("lamp toggles, the floppy goes to GitHub", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("desk.test", "1"));
  await page.route("https://github.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>gh</title>" }));
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.waitForFunction(() => !!window.__deskTest);

  // The bake decides the first lamp state: on with lightmaps, off without. Wait for it, then flip twice.
  await page.waitForSelector("html[data-bake]");
  const first = await page.evaluate(() => document.documentElement.dataset.lamp ?? "off");
  const flipped = first === "on" ? "off" : "on";
  await clickPart(page, "lamp");
  await expect(page.locator(`html[data-lamp=${flipped}]`)).toHaveCount(1);
  await clickPart(page, "lamp");
  await expect(page.locator(`html[data-lamp=${first}]`)).toHaveCount(1);

  await clickPart(page, "floppy");
  await page.waitForURL("https://github.com/hlcfan", { timeout: 20000 });
});

test("props and the plain list leave the idle scene alone: no frames when nothing happens", async ({ page }) => {
  await page.addInitScript(() => {
    window.__raf = 0;
    const orig = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => { window.__raf++; return orig(cb); };
  });
  await open(page);
  await expect(page.locator("html.scene-on")).toHaveCount(1);
  await page.waitForTimeout(QUIET_MS);
  const before = await page.evaluate(() => window.__raf);
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__raf)).toBe(before);
});

test("top right nav: Posts links to /posts/, About links to the about page", async ({ page }) => {
  await open(page);
  await page.locator(".scene-on").waitFor();
  await expect(page.locator("#nav-posts")).toBeVisible();
  await expect(page.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about/");
  await expect(page.locator("#nav-posts")).toHaveAttribute("href", "/posts/");
  await page.locator("#nav-posts").click();
  await expect(page).toHaveURL(/\/posts\/$/);
  await expect(page.locator(".post-list")).toBeVisible();
});
