import { columns, cut } from "../text.js";

export default {
  name: "ls",
  desc: "list a directory (ls posts/)",
  run(ctx, args, stdin, { piped = false } = {}) {
    const flags = args.filter((a) => a.startsWith("-")).join("");
    const paths = args.filter((a) => !a.startsWith("-"));
    const abs = ctx.fs.resolve(ctx.cwd(), paths[0] ?? ".");
    const node = ctx.fs.stat(abs);
    if (!node) return { err: `ls: cannot access '${paths[0]}': No such file or directory` };
    if (node.type === "file") return { out: paths[0] };
    const names = ctx.fs.list(abs, { all: flags.includes("a") }).map((e) => e.name + (e.type === "dir" ? "/" : ""));
    ctx.fileRead();
    const shown = names.map((n) => cut(n, ctx.cols()));
    return { out: piped ? shown.join("\n") : columns(shown, ctx.cols()) };
  },
};
