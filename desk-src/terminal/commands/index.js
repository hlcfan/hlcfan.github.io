// Command registry. Every command is { name, desc, run(ctx, args, stdin) -> {out?, err?} }.
import about from "./about.js";
import cat from "./cat.js";
import cd from "./cd.js";
import clear from "./clear.js";
import crt from "./crt.js";
import date from "./date.js";
import echo from "./echo.js";
import exit from "./exit.js";
import fortune from "./fortune.js";
import grep from "./grep.js";
import head from "./head.js";
import help from "./help.js";
import history from "./history.js";
import less from "./less.js";
import ls from "./ls.js";
import mute from "./mute.js";
import open from "./open.js";
import pwd from "./pwd.js";
import reboot from "./reboot.js";
import rm from "./rm.js";
import rss from "./rss.js";
import shutdown from "./shutdown.js";
import sudo from "./sudo.js";
import tail from "./tail.js";
import theme from "./theme.js";
import tree from "./tree.js";
import uname from "./uname.js";
import unmute from "./unmute.js";
import wc from "./wc.js";
import whoami from "./whoami.js";

export const commands = Object.fromEntries(
  [about, cat, cd, clear, crt, date, echo, exit, fortune, grep, head, help, history, less, ls, mute, open, pwd,
    reboot, rm, rss, shutdown, sudo, tail, theme, tree, uname, unmute, wc, whoami].map((c) => [c.name, c]),
);

// Commands shown by `help`. Jokes stay hidden.
export function commandList() {
  return Object.values(commands).filter((c) => c.desc);
}
