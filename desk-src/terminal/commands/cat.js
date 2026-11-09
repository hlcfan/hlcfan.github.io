export default {
  name: "cat",
  desc: "print a file or post",
  async run(ctx, args) {
    if (!args.length) return { err: "cat: missing file" };
    const outs = [];
    let label = "";
    for (const a of args) {
      const abs = ctx.fs.resolve(ctx.cwd(), a);
      const r = await readFile(ctx, abs, a);
      if (r.err) return r;
      outs.push(r.out);
      label ||= r.label ?? a;
    }
    return { out: outs.join("\n"), label };
  },
};

// Shared with less: returns {out} or {err} for one absolute path.
export async function readFile(ctx, abs, shown) {
  const node = ctx.fs.stat(abs);
  if (!node) return { err: `cat: ${shown}: No such file or directory` };
  if (node.type === "dir") return { err: `cat: ${shown}: Is a directory` };
  if (node.post) return ctx.readPost(node.post);
  ctx.fileRead();
  return { out: node.content };
}
