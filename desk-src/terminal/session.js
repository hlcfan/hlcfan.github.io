// A shell session on a terminal: key handling, running lines, completion,
// the pager, Ctrl+C, and the prompt. Browser APIs come in through `host`.
import { HOME, createFs } from "./fs.js";
import { commandList, commands } from "./commands/index.js";
import { createPager } from "./pager.js";
import { createShell } from "./shell.js";
import { columns } from "./text.js";
import { loginBanner } from "../boot-script.js";

export function createSession({ term, host, storage }) {
  let cwd = HOME;
  let fs = createFs({ posts: [] });
  let busy = null; // AbortController while a command runs
  let tabPending = false;

  const fsProxy = new Proxy({}, { get: (_, k) => fs[k] });
  const ctx = {
    fs: fsProxy,
    cols: () => term.cols,
    cwd: () => cwd,
    setCwd: (p) => { cwd = p; updatePrompt(); },
    commandList,
    commandRun: (name, args) => commands[name].run(ctx, args, null),
    history: () => shell.history(),
    signal: () => busy?.signal,
    clear: () => term.clear(),
    pager: openPager,
    fileRead: () => host.fileRead(),
    readPost: (post) => host.readPost(post, term.cols, busy?.signal),
    searchIndex: (signal) => host.searchIndex(signal),
    navigate: (url) => host.navigate(url),
    exitToList: () => host.exitToList(),
    feedUrl: () => host.feedUrl(),
    theme: (name) => host.theme(name),
    crt: (on) => host.crt(on),
    mute: (on) => host.mute(on),
    reboot: () => host.reboot(),
    halt: () => host.halt(),
    panic: (text) => { term.print(text, { c: "err", mirror: false }); host.panic(); },
  };
  const shell = createShell({ commands, ctx, storage });

  return { onText, onKey, reset, setPosts, runLine, cancel, get busy() { return !!busy; } };

  // Called when posts.json arrives. Replaces the file system, keeping the working directory.
  function setPosts(posts) {
    fs = createFs({ posts, links: { rss: host.feedUrl() } });
    if (!fs.isDir(cwd)) cwd = HOME;
  }

  // Fresh screen at READY: clear, banner, prompt.
  function reset() {
    cancel(true);
    term.setProgram(null);
    term.clear();
    cwd = HOME;
    for (const l of loginBanner()) term.print(l, { mirror: false });
    term.setInputEnabled(true);
    term.setInput("");
    updatePrompt();
  }

  function onText(text) {
    if (term.program || busy) return;
    tabPending = false;
    term.insert(text);
  }

  // Returns true when the key was used (so the caller can preventDefault).
  function onKey({ key, ctrl = false }) {
    if (term.program) return programKey(key);
    if (busy) {
      if (ctrl && key === "c") cancel();
      return true;
    }
    if (key !== "Tab") tabPending = false;

    if (ctrl) return ctrlKey(key);
    switch (key) {
      case "Enter": runLine(term.submit()); return true;
      case "Backspace": term.backspace(); return true;
      case "Delete": term.del(); return true;
      case "ArrowLeft": term.left(); return true;
      case "ArrowRight": term.right(); return true;
      case "Home": term.home(); return true;
      case "End": term.end(); return true;
      case "ArrowUp": term.setInput(shell.recallPrev(term.input)); return true;
      case "ArrowDown": term.setInput(shell.recallNext()); return true;
      case "PageUp": term.scrollBy(term.rows - 2); return true;
      case "PageDown": term.scrollBy(-(term.rows - 2)); return true;
      case "Tab": tab(); return true;
      default: return false;
    }
  }

  function ctrlKey(key) {
    if (key === "c") {
      term.print(shellEcho() + "^C", { c: "bright", mirror: false });
      term.setInput("");
    } else if (key === "l") term.clear();
    else if (key === "u") term.killLine();
    else if (key === "a") term.home();
    else if (key === "e") term.end();
    else return false;
    return true;
  }

  function programKey(key) {
    term.program.key(key);
    return true;
  }

  function tab() {
    const r = shell.complete(term.input.slice(0, term.cursor));
    const rest = term.input.slice(term.cursor);
    if (r.line !== term.input.slice(0, term.cursor)) {
      term.setInput(r.line + rest);
      tabPending = false;
      return;
    }
    if (r.candidates.length < 2) return;
    if (!tabPending) {
      tabPending = true;
      return;
    }
    term.print(shellEcho(), { c: "bright", mirror: false });
    term.print(columns(r.candidates, term.cols), { mirror: false });
    tabPending = false;
  }

  async function runLine(line) {
    busy = new AbortController();
    const mine = busy;
    term.setInputEnabled(false);
    try {
      const r = await shell.run(line);
      if (mine.signal.aborted) return;
      if (r.err) term.print(r.err, { c: "err" });
      else if (r.out) term.print(r.out, { label: r.label ?? "" });
    } catch (e) {
      if (!mine.signal.aborted) term.print(`sh: ${e.message || "command failed"}`, { c: "err" });
    } finally {
      if (busy === mine) {
        busy = null;
        if (!term.program) term.setInputEnabled(true);
      }
    }
  }

  // Ctrl+C: stop the running command and print ^C.
  function cancel(silent = false) {
    if (!busy) return;
    busy.abort();
    busy = null;
    if (!silent) term.print("^C", { c: "bright", mirror: false });
    term.setInputEnabled(true);
  }

  function openPager(text, title) {
    const program = createPager(text, {
      title,
      onExit: () => {
        term.setProgram(null);
        term.setInputEnabled(true);
      },
      onChange: () => term.setProgram(program),
    });
    term.setInputEnabled(false);
    term.setProgram(program);
  }

  function shellEcho() {
    return promptText() + term.input;
  }

  function promptText() {
    const where = cwd === HOME ? "~" : cwd.startsWith(HOME + "/") ? "~" + cwd.slice(HOME.length) : cwd;
    return `alex@desk:${where}$ `;
  }

  function updatePrompt() {
    term.setPrompt(promptText());
  }
}
