export default {
  name: "tree",
  desc: "print the file system",
  run(ctx, args) {
    const abs = ctx.fs.resolve(ctx.cwd(), args[0] ?? ".");
    if (!ctx.fs.isDir(abs)) return { err: `tree: ${args[0] ?? "."}: Not a directory` };
    return { out: ctx.fs.tree(abs, ctx.cols()) };
  },
};
