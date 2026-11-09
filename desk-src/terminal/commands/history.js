export default {
  name: "history",
  desc: "show command history",
  run: (ctx) => ({ out: ctx.history().map((l, i) => `${String(i + 1).padStart(4)}  ${l}`).join("\n") }),
};
