import { describe, expect, it } from "vitest";
import { createTerminal } from "./terminal/terminal.js";
import { createSession } from "./terminal/session.js";

const posts = [
  { slug: "golang-context", date: "2020-06-21", title: "Context", url: "/golang-context.html" },
  { slug: "html-safe", date: "2014-01-02", title: "html_safe", url: "/html-safe.html" },
];

function setup(hostOver = {}) {
  const mirrored = [];
  const calls = [];
  const term = createTerminal({ cols: 80, rows: 10, onPrint: (l, label) => mirrored.push({ l, label }) });
  const host = {
    fileRead: () => calls.push("fileRead"),
    readPost: async (p) => ({ out: Array.from({ length: 30 }, (_, i) => `${p.slug} line ${i}`).join("\n"), label: p.title }),
    searchIndex: async () => [],
    navigate: (u) => calls.push(["navigate", u]),
    exitToList: () => calls.push("exit"),
    feedUrl: () => "/feed.xml",
    theme: (n) => n === "amber",
    crt: (on) => calls.push(["crt", on]),
    mute: (on) => calls.push(["mute", on]),
    reboot: () => calls.push("reboot"),
    halt: () => calls.push("halt"),
    panic: () => calls.push("panic"),
    ...hostOver,
  };
  const s = createSession({ term, host });
  s.setPosts(posts);
  s.reset();
  const type = async (line) => {
    s.onText(line);
    s.onKey({ key: "Enter" });
    await new Promise((r) => setTimeout(r, 0));
  };
  const screen = () => term.frame().rows.map((r) => r.t).join("\n");
  return { s, term, type, screen, mirrored, calls };
}

describe("session", () => {
  it("shows a banner and the prompt, and does not mirror the banner", () => {
    const { screen, mirrored } = setup();
    expect(screen()).toContain("Welcome to desk");
    expect(screen()).toContain("alex@desk:~$");
    expect(mirrored).toEqual([]);
  });

  it("runs ls and mirrors the output but not the echoed command", async () => {
    const { type, mirrored, screen } = setup();
    await type("ls posts/");
    expect(screen()).toContain("alex@desk:~$ ls posts/");
    expect(screen()).toContain("2020-06-21-golang-context.md");
    expect(mirrored).toHaveLength(1);
    expect(mirrored[0].l.join("\n")).toContain("2014-01-02-html-safe.md");
  });

  it("prints errors in the error color", async () => {
    const { type, term } = setup();
    await type("nope");
    expect(term.frame().rows.some((r) => r.c === "err" && /command not found/.test(r.t))).toBe(true);
  });

  it("cat labels a long block with the post title", async () => {
    const { type, mirrored } = setup();
    await type("cat posts/2020-06-21-golang-context.md");
    expect(mirrored.at(-1).label).toBe("Context");
  });

  it("updates the prompt on cd", async () => {
    const { type, screen } = setup();
    await type("cd posts");
    expect(screen()).toContain("alex@desk:~/posts$");
  });

  it("drives the host for theme, crt, mute, reboot, shutdown, exit and open", async () => {
    const { type, calls, screen } = setup();
    await type("theme amber");
    await type("theme nope");
    expect(screen()).toContain("usage: theme");
    await type("crt off");
    await type("mute");
    await type("reboot");
    await type("shutdown");
    await type("exit");
    await type("open posts/2014-01-02-html-safe.md");
    expect(calls).toEqual([["crt", false], ["mute", true], "reboot", "halt", "exit", ["navigate", "/html-safe.html"]]);
  });

  it("rm -rf / panics and reboots through the host", async () => {
    const { type, calls, term } = setup();
    await type("rm -rf /");
    expect(calls).toContain("panic");
    expect(term.frame().rows.some((r) => /Kernel panic/.test(r.t))).toBe(true);
  });

  it("Tab completes, and a double Tab lists candidates", async () => {
    const { s, term, screen } = setup();
    s.onText("unam");
    s.onKey({ key: "Tab" });
    expect(term.input).toBe("uname ");
    term.setInput("c");
    s.onKey({ key: "Tab" });
    expect(screen()).not.toContain("clear");
    s.onKey({ key: "Tab" });
    expect(screen()).toContain("clear");
  });

  it("walks history with the arrow keys", async () => {
    const { s, type, term } = setup();
    await type("pwd");
    await type("date");
    s.onKey({ key: "ArrowUp" });
    expect(term.input).toBe("date");
    s.onKey({ key: "ArrowUp" });
    expect(term.input).toBe("pwd");
    s.onKey({ key: "ArrowDown" });
    s.onKey({ key: "ArrowDown" });
    expect(term.input).toBe("");
  });

  it("Ctrl+C cancels a running fetch and prints ^C", async () => {
    let aborted = false;
    const { s, term, screen } = setup({
      readPost: (p, cols, signal) => new Promise((_, rej) => signal.addEventListener("abort", () => { aborted = true; rej(new Error("x")); })),
    });
    s.onText("cat posts/2014-01-02-html-safe.md");
    s.onKey({ key: "Enter" });
    expect(s.busy).toBe(true);
    s.onKey({ key: "c", ctrl: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(aborted).toBe(true);
    expect(s.busy).toBe(false);
    expect(screen()).toContain("^C");
    s.onText("pwd");
    expect(term.input).toBe("pwd");
  });

  it("Ctrl+L clears and Ctrl+C on an idle line echoes ^C", () => {
    const { s, term, screen } = setup();
    s.onKey({ key: "l", ctrl: true });
    expect(screen()).not.toContain("Welcome");
    s.onText("abc");
    s.onKey({ key: "c", ctrl: true });
    expect(screen()).toContain("alex@desk:~$ abc^C");
    expect(term.input).toBe("");
  });

  it("less opens the pager and routes keys to it until q", async () => {
    const { s, type, screen, term } = setup();
    await type("less posts/2014-01-02-html-safe.md");
    expect(term.program).not.toBeNull();
    expect(screen()).toContain("html-safe line 0");
    s.onKey({ key: " " });
    expect(screen()).toContain("html-safe line 9");
    s.onText("typing is ignored");
    expect(term.input).toBe("");
    s.onKey({ key: "q" });
    expect(term.program).toBeNull();
    s.onText("ok");
    expect(term.input).toBe("ok");
  });
});
