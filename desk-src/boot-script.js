// What the screen shows during POST, LILO and the kernel log. Every line is
// kept short. Longer kernel lines wrap, so the narrow layout works too.
// Names are invented. The BIOS and CPU brands do not exist.
import { visualRows } from "./terminal/terminal.js";

const BIOS_TOP = [
  [0.0, "Merit Modular BIOS v4.51PG", "biosW"],
  [0.0, "Copyright (C) 1984-99, Merit Software", "bios"],
  [0.05, "", "bios"],
  [0.05, "Pentrix III-550 CPU at 550MHz", "bios"],
];
const BIOS_MEM_AT = 0.1;
const BIOS_AFTER = [
  [0.55, "", "bios"],
  [0.55, "Plug and Play BIOS Extension v1.0A", "bios"],
  [0.65, "Detecting IDE Primary Master ... ", "bios"],
  [0.75, "Detecting IDE Secondary Master ... ", "bios"],
  [0.85, "Floppy Drive A: 1.44M, 3.5 in.", "bios"],
];
const IDE_RESULT = { 2: "ST-6400A 6.4GB", 3: "24X CD-ROM" };

export const POST_MEMORY_KB = 65536;

// Returns {rows, bg} for the POST screen at `t` ms of a `dur` ms state.
export function biosFrame(t, dur, { cols = 80, rows = 30 } = {}) {
  const p = Math.min(1, t / dur);
  const out = BIOS_TOP.filter(([at]) => p >= at).map(([, text, c]) => ({ t: text, c }));

  if (p >= BIOS_MEM_AT) {
    const done = p >= 0.5;
    const kb = done ? POST_MEMORY_KB : Math.floor(((p - BIOS_MEM_AT) / (0.5 - BIOS_MEM_AT)) * POST_MEMORY_KB / 64) * 64;
    out.push({ t: `Memory Test : ${kb}K${done ? " OK" : ""}`, c: "biosW" });
  }
  let ide = 0;
  for (const [at, text, c] of BIOS_AFTER) {
    if (p < at) continue;
    const finished = text.startsWith("Detecting") ? p >= at + 0.07 : true;
    const suffix = text.startsWith("Detecting") ? (finished ? IDE_RESULT[2 + ide++] ?? "None" : "") : "";
    out.push({ t: text + suffix, c });
  }

  const frame = out.slice(0, rows - 2).map((r) => ({ ...r, t: r.t.slice(0, cols) }));
  while (frame.length < rows - 2) frame.push({ t: "", c: "bios" });
  frame.push({ t: "Press DEL to enter SETUP".slice(0, cols), c: "biosY" });
  frame.push({ t: "09/05/2000-i440BX-W977-2A69KM4BC-00".slice(0, cols), c: "bios" });
  return { rows: frame, bg: "bios" };
}

export const KERNEL_LOG = [
  "Linux version 2.2.17 (root@desk) (gcc version 2.95.2 19991024 (release)) #1 Tue Sep 5 14:02:11 PDT 2000",
  "Detected 550.027 MHz processor.",
  "Console: colour VGA+ 80x25",
  "Calibrating delay loop... 1094.45 BogoMIPS",
  "Memory: 62372k/65536k available (1020k kernel code, 412k reserved, 2004k data, 64k init)",
  "Dentry hash table entries: 8192 (order 4, 64k)",
  "Buffer cache hash table entries: 65536 (order 6, 256k)",
  "Page cache hash table entries: 16384 (order 4, 64k)",
  "VFS: Diskquotas version dquot_6.4.0 initialized",
  "CPU: Pentrix III (Katmai) stepping 03",
  "Checking 386/387 coupling... OK, FPU using exception 16 error reporting.",
  "Checking 'hlt' instruction... OK.",
  "POSIX conformance testing by UNIFIX",
  "PCI: PCI BIOS revision 2.10 entry at 0xfb4a0",
  "PCI: Using configuration type 1",
  "PCI: Probing PCI hardware",
  "Linux NET4.0 for Linux 2.2",
  "Based upon Swansea University Computer Society NET3.039",
  "NET4: Unix domain sockets 1.0 for Linux NET4.0.",
  "NET4: Linux TCP/IP 1.0 for NET4.0",
  "IP Protocols: ICMP, UDP, TCP",
  "TCP: Hash tables configured (ehash 65536 bhash 65536)",
  "Starting kswapd v 1.5",
  "Serial driver version 4.27 with no serial options enabled",
  "ttyS00 at 0x03f8 (irq = 4) is a 16550A",
  "ttyS01 at 0x02f8 (irq = 3) is a 16550A",
  "Uniform Multi-Platform E-IDE driver Revision: 6.30",
  "PIIX3: IDE controller on PCI bus 00 dev 39",
  "hda: ST-6400A, 6104MB w/512kB Cache, CHS=777/255/63",
  "hdc: 24X CD-ROM, ATAPI CDROM drive",
  "Floppy drive(s): fd0 is 1.44M",
  "FDC 0 is a post-1991 82077",
  "Partition check:",
  " hda: hda1 hda2 < hda5 >",
  "VFS: Mounted root (ext2 filesystem) readonly.",
  "Freeing unused kernel memory: 64k freed",
  "INIT: version 2.78 booting",
  "Mounting local filesystems... done",
  "Starting syslogd... done",
  "INIT: Entering runlevel: 3",
];

const LILO_AT = 0.18;

// Returns {rows, bg, lines} for the BOOTING screen. `lines` counts kernel
// lines shown so far, so the caller can play a seek sound per new line.
export function bootFrame(t, dur, { cols = 80, rows = 30 } = {}) {
  const p = Math.min(1, t / dur);
  const visual = [];
  let lines = 0;

  if (p < LILO_AT) {
    visual.push({ t: "LILO boot: " + (p > 0.04 ? "linux" : ""), c: "gray" });
    if (p > 0.07) {
      const dots = Math.min(20, Math.floor(((p - 0.07) / 0.11) * 20));
      visual.push({ t: "Loading linux" + ".".repeat(dots), c: "gray" });
    }
  } else {
    visual.push({ t: "LILO boot: linux", c: "gray" }, { t: "Loading linux.....................", c: "gray" });
    lines = Math.floor(((p - LILO_AT) / (1 - LILO_AT)) * KERNEL_LOG.length) + (p >= 1 ? 0 : 1);
    lines = Math.min(KERNEL_LOG.length, lines);
    for (const l of KERNEL_LOG.slice(0, lines)) for (const part of visualRows(l, cols)) visual.push({ t: part, c: "gray" });
  }
  const view = visual.slice(-rows);
  while (view.length < rows) view.push({ t: "", c: "gray" });
  return { rows: view, bg: "black", lines };
}

export function haltFrame({ rows = 30 } = {}) {
  const view = [{ t: "", c: "gray" }, { t: "System halted.", c: "gray" }];
  while (view.length < rows) view.push({ t: "", c: "gray" });
  return { rows: view, bg: "black" };
}

export function blankFrame(bg = "glow", rows = 30) {
  return { rows: Array.from({ length: rows }, () => ({ t: "", c: "gray" })), bg };
}

export function loginBanner() {
  return ["Welcome to desk (Linux 2.2.17)", "Type 'help' for a list of commands.", ""];
}
