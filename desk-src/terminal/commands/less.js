import { readFile } from "./cat.js";

export default {
  name: "less",
  desc: "page through a file (q quits)",
  async run(ctx, args) {
    if (!args[0]) return { err: "less: missing file" };
    const r = await readFile(ctx, ctx.fs.resolve(ctx.cwd(), args[0]), args[0]);
    if (r.err) return { err: r.err.replace(/^cat:/, "less:") };
    ctx.pager(r.out, args[0]);
    return {};
  },
};
