import { postFileName } from "../fs.js";

const MAX = 50;

export default {
  name: "grep",
  desc: "search posts (grep -i pattern [path])",
  async run(ctx, args, stdin) {
    const ignoreCase = args.includes("-i");
    const rest = args.filter((a) => a !== "-i");
    if (!rest.length) return { err: "usage: grep [-i] pattern [path]" };
    const re = toRegExp(rest[0], ignoreCase);

    if (stdin !== null) {
      return { out: stdin.split("\n").filter((l) => re.test(l)).join("\n") };
    }

    const abs = ctx.fs.resolve(ctx.cwd(), rest[1] ?? "/home/alex/posts");
    const node = ctx.fs.stat(abs);
    if (!node) return { err: `grep: ${rest[1]}: No such file or directory` };

    const hits = [];
    if (node.type === "file" && !node.post) {
      for (const l of node.content.split("\n")) if (re.test(l)) hits.push(l);
      return { out: hits.join("\n") };
    }
    const index = await ctx.searchIndex(ctx.signal());
    const wanted = node.post ? new Set([node.post.slug]) : null;
    for (const doc of index) {
      if (wanted && !wanted.has(doc.slug)) continue;
      for (const line of doc.text.split("\n")) {
        const t = line.trim();
        if (t && re.test(t)) hits.push(`${postFileName(doc)}:${t}`);
      }
    }
    ctx.fileRead();
    const shown = hits.slice(0, MAX);
    if (hits.length > MAX) shown.push(`... ${hits.length - MAX} more`);
    return { out: shown.join("\n") };
  },
};

function toRegExp(pattern, ignoreCase) {
  try {
    return new RegExp(pattern, ignoreCase ? "i" : "");
  } catch {
    return new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), ignoreCase ? "i" : "");
  }
}
