import { describe, expect, it } from "vitest";
import { createFs, HOME } from "./fs.js";

const posts = [
  { slug: "golang-context", date: "2020-06-21", title: "Context", url: "/golang-context.html" },
  { slug: "html-safe", date: "2014-01-02", title: "html_safe", url: "/html-safe.html" },
];

describe("virtual file system", () => {
  const fs = createFs({ posts });

  it("resolves relative, absolute, home and .. paths", () => {
    expect(fs.resolve(HOME, "posts")).toBe("/home/alex/posts");
    expect(fs.resolve(HOME, "../..")).toBe("/");
    expect(fs.resolve("/", "..")).toBe("/");
    expect(fs.resolve("/tmp", "~/links")).toBe("/home/alex/links");
    expect(fs.resolve("/tmp", "/home//alex/./about.txt")).toBe("/home/alex/about.txt");
  });

  it("lists posts as date-slug.md and hides dotfiles by default", () => {
    expect(fs.list("/home/alex/posts").map((e) => e.name)).toEqual([
      "2014-01-02-html-safe.md",
      "2020-06-21-golang-context.md",
    ]);
    expect(fs.list(HOME).map((e) => e.name)).not.toContain(".plan");
    expect(fs.list(HOME, { all: true }).map((e) => e.name)).toContain(".plan");
  });

  it("returns null for missing paths and files", () => {
    expect(fs.stat("/nope")).toBeNull();
    expect(fs.list("/home/alex/about.txt")).toBeNull();
    expect(fs.isDir("/home/alex/posts")).toBe(true);
  });

  it("maps a post file back to its post", () => {
    expect(fs.postFor("/home/alex/posts/2014-01-02-html-safe.md").slug).toBe("html-safe");
  });

  it("cuts long names in the tree", () => {
    const lines = fs.tree(HOME, 20).split("\n");
    expect(lines.every((l) => l.length <= 20)).toBe(true);
    expect(lines.some((l) => l.endsWith("~"))).toBe(true);
  });
});
