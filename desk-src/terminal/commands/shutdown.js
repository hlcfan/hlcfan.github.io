export default { name: "shutdown", desc: "halt the machine", run: (ctx) => (ctx.halt(), { out: "The system is going down for halt NOW!" }) };
