// The desk, the cutting mat, and the fake contact shadows used under objects.
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry } from "three";
import { drawTexture, rng } from "./canvas.js";

export function buildDesk() {
  const group = new Group();
  group.name = "desk";

  const top = new Mesh(
    new BoxGeometry(260, 4, 150),
    new MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 }),
  );
  top.position.set(0, -2, 0);
  group.add(top);

  const mat = new Mesh(
    new BoxGeometry(92, 0.3, 56),
    new MeshStandardMaterial({ color: 0x244a38, roughness: 0.85 }),
  );
  mat.position.set(0, 0.15, 4);
  group.add(mat);

  return group;
}

// A soft dark blob on the surface below an object. Cheap, and right at this camera distance.
export function buildContactShadow(width, depth, opacity = 0.55) {
  const tex = drawTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, w * 0.18, w / 2, h / 2, w * 0.5);
    g.addColorStop(0, `rgba(0,0,0,${opacity})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
  const mesh = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return mesh;
}

function woodTexture() {
  return drawTexture(1024, 512, (ctx, w, h) => {
    const rand = rng(7);
    ctx.fillStyle = "#4a3321";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      const y = rand() * h;
      const light = 22 + rand() * 16;
      ctx.strokeStyle = `hsla(26, 38%, ${light}%, ${0.15 + rand() * 0.25})`;
      ctx.lineWidth = 0.6 + rand() * 2.2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) ctx.lineTo(x, y + Math.sin(x * 0.01 + i) * (2 + rand() * 4));
      ctx.stroke();
    }
  });
}
