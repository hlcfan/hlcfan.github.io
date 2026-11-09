// The `less` program. Plugs into the terminal as a full-screen program.
export function createPager(text, { title = "", onExit = () => {}, onChange = () => {} } = {}) {
  const lines = text.split("\n");
  let top = 0;
  let pageRows = 29;

  return { render, key };

  // Returns rows for a screen of `cols` x `rows`.
  function render(cols, rows) {
    pageRows = rows - 1;
    top = Math.min(top, maxTop());
    const out = [];
    for (let i = 0; i < pageRows; i++) out.push({ t: (lines[top + i] ?? "~").slice(0, cols), c: lines[top + i] === undefined ? "dim" : "fg" });
    const pct = lines.length <= pageRows ? 100 : Math.round(((top + pageRows) / lines.length) * 100);
    const status = top >= maxTop() ? "(END)" : `${Math.min(100, pct)}%`;
    out.push({ t: `${title} ${status}  q:quit space/b:page j/k:line`.slice(0, cols), c: "fg", inv: true });
    return out;
  }

  function key(k) {
    const before = top;
    if (k === "q" || k === "Escape") return onExit();
    if (k === " " || k === "PageDown" || k === "f") top += pageRows;
    else if (k === "b" || k === "PageUp") top -= pageRows;
    else if (k === "j" || k === "ArrowDown" || k === "Enter") top += 1;
    else if (k === "k" || k === "ArrowUp") top -= 1;
    else if (k === "g" || k === "Home") top = 0;
    else if (k === "G" || k === "End") top = maxTop();
    top = Math.min(maxTop(), Math.max(0, top));
    if (top !== before) onChange();
  }

  function maxTop() {
    return Math.max(0, lines.length - pageRows);
  }
}
