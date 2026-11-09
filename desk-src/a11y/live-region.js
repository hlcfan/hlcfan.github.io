// Mirrors terminal output into a visually hidden aria-live region.
// Prompts and the boot log are not mirrored. A long block is one element.
const MAX_BLOCKS = 40;

export function createLiveRegion(root = document.body) {
  const region = document.createElement("div");
  region.className = "sr-only";
  region.setAttribute("aria-live", "polite");
  region.setAttribute("role", "log");
  region.setAttribute("aria-label", "Terminal output");
  root.appendChild(region);

  return { announce, clear };

  // `label` names a long block, for example the post title of a `cat`.
  function announce(lines, label = "") {
    const text = Array.isArray(lines) ? lines.join("\n") : String(lines);
    if (!text.trim()) return;
    const block = document.createElement("div");
    if (label && text.split("\n").length > 8) {
      block.setAttribute("role", "group");
      block.setAttribute("aria-label", label);
    }
    block.textContent = text;
    region.appendChild(block);
    while (region.childElementCount > MAX_BLOCKS) region.firstElementChild.remove();
  }

  function clear() {
    region.replaceChildren();
  }
}
