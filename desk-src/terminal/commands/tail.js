import { countArg, source } from "./lines.js";

export default {
  name: "tail",
  desc: "last lines of a file or input",
  async run(ctx, args, stdin) {
    const { n, file } = countArg(args);
    const text = await source(ctx, file, stdin, "tail");
    return text.err ? text : { out: text.out.split("\n").slice(-n).join("\n") };
  },
};
