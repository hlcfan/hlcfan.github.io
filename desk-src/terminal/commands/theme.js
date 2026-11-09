export default {
  name: "theme",
  desc: "set colors: green, amber, blue",
  run(ctx, args) {
    if (!ctx.theme(args[0])) return { err: "usage: theme green|amber|blue" };
    return { out: `theme: ${args[0]}` };
  },
};
