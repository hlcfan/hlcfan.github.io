import { wrap } from "../text.js";

export default {
  name: "help",
  desc: "list commands",
  run(ctx) {
    const width = 12;
    const lines = [];
    for (const c of ctx.commandList()) {
      const rows = wrap(c.desc, Math.max(10, ctx.cols() - width));
      lines.push(c.name.padEnd(width) + (rows[0] ?? ""));
      for (const r of rows.slice(1)) lines.push(" ".repeat(width) + r);
    }
    return { out: lines.join("\n") };
  },
};
