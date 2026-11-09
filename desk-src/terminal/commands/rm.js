const PANIC = [
  "rm: removing everything under /",
  "VFS: Unable to mount root fs on 08:01",
  "Kernel panic: VFS: Unable to mount root fs on 08:01",
  "In idle task - not syncing",
];

export default {
  name: "rm",
  desc: "",
  run(ctx, args) {
    const flags = args.filter((a) => a.startsWith("-")).join("");
    const targets = args.filter((a) => !a.startsWith("-"));
    if (flags.includes("r") && flags.includes("f") && targets.includes("/")) {
      ctx.panic(PANIC.join("\n"));
      return {};
    }
    return { err: `rm: cannot remove '${targets[0] ?? ""}': Read-only file system` };
  },
};
