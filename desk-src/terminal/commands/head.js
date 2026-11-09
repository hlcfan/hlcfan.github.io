import { countArg, source } from "./lines.js";

export default {
  name: "head",
  desc: "first lines of a file or input",
  async run(ctx, args, stdin) {
    const { n, file } = countArg(args);
    const text = await source(ctx, file, stdin, "head");
    return text.err ? text : { out: text.out.split("\n").slice(0, n).join("\n") };
  },
};
