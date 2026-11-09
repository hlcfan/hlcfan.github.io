// Virtual file system. Posts come from posts.json, everything else is static.
export const HOME = "/home/alex";

const ABOUT = [
  "Alex Shi",
  "Software engineer in Singapore. Ruby, Go, a bit of everything else.",
  "Writes about code he got stuck on, so he can find the answer later.",
  "",
  "github: https://github.com/hlcfan",
].join("\n");

const PLAN = ["Plan:", "  - ship the boring thing first", "  - write it down", "  - turn it off and on again"].join("\n");

export const NOW = ["Now:", "  - rebuilding this blog as a desk", "  - writing Go and Rust at work", "  - reading about old computers"].join("\n");

export const FORTUNES = [
  "It works on my machine.",
  "There are two hard problems: cache invalidation, naming things, and off-by-one errors.",
  "Premature optimization is the root of all evil. - D. Knuth",
  "Have you tried turning it off and on again?",
  "The best code is the code you do not have to write.",
  "Make it work, make it right, make it fast. - K. Beck",
  "A watched build never finishes.",
];

export function createFs({ posts = [], links = {} } = {}) {
  const postFiles = Object.fromEntries(posts.map((p) => [postFileName(p), { type: "file", post: p }]));
  const root = dir({
    home: dir({
      alex: dir({
        "about.txt": file(ABOUT),
        "now.txt": file(NOW),
        ".plan": file(PLAN),
        posts: dir(postFiles),
        links: dir({
          github: file(links.github ?? "https://github.com/hlcfan"),
          rss: file(links.rss ?? "/feed.xml"),
        }),
      }),
    }),
  });

  return { resolve, stat, list, isDir, postFor, names, tree };

  // Returns an absolute path with `.`, `..` and `~` applied.
  function resolve(cwd, path) {
    const p = path === "~" || path.startsWith("~/") ? HOME + path.slice(1) : path;
    const parts = (p.startsWith("/") ? p : `${cwd}/${p}`).split("/");
    const out = [];
    for (const part of parts) {
      if (!part || part === ".") continue;
      if (part === "..") out.pop();
      else out.push(part);
    }
    return "/" + out.join("/");
  }

  function stat(abs) {
    let node = root;
    for (const part of abs.split("/").filter(Boolean)) {
      if (node.type !== "dir" || !node.children[part]) return null;
      node = node.children[part];
    }
    return node;
  }

  function isDir(abs) {
    return stat(abs)?.type === "dir";
  }

  function postFor(abs) {
    return stat(abs)?.post ?? null;
  }

  // Sorted entries of a directory: [{name, type}].
  function list(abs, { all = false } = {}) {
    const node = stat(abs);
    if (!node || node.type !== "dir") return null;
    return Object.keys(node.children)
      .filter((n) => all || !n.startsWith("."))
      .sort()
      .map((name) => ({ name, type: node.children[name].type }));
  }

  // Names directly under a path, for completion. Includes dotfiles.
  function names(abs) {
    return list(abs, { all: true }) ?? [];
  }

  function tree(abs, width) {
    const lines = [abs === HOME ? "~" : abs];
    walk(stat(abs), "");
    return lines.join("\n");

    function walk(node, prefix) {
      const entries = Object.keys(node.children).sort();
      entries.forEach((name, i) => {
        const last = i === entries.length - 1;
        const child = node.children[name];
        const label = prefix + (last ? "`-- " : "|-- ");
        lines.push(cutLine(label, name + (child.type === "dir" ? "/" : ""), width));
        if (child.type === "dir") walk(child, prefix + (last ? "    " : "|   "));
      });
    }
  }
}

export function postFileName(post) {
  return `${post.date}-${post.slug}.md`;
}

function cutLine(prefix, name, width) {
  const room = Math.max(1, width - prefix.length);
  return prefix + (name.length <= room ? name : name.slice(0, Math.max(1, room - 1)) + "~");
}

function dir(children) {
  return { type: "dir", children };
}

function file(content) {
  return { type: "file", content };
}
