import { describe, expect, it } from "vitest";
import { createFs, HOME } from "./fs.js";
import { commands } from "./commands/index.js";
import { createShell, parse } from "./shell.js";

describe("parse", () => {
  it("splits words and keeps quoted text together", () => {
    expect(parse(`grep -i "hello world" posts`).segments[0]).toEqual({ cmd: "grep", args: ["-i", "hello world", "posts"] });
    expect(parse(`echo 'a  b' c\\ d`).segments[0].args).toEqual(["a  b", "c d"]);
  });

  it("handles empty input and empty quotes", () => {
    expect(parse("   ").segments).toEqual([]);
    expect(parse(`echo ""`).segments[0].args).toEqual([""]);
  });

  it("parses one pipe into grep, head, tail or wc", () => {
    const p = parse("ls posts | grep go");
    expect(p.segments.map((s) => s.cmd)).toEqual(["ls", "grep"]);
  });

  it("rejects bad pipes and unterminated quotes", () => {
    expect(parse("ls |").error).toBeTruthy();
    expect(parse("| ls").error).toBeTruthy();
    expect(parse("ls | cat").error).toMatch(/pipe target/);
    expect(parse("ls | grep a | wc -l").error).toMatch(/one pipe/);
    expect(parse('echo "oops').error).toMatch(/quote/);
  });
});

function setup() {
  const posts = [
    { slug: "golang-context", date: "2020-06-21", title: "Context", url: "/golang-context.html" },
    { slug: "golang-mux", date: "2020-07-01", title: "Mux", url: "/golang-mux.html" },
    { slug: "html-safe", date: "2014-01-02", title: "html_safe", url: "/html-safe.html" },
  ];
  let cwd = HOME;
  const fs = createFs({ posts });
  const ctx = {
    fs, cols: () => 80, cwd: () => cwd, setCwd: (p) => (cwd = p), fileRead() {},
    commandList: () => Object.values(commands).filter((c) => c.desc),
    commandRun: (n, a) => commands[n].run(ctx, a, null),
    readPost: async (p) => ({ out: `body of ${p.slug}\nsecond line` }),
    searchIndex: async () => posts.map((p) => ({ ...p, text: `hello from ${p.slug}\nunrelated` })),
    signal: () => undefined,
    history: () => shell.history(),
  };
  const shell = createShell({ commands, ctx });
  return { shell, ctx, fs, cwd: () => cwd };
}

describe("shell dispatch", () => {
  it("runs commands and reports unknown ones", async () => {
    const { shell } = setup();
    expect((await shell.run("pwd")).out).toBe(HOME);
    expect((await shell.run("nope")).err).toMatch(/command not found/);
  });

  it("cd and ls work together with relative paths", async () => {
    const { shell, cwd } = setup();
    expect((await shell.run("cd posts")).err).toBeUndefined();
    expect(cwd()).toBe("/home/alex/posts");
    expect((await shell.run("ls")).out.split("\n")).toHaveLength(3);
    expect((await shell.run("cd ..")).err).toBeUndefined();
    expect((await shell.run("cd missing")).err).toMatch(/No such file/);
    expect((await shell.run("cd about.txt")).err).toMatch(/Not a directory/);
  });

  it("cat reads a post through the context", async () => {
    const { shell } = setup();
    expect((await shell.run("cat posts/2014-01-02-html-safe.md")).out).toContain("body of html-safe");
    expect((await shell.run("cat posts/missing.md")).err).toMatch(/No such file/);
  });

  it("pipes into grep, head, tail and wc", async () => {
    const { shell } = setup();
    expect((await shell.run("ls posts | grep golang | wc -l")).err).toMatch(/one pipe/);
    expect((await shell.run("ls posts | grep golang")).out.split("\n")).toHaveLength(2);
    expect((await shell.run("ls posts | head -n 1")).out.split("\n")).toHaveLength(1);
    expect((await shell.run("ls posts | tail -1")).out).toContain("golang-mux");
    expect((await shell.run("ls posts | wc -l")).out).toBe("3");
  });

  it("grep searches the index and ignores case with -i", async () => {
    const { shell } = setup();
    const r = await shell.run("grep -i HELLO posts");
    expect(r.out.split("\n")).toHaveLength(3);
    expect(r.out).toContain("2014-01-02-html-safe.md:hello from html-safe");
    expect((await shell.run("grep HELLO posts")).out).toBe("");
  });

  it("falls back to a literal match for a bad regex", async () => {
    const { shell } = setup();
    expect((await shell.run("echo a(b | grep (")).out).toBe("a(b");
  });

  it("records history without repeats and recalls it", async () => {
    const { shell } = setup();
    await shell.run("pwd");
    await shell.run("pwd");
    await shell.run("date");
    expect(shell.history()).toEqual(["pwd", "date"]);
    expect(shell.recallPrev("")).toBe("date");
    expect(shell.recallPrev("")).toBe("pwd");
    expect(shell.recallNext()).toBe("date");
    expect(shell.recallNext()).toBe("");
  });
});

describe("completion", () => {
  it("completes command names and lists ambiguous ones", () => {
    const { shell } = setup();
    expect(shell.complete("unam").line).toBe("uname ");
    const r = shell.complete("c");
    expect(r.candidates).toEqual(expect.arrayContaining(["cat", "cd", "clear", "crt"]));
    expect(r.line).toBe("c");
  });

  it("completes paths, including nested ones and the full long post name", () => {
    const { shell } = setup();
    expect(shell.complete("cat po").line).toBe("cat posts/");
    expect(shell.complete("cat posts/2014").line).toBe("cat posts/2014-01-02-html-safe.md ");
    expect(shell.complete("cat posts/2020-0").line).toBe("cat posts/2020-0");
    expect(shell.complete("cat posts/2020-0").candidates).toHaveLength(2);
  });

  it("completes after a pipe as a command", () => {
    const { shell } = setup();
    expect(shell.complete("ls | hea").line).toBe("ls | head ");
  });

  it("shows dotfiles only when the prefix starts with a dot", () => {
    const { shell } = setup();
    expect(shell.complete("cat .p").line).toBe("cat .plan ");
    expect(shell.complete("cat ab").line).toBe("cat about.txt ");
  });
});
