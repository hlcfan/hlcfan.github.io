import { describe, expect, it } from "vitest";
import { createTerminal, SCROLLBACK } from "./terminal.js";

function term(cols = 10, rows = 4) {
  return createTerminal({ cols, rows });
}

describe("terminal buffer", () => {
  it("keeps at most SCROLLBACK lines", () => {
    const t = term();
    for (let i = 0; i < SCROLLBACK + 50; i++) t.print(`l${i}`);
    expect(t.lineCount).toBe(SCROLLBACK);
  });

  it("wraps long lines into visual rows and shows the tail", () => {
    const t = term(5, 3);
    t.setPrompt("$ ");
    t.print("abcdefghij");
    const f = t.frame();
    expect(f.rows.map((r) => r.t)).toEqual(["abcde", "fghij", "$  "]);
  });

  it("edits the input line and tracks the cursor", () => {
    const t = term(20, 3);
    t.setPrompt("$ ");
    t.insert("helo");
    t.left();
    t.insert("l");
    expect(t.input).toBe("hello");
    expect(t.frame().cursor).toEqual({ row: 0, col: 6 });
    t.backspace();
    t.home();
    t.del();
    expect(t.input).toBe("elo");
  });

  it("moves the cursor to the next row when the line exactly fills a row", () => {
    const t = term(6, 3);
    t.setPrompt("$ ");
    t.insert("abcd");
    expect(t.frame().cursor).toEqual({ row: 1, col: 0 });
  });

  it("submit echoes the prompt and the line, then clears input", () => {
    const t = term(20, 3);
    t.setPrompt("$ ");
    t.insert("ls");
    expect(t.submit()).toBe("ls");
    expect(t.input).toBe("");
    expect(t.frame().rows.map((r) => r.t)).toContain("$ ls");
  });

  it("scrolls back through lines and returns on new output", () => {
    const t = term(10, 3);
    for (let i = 0; i < 10; i++) t.print(`line${i}`);
    t.scrollBy(3);
    expect(t.frame().rows.at(-1).t).toBe("line7");
    expect(t.frame().cursor).toBeNull();
    t.print("new");
    expect(t.frame().rows.map((r) => r.t)).toContain("new");
  });

  it("reflows when the width changes", () => {
    const t = term(10, 4);
    t.print("0123456789");
    t.resize(5, 4);
    expect(t.frame().rows.map((r) => r.t)).toContain("56789");
  });

  it("reports printed lines to the mirror unless muted", () => {
    const seen = [];
    const t = createTerminal({ cols: 10, rows: 3, onPrint: (p) => seen.push(p) });
    t.print("a\nb");
    t.print("boot", { mirror: false });
    expect(seen).toEqual([["a", "b"]]);
  });

  it("draws a program instead of the shell", () => {
    const t = term(10, 2);
    t.setProgram({ render: () => [{ t: "x", c: "fg" }, { t: "y", c: "fg" }] });
    expect(t.frame().rows.map((r) => r.t)).toEqual(["x", "y"]);
    expect(t.frame().cursor).toBeNull();
  });
});
