export default { name: "mute", desc: "turn sound off", run: (ctx) => (ctx.mute(true), { out: "sound off" }) };
