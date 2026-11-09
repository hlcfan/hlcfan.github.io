// Loads the terminal font and sizes it to the cell.
export async function loadFont(base = "") {
  try {
    const face = new FontFace("VT323", `url(${base}/assets/fonts/vt323-subset.woff2)`);
    await face.load();
    document.fonts.add(face);
    return true;
  } catch {
    return false;
  }
}

// Font size in px so one glyph advances exactly `cellW` pixels.
export function fitFontSize(ctx, cellW) {
  ctx.font = "100px VT323, monospace";
  const advance = ctx.measureText("M").width || 50;
  return (100 * cellW) / advance;
}
