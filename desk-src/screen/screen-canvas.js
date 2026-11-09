// Draws terminal rows into a 2D canvas, redrawing only rows that changed,
// and uploads those rows to the GPU texture as bands.
import { CANVAS, LAYOUTS } from "./layout.js";
import { backgroundColor, textColor } from "./themes.js";
import { fitFontSize } from "./font.js";

const BLANK = { t: "", c: "fg" };

export function createScreenCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS.w;
  canvas.height = CANVAS.h;
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });

  let layout = LAYOUTS.wide;
  let theme = "green";
  let prev = [];
  let prevBg = null;
  let fontPx = fitFontSize(ctx, layout.cellW);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, CANVAS.w, CANVAS.h);

  return { canvas, draw, setLayout, setTheme, refit, get layout() { return layout; }, get theme() { return theme; } };

  function setLayout(next) {
    layout = next;
    refit();
  }

  function setTheme(name) {
    theme = name;
    prev = [];
  }

  // Recomputes the font size, for example after the font file finished loading.
  function refit() {
    fontPx = fitFontSize(ctx, layout.cellW);
    prev = [];
  }

  // Draws changed rows. Returns the bands [{y, h}] that need uploading.
  function draw(frame) {
    const { rows, cellH } = { rows: layout.rows, cellH: layout.cellH };
    if (frame.bg !== prevBg) prev = [];
    prevBg = frame.bg;

    const dirty = [];
    for (let r = 0; r < rows; r++) {
      const key = signature(frame.rows[r] ?? BLANK, frame.cursor?.row === r ? frame.cursor : null);
      if (prev[r] !== key) {
        prev[r] = key;
        dirty.push(r);
      }
    }
    if (!dirty.length) return [];

    const bg = backgroundColor(theme, frame.bg);
    for (const r of dirty) {
      const row = frame.rows[r] ?? BLANK;
      ctx.fillStyle = row.inv ? textColor(theme, row.c) : bg;
      ctx.fillRect(0, r * cellH, CANVAS.w, cellH);
    }

    ctx.font = `${fontPx}px VT323, monospace`;
    ctx.textBaseline = "alphabetic";
    for (const r of dirty) {
      const row = frame.rows[r] ?? BLANK;
      ctx.fillStyle = row.inv ? bg : textColor(theme, row.c);
      glyphs(row.t, r);
      if (frame.cursor?.row === r) cursor(frame.cursor, row, bg);
    }
    return bands(dirty, cellH);
  }

  function glyphs(text, r) {
    const baseline = r * layout.cellH + layout.cellH * 0.78;
    const n = Math.min(text.length, layout.cols);
    for (let i = 0; i < n; i++) {
      if (text[i] !== " ") ctx.fillText(text[i], i * layout.cellW, baseline);
    }
  }

  function cursor(cur, row, bg) {
    if (cur.col >= layout.cols || cur.mode === "off") return;
    const x = cur.col * layout.cellW;
    const y = cur.row * layout.cellH;
    const color = textColor(theme, row.c);
    if (cur.mode === "hollow") {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 * layout.scale;
      ctx.strokeRect(x + layout.scale, y + layout.scale, layout.cellW - 2 * layout.scale, layout.cellH - 2 * layout.scale);
      return;
    }
    ctx.fillStyle = color;
    ctx.fillRect(x, y, layout.cellW, layout.cellH);
    const ch = row.t[cur.col];
    if (ch && ch !== " ") {
      ctx.fillStyle = bg;
      ctx.fillText(ch, x, y + layout.cellH * 0.78);
    }
  }
}

function signature(row, cursor) {
  const cur = cursor ? `|${cursor.col}${cursor.mode}` : "";
  return `${row.t}|${row.c}|${row.inv ? 1 : 0}${cur}`;
}

// Merges consecutive dirty rows into one band each.
export function bands(dirtyRows, cellH) {
  const out = [];
  for (const r of dirtyRows) {
    const last = out.at(-1);
    if (last && last.end === r) {
      last.end = r + 1;
    } else {
      out.push({ start: r, end: r + 1 });
    }
  }
  return out.map((b) => ({ y: b.start * cellH, h: (b.end - b.start) * cellH }));
}

// Sends changed bands to the GPU with texSubImage2D, then rebuilds the mipmaps.
// Setting needsUpdate on a CanvasTexture would re-upload the whole 4.9 MB canvas.
export function uploadBands(renderer, texture, canvas, list) {
  if (!list.length) return;
  const handle = renderer.properties.get(texture).__webglTexture;
  if (!handle) {
    texture.needsUpdate = true;
    return;
  }
  const gl = renderer.getContext();
  const ctx = canvas.getContext("2d");
  gl.bindTexture(gl.TEXTURE_2D, handle);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  for (const { y, h } of list) {
    const img = ctx.getImageData(0, y, canvas.width, h);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, y, canvas.width, h, gl.RGBA, gl.UNSIGNED_BYTE, img.data);
  }
  gl.generateMipmap(gl.TEXTURE_2D);
  renderer.state.reset();
}
