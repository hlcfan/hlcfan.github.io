export default { name: "pwd", desc: "print working directory", run: (ctx) => ({ out: ctx.cwd() }) };
