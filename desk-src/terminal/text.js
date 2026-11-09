// Small text helpers shared by commands, the pager and html-to-text.

// Wraps one paragraph at `width`. Words longer than `width` are split.
export function wrap(text, width) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (let word of words) {
    while (word.length > width) {
      if (line) {
        lines.push(line);
        line = "";
      }
      lines.push(word.slice(0, width));
      word = word.slice(width);
    }
    if (!line) line = word;
    else if (line.length + 1 + word.length <= width) line += " " + word;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Cuts a name that is longer than `width`, ending it in `~`.
export function cut(name, width) {
  return name.length <= width ? name : name.slice(0, Math.max(1, width - 1)) + "~";
}

// The terminal font covers ASCII only. Map common typography, replace the rest.
export function asciify(text) {
  return text
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[    ​]/g, " ")
    .replace(/•/g, "*")
    .replace(/[←-↓]/g, "-")
    .replace(/[^\x09\x0A\x20-\x7E]/g, "?");
}

// Formats names in columns like `ls`. Long names (posts) go one per line.
export function columns(names, width) {
  if (!names.length) return "";
  const longest = Math.max(...names.map((n) => n.length));
  if (longest > 24) return names.join("\n");
  const cell = Math.min(longest + 2, width);
  const perRow = Math.max(1, Math.floor(width / cell));
  const rows = [];
  for (let i = 0; i < names.length; i += perRow) {
    rows.push(
      names
        .slice(i, i + perRow)
        .map((n, j, a) => (j === a.length - 1 ? n : n.padEnd(cell)))
        .join(""),
    );
  }
  return rows.join("\n");
}
