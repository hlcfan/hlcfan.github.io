// Loader: feature detection, then a dynamic import of the scene chunk.
import { showFallback } from "./fallback.js";

bindSkipLink();
boot();

async function boot() {
  if (!hasWebGL2() || saveDataOn()) {
    showFallback();
    return;
  }
  try {
    const { startDesk } = await import("./desk.js");
    const canvas = document.getElementById("desk-canvas");
    await startDesk(canvas, { onFatal: showFallback });
    document.documentElement.classList.add("scene-on");
    document.documentElement.classList.remove("scene-pending");
  } catch (err) {
    console.error("desk scene failed", err);
    showFallback();
  }
}

function hasWebGL2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

function saveDataOn() {
  return !!(navigator.connection && navigator.connection.saveData);
}

// "Skip to posts" and the Posts nav link show the plain list even when the scene is on.
function bindSkipLink() {
  for (const id of ["skip-link", "nav-posts"]) {
    document.getElementById(id)?.addEventListener("click", () => {
      document.documentElement.classList.add("list-open");
    });
  }
}
