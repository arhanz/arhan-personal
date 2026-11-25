import * as THREE from "three";

export type SceneState = "idle" | "typing" | "password" | "error" | "success";
export type Scene = { set: (s: SceneState) => void; theme: (dark: boolean) => void; dispose: () => void };

const noop: Scene = { set() {}, theme() {}, dispose() {} };

export function initScene(cv: HTMLCanvasElement): Scene | null {
  let ren: THREE.WebGLRenderer;
  try {
    ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  } catch {
    return null;
  }
  ren.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new THREE.Scene();
  const cam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  cam.position.z = 11;
  // newer three uses physical light units, so scale up to match the old look
  scene.add(new THREE.AmbientLight(0xffffff, 0.75 * Math.PI));
  const dl = new THREE.DirectionalLight(0xffffff, 0.9 * Math.PI);
  dl.position.set(3, 4, 6);
  scene.add(dl);
  const G = new THREE.Group();
  scene.add(G);

  const CANDY = new THREE.Color(0x4cc9ff), DEEP = new THREE.Color(0x0b6fa0);
  const GREEN = new THREE.Color(0x22c55e), RED = new THREE.Color(0xef4444);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 1), new THREE.MeshPhongMaterial({ color: 0x4cc9ff, flatShading: true, shininess: 70 }));
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(2, 1), new THREE.MeshBasicMaterial({ color: 0x0b7fb8, wireframe: true, transparent: true, opacity: 0.4 }));
  G.add(core, wire);
  const rings = [0, 1, 2].map((i) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(2.8 + i * 0.6, 0.035, 8, 140), new THREE.MeshBasicMaterial({ color: 0x0b7fb8, transparent: true, opacity: 0.75 }));
    m.rotation.set(1.1 * i, 0.5 * i, 0.7 * i);
    G.add(m);
    return m;
  });
  const geos = [new THREE.OctahedronGeometry(0.2), new THREE.TetrahedronGeometry(0.24), new THREE.BoxGeometry(0.2, 0.2, 0.2)];
  const shards: THREE.Mesh[] = [];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(geos[i % 3], new THREE.MeshPhongMaterial({ color: i % 2 ? 0x4cc9ff : 0x0b7fb8, flatShading: true }));
    m.userData = { r: 3.6 + Math.random() * 2.2, a: Math.random() * 6.283, y: (Math.random() - 0.5) * 3.6, s: 0.15 + Math.random() * 0.35, rs: (Math.random() - 0.5) * 2 };
    G.add(m);
    shards.push(m);
  }

  const S = { speed: 1, spread: 1, col: CANDY.clone(), burst: 0, shake: 0 };
  const T = { speed: 1, spread: 1, col: CANDY.clone() };
  const states: Record<SceneState, () => void> = {
    idle: () => { T.speed = 1; T.spread = 1; T.col = CANDY; },
    typing: () => { T.speed = 2.4; T.spread = 1.08; T.col = CANDY; },
    password: () => { T.speed = 0.35; T.spread = 0.72; T.col = DEEP; },
    error: () => { T.speed = 0.5; T.spread = 0.9; T.col = RED; S.shake = 1; },
    success: () => { T.speed = 3; T.spread = 1.2; T.col = GREEN; S.burst = 1; },
  };

  let mx = 0, my = 0;
  const size = () => {
    const w = window.innerWidth, h = window.innerHeight;
    ren.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    const halfW = Math.tan((cam.fov * Math.PI) / 360) * cam.position.z * cam.aspect;
    if (w > 900) { G.position.set(-halfW * 0.5, 0.35, 0); G.scale.setScalar(1); }
    else { G.position.set(0, 2.4, -1.5); G.scale.setScalar(0.62); }
  };
  const onMove = (e: PointerEvent) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5; };
  window.addEventListener("resize", size);
  window.addEventListener("pointermove", onMove, { passive: true });
  size();

  let last = 0, raf = 0, alive = true;
  const frame = (t: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((t - last) / 1000 || 0.016, 0.05);
    last = t;
    S.speed += (T.speed - S.speed) * 0.06;
    S.spread += (T.spread - S.spread) * 0.07;
    S.col.lerp(T.col, 0.07);
    S.burst *= 0.94;
    S.shake *= 0.9;
    (core.material as THREE.MeshPhongMaterial).color.copy(S.col);
    (wire.material as THREE.MeshBasicMaterial).color.copy(S.col).multiplyScalar(0.75);
    const sp = S.speed * dt;
    core.rotation.y += sp * 0.6; core.rotation.x += sp * 0.3;
    wire.rotation.y -= sp * 0.4; wire.rotation.z += sp * 0.2;
    const k = S.spread + S.burst * 0.9 + Math.sin(t * 0.001) * 0.02;
    rings.forEach((r, i) => {
      r.rotation.x += sp * (0.25 + i * 0.1);
      r.rotation.y += sp * (0.18 - i * 0.05);
      r.scale.setScalar(k);
      (r.material as THREE.MeshBasicMaterial).color.copy(S.col).multiplyScalar(0.8);
    });
    shards.forEach((m) => {
      const u = m.userData;
      u.a += sp * u.s;
      const rr = u.r * k;
      m.position.set(Math.cos(u.a) * rr, u.y + Math.sin(u.a * 2) * 0.2, Math.sin(u.a) * rr);
      m.rotation.x += sp * u.rs; m.rotation.y += sp * u.rs * 0.7;
    });
    G.rotation.y += (mx * 0.6 - G.rotation.y) * 0.04 + (S.shake ? Math.sin(t * 0.06) * 0.03 * S.shake : 0);
    G.rotation.x += (my * 0.4 - G.rotation.x) * 0.04;
    ren.render(scene, cam);
  };
  raf = requestAnimationFrame(frame);

  return {
    set: (s) => states[s]?.(),
    theme: (dark) => { (wire.material as THREE.MeshBasicMaterial).opacity = dark ? 0.55 : 0.4; },
    dispose: () => {
      alive = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
      window.removeEventListener("pointermove", onMove);
      ren.dispose();
    },
  };
}
export { noop };
