export default {
  name: "crt",
  desc: "crt on|off: curvature and scanlines",
  run(ctx, args) {
    if (args[0] !== "on" && args[0] !== "off") return { err: "usage: crt on|off" };
    ctx.crt(args[0] === "on");
    return { out: `crt: ${args[0]}` };
  },
};
