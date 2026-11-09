// Converts a post's HTML (a DOM element) to wrapped terminal text.
import { asciify, wrap } from "./text.js";

// Returns the text for `root`. `base` resolves relative links.
export function htmlToText(root, { cols = 80, base = "http://localhost/" } = {}) {
  const links = [];
  const lines = blocks(root, cols, { links, base });
  if (links.length) {
    lines.push("", "Links:");
    links.forEach((href, i) => lines.push(...wrap(`[${i + 1}] ${href}`, cols)));
  }
  return asciify(collapseBlank(trimBlank(lines)).join("\n"));
}

const BLOCK = new Set([
  "P", "DIV", "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "BLOCKQUOTE", "TABLE", "HR",
  "FIGURE", "SECTION", "ARTICLE", "DL", "DT", "DD",
]);

// Renders the children of `node` as lines no wider than `width`.
function blocks(node, width, env) {
  const out = [];
  let inline = "";

  for (const child of node.childNodes) walk(child);
  flush();
  return out;

  function walk(n) {
    if (n.nodeType === 3) {
      inline += n.textContent;
      return;
    }
    if (n.nodeType !== 1) return;

    const tag = n.tagName;
    if (tag === "BR") {
      inline += "\n";
    } else if (tag === "IMG") {
      inline += ` [image: ${n.getAttribute("alt") || "image"}] `;
    } else if (["IFRAME", "VIDEO", "SVG", "CANVAS", "OBJECT", "EMBED"].includes(tag.toUpperCase())) {
      inline += ` [image: ${n.getAttribute("title") || "embedded content"}] `;
    } else if (["SCRIPT", "STYLE"].includes(tag)) {
      // Nothing to show.
    } else if (tag === "A") {
      anchor(n);
    } else if (/^H[1-6]$/.test(tag)) {
      flush();
      heading(n, tag);
    } else if (tag === "PRE") {
      flush();
      pre(n);
    } else if (tag === "UL" || tag === "OL") {
      flush();
      list(n, tag === "OL");
    } else if (tag === "BLOCKQUOTE") {
      flush();
      for (const l of blocks(n, width - 2, env)) out.push(l ? "> " + l : ">");
      out.push("");
    } else if (tag === "HR") {
      flush();
      out.push("-".repeat(width), "");
    } else if (tag === "TABLE") {
      flush();
      table(n);
    } else if (BLOCK.has(tag)) {
      flush();
      out.push(...blocks(n, width, env));
    } else {
      for (const c of n.childNodes) walk(c);
    }
  }

  function flush() {
    const text = inline;
    inline = "";
    for (const para of text.split("\n")) {
      const wrapped = wrap(para, width);
      if (!wrapped.length) continue;
      out.push(...wrapped);
    }
    if (text.trim()) out.push("");
  }

  function anchor(a) {
    const text = a.textContent.replace(/\s+/g, " ").trim();
    const href = a.getAttribute("href");
    if (!text || !href || href.startsWith("#")) {
      inline += a.textContent;
      return;
    }
    let abs = href;
    try { abs = new URL(href, env.base).href; } catch { /* keep as written */ }
    let n = env.links.indexOf(abs) + 1;
    if (!n) n = env.links.push(abs);
    inline += `${a.textContent} [${n}]`;
  }

  function heading(h, tag) {
    const text = h.textContent.replace(/\s+/g, " ").trim().toUpperCase();
    if (!text) return;
    const mark = tag === "H1" || tag === "H2" ? "=" : "-";
    const wrapped = wrap(text, width);
    out.push(...wrapped, mark.repeat(Math.min(width, Math.max(...wrapped.map((l) => l.length)))), "");
  }

  function pre(p) {
    const room = width - 2;
    for (const raw of p.textContent.replace(/\n+$/, "").split("\n")) {
      const line = raw.replace(/\t/g, "  ").replace(/\s+$/, "");
      out.push("  " + (line.length > room ? line.slice(0, room - 1) + ">" : line));
    }
    out.push("");
  }

  function list(l, ordered) {
    let i = 0;
    for (const li of l.children) {
      if (li.tagName !== "LI") continue;
      i += 1;
      const mark = ordered ? `${i}. ` : "* ";
      const inner = blocks(li, width - mark.length, env);
      while (inner.length && !inner[inner.length - 1]) inner.pop();
      inner.forEach((line, j) => out.push((j === 0 ? mark : " ".repeat(mark.length)) + line));
    }
    out.push("");
  }

  function table(t) {
    for (const tr of t.querySelectorAll("tr")) {
      const cells = [...tr.children].map((c) => c.textContent.replace(/\s+/g, " ").trim());
      out.push(...wrap(cells.join(" | "), width));
    }
    out.push("");
  }
}

// Nested blocks each add their own trailing blank line. Keep at most one in a row.
function collapseBlank(lines) {
  return lines.filter((l, i) => l || lines[i - 1]);
}

function trimBlank(lines) {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a]) a++;
  while (b > a && !lines[b - 1]) b--;
  return lines.slice(a, b);
}
