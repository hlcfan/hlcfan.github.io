// Helpers shared by head, tail and wc.
export async function source(ctx, file, stdin, name) {
  if (stdin !== null) return { out: stdin };
  if (!file) return { err: `${name}: missing file` };
  const abs = ctx.fs.resolve(ctx.cwd(), file);
  const node = ctx.fs.stat(abs);
  if (!node || node.type !== "file") return { err: `${name}: ${file}: No such file` };
  return node.post ? ctx.readPost(node.post) : { out: node.content };
}

// Parses `-n 5`, `-5` and a file name. Default count is 10.
export function countArg(args) {
  let n = 10;
  let file = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-n") n = parseInt(args[++i], 10) || 10;
    else if (/^-\d+$/.test(args[i])) n = parseInt(args[i].slice(1), 10);
    else file = args[i];
  }
  return { n, file };
}
