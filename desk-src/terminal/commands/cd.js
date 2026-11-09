export default {
  name: "cd",
  desc: "change directory",
  run(ctx, args) {
    const abs = ctx.fs.resolve(ctx.cwd(), args[0] ?? "~");
    if (!ctx.fs.stat(abs)) return { err: `cd: ${args[0]}: No such file or directory` };
    if (!ctx.fs.isDir(abs)) return { err: `cd: ${args[0]}: Not a directory` };
    ctx.setCwd(abs);
    return {};
  },
};
