// Terminal model: logical line buffer, wrapped view, input line, scrollback.
// It knows nothing about drawing. `frame()` returns rows for the screen canvas.
export const SCROLLBACK = 2000;

export function createTerminal({ cols = 80, rows = 30, onChange = () => {}, onPrint = () => {} } = {}) {
  let lines = [];
  let prompt = "$ ";
  let input = "";
  let cursor = 0;
  let scroll = 0; // visual rows scrolled up from the bottom
  let inputEnabled = true;
  let program = null; // full-screen program such as the pager

  return {
    get cols() { return cols; },
    get rows() { return rows; },
    get input() { return input; },
    get cursor() { return cursor; },
    get program() { return program; },
    get lineCount() { return lines.length; },
    resize, print, clear, setPrompt, setInputEnabled, setProgram,
    insert, backspace, del, left, right, home, end, setInput, killLine, submit,
    scrollBy, scrollToBottom, frame,
  };

  function resize(c, r) {
    cols = c;
    rows = r;
    scroll = 0;
    changed();
  }

  // Adds text as one or more lines. `mirror` and `label` go to the live region.
  function print(text, { c = "fg", mirror = true, label = "" } = {}) {
    const parts = String(text).split("\n");
    for (const t of parts) lines.push({ t, c });
    if (lines.length > SCROLLBACK) lines = lines.slice(lines.length - SCROLLBACK);
    if (mirror) onPrint(parts, label);
    scroll = 0;
    changed();
  }

  function clear() {
    lines = [];
    scroll = 0;
    changed();
  }

  function setPrompt(p) {
    prompt = p;
    changed();
  }

  function setInputEnabled(on) {
    inputEnabled = on;
    changed();
  }

  function setProgram(p) {
    program = p;
    changed();
  }

  function insert(text) {
    if (!inputEnabled) return;
    const clean = text.replace(/[\r\n]+/g, " ");
    input = input.slice(0, cursor) + clean + input.slice(cursor);
    cursor += clean.length;
    edited();
  }

  function backspace() {
    if (!inputEnabled || cursor === 0) return;
    input = input.slice(0, cursor - 1) + input.slice(cursor);
    cursor -= 1;
    edited();
  }

  function del() {
    if (!inputEnabled || cursor >= input.length) return;
    input = input.slice(0, cursor) + input.slice(cursor + 1);
    edited();
  }

  function left() { moveTo(cursor - 1); }
  function right() { moveTo(cursor + 1); }
  function home() { moveTo(0); }
  function end() { moveTo(input.length); }

  function moveTo(i) {
    cursor = Math.min(input.length, Math.max(0, i));
    scroll = 0;
    changed();
  }

  function setInput(text) {
    input = text;
    cursor = text.length;
    edited();
  }

  function killLine() {
    input = input.slice(cursor);
    cursor = 0;
    edited();
  }

  // Echoes the input line into the buffer and returns it. Not mirrored.
  function submit() {
    const line = input;
    lines.push({ t: prompt + line, c: "bright" });
    input = "";
    cursor = 0;
    scroll = 0;
    changed();
    return line;
  }

  function scrollBy(n) {
    const max = Math.max(0, totalVisualRows() - rows);
    scroll = Math.min(max, Math.max(0, scroll + n));
    changed();
  }

  function scrollToBottom() {
    scroll = 0;
    changed();
  }

  function edited() {
    scroll = 0;
    changed();
  }

  function changed() {
    onChange();
  }

  function totalVisualRows() {
    return lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.t.length / cols)), 0) + liveRows();
  }

  function liveRows() {
    return visualRows(prompt + input + " ", cols).length;
  }

  // The rows to draw now, plus the cursor position (null when scrolled away or in a program).
  function frame() {
    if (program) return { rows: program.render(cols, rows), cursor: null, bg: "theme" };

    const visual = [];
    const live = visualRows(prompt + input + " ", cols);
    const need = rows + scroll;
    for (let i = live.length - 1; i >= 0 && visual.length < need; i--) visual.unshift({ t: live[i], c: "fg", live: true });
    for (let i = lines.length - 1; i >= 0 && visual.length < need; i--) {
      const parts = visualRows(lines[i].t, cols);
      for (let j = parts.length - 1; j >= 0 && visual.length < need; j--) visual.unshift({ t: parts[j], c: lines[i].c });
    }
    const end = visual.length - scroll;
    const view = visual.slice(Math.max(0, end - rows), end);
    while (view.length < rows) view.push({ t: "", c: "fg" });

    let cur = null;
    if (scroll === 0 && inputEnabled) {
      const idx = (prompt + input.slice(0, cursor)).length;
      const liveTop = view.findIndex((r) => r.live);
      const top = liveTop === -1 ? rows - live.length : liveTop;
      cur = { row: top + Math.floor(idx / cols), col: idx % cols };
      if (cur.row >= rows) cur = null;
    }
    return { rows: view.map(({ t, c }) => ({ t, c })), cursor: cur, bg: "theme" };
  }
}

// Splits one logical line into visual rows of at most `cols` characters.
export function visualRows(text, cols) {
  if (text.length <= cols) return [text];
  const out = [];
  for (let i = 0; i < text.length; i += cols) out.push(text.slice(i, i + cols));
  return out;
}
