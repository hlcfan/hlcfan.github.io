// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { createContent } from "./content.js";

function fakeFetch(map) {
  return vi.fn(async (url) => {
    const hit = map[url];
    if (hit === undefined) return { ok: false, status: 404 };
    return { ok: true, status: 200, text: async () => hit, json: async () => JSON.parse(hit) };
  });
}

const post = { slug: "a", title: "A “Title”", date: "2020-01-02", url: "/a.html" };

describe("content", () => {
  it("loads posts.json once and caches it", async () => {
    const f = fakeFetch({ "/posts.json": "[1]" });
    const c = createContent({ fetchFn: f, origin: "https://x.test/" });
    expect(await c.loadPosts()).toEqual([1]);
    expect(await c.loadPosts()).toEqual([1]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("retries after a failed load", async () => {
    const f = fakeFetch({});
    const c = createContent({ fetchFn: f, origin: "https://x.test/" });
    await expect(c.loadPosts()).rejects.toThrow();
    await expect(c.loadPosts()).rejects.toThrow();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("converts a post page and adds a title, date and footnotes", async () => {
    const html = '<html><body><div class="post-content"><p>Hello <a href="/b.html">there</a></p></div></body></html>';
    const c = createContent({ fetchFn: fakeFetch({ "/a.html": html }), origin: "https://x.test/" });
    const r = await c.readPost(post, 40);
    expect(r.out.split("\n").slice(0, 3)).toEqual(['A "TITLE"', "=========", "2020-01-02"]);
    expect(r.out).toContain("Hello there [1]");
    expect(r.out).toContain("[1] https://x.test/b.html");
    expect(r.label).toBe(post.title);
  });

  it("reports a missing body or a failed fetch with the URL", async () => {
    const c = createContent({ fetchFn: fakeFetch({ "/a.html": "<html><body>nothing</body></html>" }), origin: "https://x.test/" });
    expect((await c.readPost(post, 40)).err).toMatch(/no post body found. Open \/a.html/);
    expect((await c.readPost({ ...post, url: "/gone.html" }, 40)).err).toMatch(/404/);
  });

  it("caches the page but re-wraps for a new width", async () => {
    const html = `<div class="post-content"><p>${"word ".repeat(30)}</p></div>`;
    const f = fakeFetch({ "/a.html": html });
    const c = createContent({ fetchFn: f, origin: "https://x.test/" });
    const wide = await c.readPost(post, 80);
    const narrow = await c.readPost(post, 40);
    expect(f).toHaveBeenCalledTimes(1);
    expect(narrow.out.split("\n").length).toBeGreaterThan(wide.out.split("\n").length);
  });
});
