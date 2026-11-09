// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { htmlToText } from "./html-to-text.js";
import { asciify, cut, columns, wrap } from "./text.js";
import { createPager } from "./pager.js";

function root(html) {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

function fixture(name) {
  return root(readFileSync(join(process.cwd(), "desk-src/terminal/__fixtures__", `${name}.html`), "utf8"));
}

describe("htmlToText", () => {
  it("upper-cases headings and underlines them", () => {
    const t = htmlToText(root("<h3>Hello there</h3><h4>Sub</h4>"));
    expect(t).toBe("HELLO THERE\n-----------\n\nSUB\n---");
  });

  it("wraps paragraphs at the column count", () => {
    const text = "word ".repeat(40);
    for (const cols of [80, 40]) {
      const lines = htmlToText(root(`<p>${text}</p>`), { cols }).split("\n");
      expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(cols);
      expect(lines.length).toBeGreaterThan(1);
    }
  });

  it("indents code and cuts long lines with a > marker", () => {
    const t = htmlToText(root(`<pre>short\n${"x".repeat(100)}</pre>`), { cols: 40 }).split("\n");
    expect(t[0]).toBe("  short");
    expect(t[1].length).toBe(40);
    expect(t[1].endsWith(">")).toBe(true);
  });

  it("keeps bullets and numbers with hanging indents", () => {
    const t = htmlToText(root("<ul><li>one</li><li>two words here</li></ul><ol><li>first</li></ol>"), { cols: 12 });
    expect(t).toBe("* one\n* two words\n  here\n\n1. first");
  });

  it("prints links as numbered footnotes and reuses numbers", () => {
    const t = htmlToText(root('<p><a href="/a">A</a> and <a href="/a">again</a> and <a href="http://x.io/">X</a></p>'), {
      base: "https://site.test/post.html",
    });
    expect(t).toContain("A [1] and again [1] and X [2]");
    expect(t).toContain("[1] https://site.test/a");
    expect(t).toContain("[2] http://x.io/");
  });

  it("prints images and embeds as [image: alt]", () => {
    const t = htmlToText(root('<p>see <img src="a.png" alt="a diagram"> and <iframe title="video"></iframe></p>'));
    expect(t).toContain("[image: a diagram]");
    expect(t).toContain("[image: video]");
  });

  it("replaces characters the font cannot draw", () => {
    expect(htmlToText(root("<p>It’s “fine” — 中</p>"))).toBe("It's \"fine\" - ?");
  });

  it.each(["golang-context", "mux-metrics", "html-safe"])("converts the real post %s at 80 and 40 columns", (name) => {
    for (const cols of [80, 40]) {
      const text = htmlToText(fixture(name), { cols, base: "https://hlcfan.github.io/x.html" });
      const lines = text.split("\n");
      expect(text.length).toBeGreaterThan(500);
      expect(Math.max(...lines.map((l) => l.length))).toBeLessThanOrEqual(cols);
      expect(text).not.toMatch(/<[a-z]+[^>]*>/);
      expect(text).not.toMatch(/\n{3,}/);
    }
  });
});

describe("text helpers", () => {
  it("wraps, splits long words, cuts and formats columns", () => {
    expect(wrap("aaa bbb ccc", 7)).toEqual(["aaa bbb", "ccc"]);
    expect(wrap("abcdefghij", 4)).toEqual(["abcd", "efgh", "ij"]);
    expect(cut("abcdefgh", 5)).toBe("abcd~");
    expect(cut("abc", 5)).toBe("abc");
    expect(columns(["a", "b", "c"], 6)).toBe("a  b\nc");
    expect(asciify("…")).toBe("...");
  });
});

describe("pager", () => {
  const text = Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n");

  it("pages, scrolls and exits", () => {
    let exited = false;
    let changes = 0;
    const p = createPager(text, { title: "f", onExit: () => (exited = true), onChange: () => changes++ });
    expect(p.render(40, 11)[0].t).toBe("line 0");
    p.key(" ");
    expect(p.render(40, 11)[0].t).toBe("line 10");
    p.key("j");
    expect(p.render(40, 11)[0].t).toBe("line 11");
    p.key("b");
    p.key("k");
    p.key("G");
    expect(p.render(40, 11)[0].t).toBe("line 20");
    expect(p.render(40, 11).at(-1).t).toContain("(END)");
    p.key("g");
    expect(p.render(40, 11)[0].t).toBe("line 0");
    expect(changes).toBeGreaterThan(3);
    p.key("q");
    expect(exited).toBe(true);
  });

  it("marks lines past the end with ~", () => {
    const p = createPager("a\nb", {});
    const rows = p.render(20, 5);
    expect(rows.map((r) => r.t).slice(0, 3)).toEqual(["a", "b", "~"]);
  });
});
