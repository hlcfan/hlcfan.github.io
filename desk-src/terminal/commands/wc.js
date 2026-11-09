import { source } from "./lines.js";

export default {
  name: "wc",
  desc: "count lines (wc -l)",
  async run(ctx, args, stdin) {
    if (!args.includes("-l")) return { err: "usage: wc -l [file]" };
    const text = await source(ctx, args.find((a) => a !== "-l"), stdin, "wc");
    if (text.err) return text;
    return { out: String(text.out === "" ? 0 : text.out.split("\n").length) };
  },
};
