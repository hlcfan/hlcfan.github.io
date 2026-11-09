export default { name: "whoami", desc: "short bio and contact", run: (ctx) => ctx.commandRun("cat", ["/home/alex/about.txt"]) };
