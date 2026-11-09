export default {
  name: "uname",
  desc: "print system name (-a for all)",
  run: (ctx, args) => ({
    out: args.includes("-a") ? "Linux desk 2.2.17 #1 Tue Sep 5 14:02:11 PDT 2000 i686 unknown" : "Linux",
  }),
};
