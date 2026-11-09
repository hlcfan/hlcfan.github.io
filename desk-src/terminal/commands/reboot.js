export default { name: "reboot", desc: "restart the machine", run: (ctx) => (ctx.reboot(), { out: "The system is going down for reboot NOW!" }) };
