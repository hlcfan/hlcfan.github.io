export default { name: "exit", desc: "leave the desk for the plain list", run: (ctx) => (ctx.exitToList(), { out: "logout" }) };
