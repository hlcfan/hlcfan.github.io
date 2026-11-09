// The plain post list is real HTML. Showing it means never adding `scene-on`
// and opening the list explicitly.
export function showFallback() {
  const root = document.documentElement;
  root.classList.remove("scene-on", "scene-pending");
  root.classList.add("list-open");
}
