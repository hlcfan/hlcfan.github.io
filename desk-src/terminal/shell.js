// Shell: parser, dispatch, history, and tab completion. Pure apart from `run`.
const PIPE_TARGETS = new Set(["grep", "head", "tail", "wc"]);

// Splits a line into segments of words. Handles quotes, escapes and one `|` level.
export function parse(line) {
  const segments = [[]];
  let word = null;
  let quote = null;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && i + 1 < line.length) word += line[++i];
      else word += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      word ??= "";
    } else if (ch === "\\" && i + 1 < line.length) {
      word = (word ?? "") + line[++i];
    } else if (/\s/.test(ch)) {
      if (word !== null) segments.at(-1).push(word);
      word = null;
    } else if (ch === "|") {
      if (word !== null) segments.at(-1).push(word);
      word = null;
      segments.push([]);
    } else {
      word = (word ?? "") + ch;
    }
  }
  if (quote) return { error: "unterminated quote" };
  if (word !== null) segments.at(-1).push(word);

  if (segments.length === 1 && !segments[0].length) return { segments: [] };
  if (segments.some((s) => !s.length)) return { error: "syntax error near `|'" };
  if (segments.length > 2) return { error: "only one pipe is supported" };
  if (segments.length === 2 && !PIPE_TARGETS.has(segments[1][0])) {
    return { error: "pipe target must be grep, head, tail or wc" };
  }
  return { segments: segments.map(([cmd, ...args]) => ({ cmd, args })) };
}

export function createShell({ commands, ctx, storage = null }) {
  const history = loadHistory(storage);
  let cursor = history.length;
  let pending = "";

  return { run, history: () => history.slice(), recallPrev, recallNext, complete };

  // Runs a line and returns {out, err}. Output stays text so pipes are simple.
  async function run(line) {
    if (line.trim()) {
      if (history.at(-1) !== line) history.push(line);
      saveHistory(storage, history);
    }
    cursor = history.length;

    const parsed = parse(line);
    if (parsed.error) return { err: `sh: ${parsed.error}` };
    if (!parsed.segments.length) return {};

    let stdin = null;
    let result = {};
    const last = parsed.segments.length - 1;
    for (const [i, { cmd, args }] of parsed.segments.entries()) {
      const command = commands[cmd];
      if (!command) return { err: `sh: ${cmd}: command not found` };
      result = (await command.run(ctx, args, stdin, { piped: i < last })) ?? {};
      if (result.err) return result;
      stdin = result.out ?? "";
    }
    return result;
  }

  function recallPrev(current) {
    if (cursor === history.length) pending = current;
    if (cursor > 0) cursor -= 1;
    return history[cursor] ?? current;
  }

  function recallNext() {
    if (cursor < history.length) cursor += 1;
    return cursor === history.length ? pending : history[cursor];
  }

  // Completes the word at the end of `line`. Returns {line, candidates}.
  function complete(line) {
    const m = line.match(/^(.*?)(\S*)$/s);
    const before = m[1];
    const word = m[2];
    const firstWord = before.trim() === "" || /\|\s*$/.test(before);

    let options;
    let head = "";
    if (firstWord) {
      options = Object.keys(commands).filter((n) => n.startsWith(word));
    } else {
      const slash = word.lastIndexOf("/");
      head = word.slice(0, slash + 1);
      const partial = word.slice(slash + 1);
      const dirPath = ctx.fs.resolve(ctx.cwd(), head || ".");
      options = ctx.fs
        .names(dirPath)
        .filter((e) => e.name.startsWith(partial) && (partial.startsWith(".") || !e.name.startsWith(".")))
        .map((e) => e.name + (e.type === "dir" ? "/" : ""));
    }
    if (!options.length) return { line, candidates: [] };

    const common = commonPrefix(options);
    const done = options.length === 1 && !options[0].endsWith("/") ? " " : "";
    return { line: before + head + common + done, candidates: options.length > 1 ? options : [] };
  }
}

function commonPrefix(items) {
  let p = items[0];
  for (const s of items) while (!s.startsWith(p)) p = p.slice(0, -1);
  return p;
}

function loadHistory(storage) {
  try {
    return JSON.parse(storage?.getItem("desk.history") ?? "[]").slice(-200);
  } catch {
    return [];
  }
}

function saveHistory(storage, history) {
  try {
    storage?.setItem("desk.history", JSON.stringify(history.slice(-200)));
  } catch { /* storage may be blocked */ }
}
