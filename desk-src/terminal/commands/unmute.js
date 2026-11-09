export default { name: "unmute", desc: "turn sound on", run: (ctx) => (ctx.mute(false), { out: "sound on" }) };
