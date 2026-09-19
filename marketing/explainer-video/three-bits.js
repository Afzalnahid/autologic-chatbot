// The 3D pieces of the film: the logo mark extruded into a solid object, and
// the four channel "coins" that orbit it. Everything here is driven by a time
// value the renderer hands in, never by a clock, so a frame at t is the same
// frame every time it is asked for.
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { markSvg, PLUM, INK } from "/src/lib/brand-mark.js";

const W = 1920, H = 1080;

export function makeStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.style.cssText = "position:absolute;left:0;top:0;width:1920px;height:1080px";
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(30, W / H, 1, 6000);
  camera.position.set(0, 0, 1500);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7080, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(500, 700, 900); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd6e0, 0.9); rim.position.set(-700, -200, -400); scene.add(rim);
  return { renderer, scene, camera, render: () => renderer.render(scene, camera) };
}

// The logo as a solid: the two ring halves, ears, antenna extruded from the
// SVG; the "^ ^" eyes (a stroked path in the SVG) as two half-tori.
export function buildLogo({ color = PLUM, ink = INK, depth = 30 } = {}) {
  const data = new SVGLoader().parse(markSvg({ size: 512, color, ink }));
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.18, roughness: 0.36 });
  const inkMat = new THREE.MeshStandardMaterial({ color: ink, metalness: 0.25, roughness: 0.45 });
  for (const p of data.paths) {
    const fill = p.userData?.style?.fill;
    if (!fill || fill === "none") continue;              // the stroked eyes: drawn below
    const isInk = fill.toLowerCase() === ink.toLowerCase();
    const shapes = p.toShapes(true);
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: isInk ? depth + 10 : depth, bevelEnabled: true, bevelThickness: 3, bevelSize: 2.5, bevelSegments: 5, curveSegments: 28 });
    const m = new THREE.Mesh(geo, isInk ? inkMat : bodyMat);
    if (isInk) m.position.z = -5;
    g.add(m);
  }
  for (const cx of [447, 577]) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(23, 6.5, 16, 40, Math.PI), inkMat);
    eye.position.set(cx, 514, depth + 6);
    g.add(eye);
  }
  // Centre on the mark and flip SVG's y-down into three's y-up.
  const box = new THREE.Box3().setFromObject(g);
  const c = box.getCenter(new THREE.Vector3());
  g.children.forEach((m) => m.position.sub(c));
  g.scale.set(1, -1, 1);
  const wrap = new THREE.Group();
  wrap.add(g);
  return wrap;
}

// A flat coin with a channel glyph on its face. `draw(ctx, size)` paints the glyph.
export function makeCoin(draw, { size = 112, rim = "#7B1C3E", face = "#ffffff" } = {}) {
  const cv = document.createElement("canvas"); cv.width = cv.height = 512;
  const ctx = cv.getContext("2d");
  ctx.fillStyle = face; ctx.beginPath(); ctx.arc(256, 256, 256, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(256, 256); draw(ctx, 512); ctx.restore();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const faceMat = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.05, roughness: 0.5 });
  const rimMat = new THREE.MeshStandardMaterial({ color: rim, metalness: 0.3, roughness: 0.35 });
  const geo = new THREE.CylinderGeometry(size, size, 18, 64);
  const coin = new THREE.Mesh(geo, [rimMat, faceMat, faceMat]);
  coin.rotation.x = Math.PI / 2;                        // face towards the camera
  const wrap = new THREE.Group(); wrap.add(coin);
  return wrap;
}

// Draws a Tabler outline icon (24-unit path data) centred, stroked.
export function glyph(paths, color = "#7B1C3E") {
  return (ctx, size) => {
    const s = size * 0.55 / 24;
    ctx.scale(s, s); ctx.translate(-12, -12);
    ctx.strokeStyle = color; ctx.lineWidth = 1.9; ctx.lineCap = "round"; ctx.lineJoin = "round";
    for (const d of paths) ctx.stroke(new Path2D(d));
  };
}

export const ease = {
  outCubic: (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3),
  inOut: (x) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  outBack: (x) => { x = Math.min(1, Math.max(0, x)); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};
