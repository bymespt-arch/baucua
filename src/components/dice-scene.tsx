import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { type FaceTriple, type SymbolId, SETTLE_MS, SHAKE_MS, SYMBOLS } from "@/game/logic";
import { FACE_MESH, quaternionForSymbol } from "@/game/pose";
import { playClack, playThud } from "@/game/audio";

const HALF = 0.38;
const SIZE = 0.82;
const FLOOR = 0.5;
const GRAVITY = 16.5;
const SLOTS = [
  new THREE.Vector3(-0.55, FLOOR, -0.12),
  new THREE.Vector3(0.58, FLOOR, -0.02),
  new THREE.Vector3(0.02, FLOOR, 0.48),
];
const SWIRL = 0.62;

function randomLanding(into: Runtime[]) {
  const spot = () => new THREE.Vector3((Math.random() - 0.5) * 1.1, FLOOR, (Math.random() - 0.5) * 0.75);
  const pts = [spot(), spot(), spot()];
  for (let n = 0; n < 6; n++) {
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        if (pts[i]!.distanceTo(pts[j]!) < 0.85) pts[j] = spot();
      }
    }
  }
  into.forEach((die, i) => die.toPos.copy(pts[i]!));
}

type Runtime = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  vel: THREE.Vector3;
  ang: THREE.Vector3;
  fromPos: THREE.Vector3;
  fromQuat: THREE.Quaternion;
  toPos: THREE.Vector3;
  toQuat: THREE.Quaternion;
  squash: number;
  stretch: number;
  bounced: boolean;
  stuck: boolean;
  lastHit: number;
  hang: number;
  released: boolean;
};

const _axesA = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _axesB = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
const _delta = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _best = new THREE.Vector3();
const _cross = new THREE.Vector3();

function fillAxes(q: THREE.Quaternion, out: THREE.Vector3[]) {
  out[0]!.set(1, 0, 0).applyQuaternion(q);
  out[1]!.set(0, 1, 0).applyQuaternion(q);
  out[2]!.set(0, 0, 1).applyQuaternion(q);
}

/** Oriented-box collider. Returns false when the two dice are already apart. */
function pushBoxes(a: Runtime, b: Runtime) {
  fillAxes(a.quat, _axesA);
  fillAxes(b.quat, _axesB);
  _delta.copy(b.pos).sub(a.pos);
  let minPen = Infinity;

  const test = (axis: THREE.Vector3) => {
    const len2 = axis.lengthSq();
    if (len2 < 1e-8) return true;
    _axis.copy(axis).multiplyScalar(1 / Math.sqrt(len2));
    const dist = _delta.dot(_axis);
    const ra = HALF * (Math.abs(_axesA[0]!.dot(_axis)) + Math.abs(_axesA[1]!.dot(_axis)) + Math.abs(_axesA[2]!.dot(_axis)));
    const rb = HALF * (Math.abs(_axesB[0]!.dot(_axis)) + Math.abs(_axesB[1]!.dot(_axis)) + Math.abs(_axesB[2]!.dot(_axis)));
    const pen = ra + rb - Math.abs(dist);
    if (pen <= 0) return false;
    if (pen < minPen) {
      minPen = pen;
      _best.copy(_axis);
      if (dist < 0) _best.negate();
    }
    return true;
  };

  for (let i = 0; i < 3; i++) if (!test(_axesA[i]!)) return;
  for (let i = 0; i < 3; i++) if (!test(_axesB[i]!)) return;
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      _cross.crossVectors(_axesA[i]!, _axesB[j]!);
      if (!test(_cross)) return;
    }
  }
  if (!Number.isFinite(minPen)) return;

  const onFloor = a.pos.y <= FLOOR + 0.05 && b.pos.y <= FLOOR + 0.05;
  if (onFloor) {
    _best.y = 0;
    if (_best.lengthSq() < 1e-8) return;
    _best.normalize();
  }

  const push = minPen + 0.006;
  a.pos.addScaledVector(_best, -push * 0.5);
  b.pos.addScaledVector(_best, push * 0.5);
  if (a.pos.y < FLOOR) a.pos.y = FLOOR;
  if (b.pos.y < FLOOR) b.pos.y = FLOOR;

  const rel = b.vel.dot(_best) - a.vel.dot(_best);
  if (rel < 0) {
    const j = -rel * 0.9;
    a.vel.addScaledVector(_best, -j * 0.5);
    b.vel.addScaledVector(_best, j * 0.5);
    a.ang.x += _best.z * j * 0.6;
    a.ang.z -= _best.x * j * 0.6;
    b.ang.x -= _best.z * j * 0.6;
    b.ang.z += _best.x * j * 0.6;
  }
}
const MOTE_N = 42;
const RING_N = 6;
const _turn = new THREE.Quaternion();
const _inv = new THREE.Quaternion();

function faceGap(die: Runtime) {
  _inv.copy(die.quat).invert();
  _turn.copy(die.toQuat).multiply(_inv);
  if (_turn.w < 0) _turn.set(-_turn.x, -_turn.y, -_turn.z, -_turn.w);
  return 2 * Math.acos(Math.min(1, Math.abs(_turn.w)));
}

/** Nudge spin toward the result face. `impulse` is radians added this step. */
function steerFace(die: Runtime, impulse: number) {
  const angle = faceGap(die);
  const w = Math.min(1, Math.abs(_turn.w));
  const s = Math.sqrt(Math.max(0, 1 - w * w));
  if (angle < 0.02 || s < 1e-5) return angle;
  const k = impulse * Math.min(angle, 1.15);
  die.ang.x += (_turn.x / s) * k;
  die.ang.y += (_turn.y / s) * k;
  die.ang.z += (_turn.z / s) * k;
  return angle;
}

type Impact = { x: number; z: number; age: number; life: number; power: number };
type Mote = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  age: number;
  life: number;
  on: number;
};

function makeImpacts(): Impact[] {
  return Array.from({ length: RING_N }, () => ({ x: 0, z: 0, age: 1, life: 0.48, power: 0 }));
}

function makeMotes(): Mote[] {
  return Array.from({ length: MOTE_N }, () => ({
    x: 0,
    y: -6,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 1,
    life: 0.35,
    on: 0,
  }));
}

type Mode = "idle" | "shake" | "settle";

function makeRuntime(): Runtime[] {
  return SLOTS.map((slot) => ({
    pos: slot.clone(),
    quat: new THREE.Quaternion(),
    vel: new THREE.Vector3(),
    ang: new THREE.Vector3(),
    fromPos: new THREE.Vector3(),
    fromQuat: new THREE.Quaternion(),
    toPos: slot.clone(),
    toQuat: new THREE.Quaternion(),
    squash: 0,
    stretch: 0,
    bounced: false,
    stuck: true,
    lastHit: 0,
    hang: 0,
    released: true,
  }));
}

function easeOutCubic(u: number) {
  return 1 - (1 - u) ** 3;
}

function framedTexture(img: HTMLImageElement, tint: string) {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) return null;
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = "high";
  g.fillStyle = "#fffdf8";
  g.fillRect(0, 0, size, size);

  const probe = document.createElement("canvas");
  probe.width = img.width;
  probe.height = img.height;
  const pg = probe.getContext("2d", { willReadFrequently: true });
  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;
  if (pg) {
    pg.drawImage(img, 0, 0);
    const data = pg.getImageData(0, 0, probe.width, probe.height).data;
    let minX = probe.width;
    let minY = probe.height;
    let maxX = 0;
    let maxY = 0;
    const step = 3;
    for (let y = 0; y < probe.height; y += step) {
      for (let x = 0; x < probe.width; x += step) {
        const i = (y * probe.width + x) * 4;
        if (data[i]! < 246 || data[i + 1]! < 246 || data[i + 2]! < 246) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX > minX && maxY > minY) {
      const pad = Math.round(probe.width * 0.03);
      sx = Math.max(0, minX - pad);
      sy = Math.max(0, minY - pad);
      sw = Math.min(probe.width - sx, maxX - minX + pad * 2);
      sh = Math.min(probe.height - sy, maxY - minY + pad * 2);
      const side = Math.max(sw, sh);
      sx = Math.max(0, sx - (side - sw) / 2);
      sy = Math.max(0, sy - (side - sh) / 2);
      sw = Math.min(probe.width - sx, side);
      sh = Math.min(probe.height - sy, side);
    }
  }

  const pad = 70;
  g.drawImage(img, sx, sy, sw, sh, pad, pad, size - pad * 2, size - pad * 2);
  g.strokeStyle = "#e23d32";
  g.lineWidth = 36;
  g.strokeRect(16, 16, size - 32, size - 32);
  g.strokeStyle = tint;
  g.globalAlpha = 0.0;
  g.strokeRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = src;
  });
}

function useFaceTextures() {
  const [maps, setMaps] = useState<Partial<Record<SymbolId, THREE.Texture>>>({});

  useEffect(() => {
    let dead = false;
    const created: THREE.Texture[] = [];
    void (async () => {
      const next: Partial<Record<SymbolId, THREE.Texture>> = {};
      await Promise.all(
        SYMBOLS.map(async (s) => {
          try {
            const img = await loadImage(`/faces/${s.id}.jpg`);
            if (dead) return;
            const tex = framedTexture(img, s.tone);
            if (tex) {
              next[s.id] = tex;
              created.push(tex);
            }
          } catch {
            /* tinted cube still reads */
          }
        }),
      );
      if (!dead) setMaps(next);
    })();
    return () => {
      dead = true;
      created.forEach((tex) => tex.dispose());
    };
  }, []);

  return maps;
}

function Die({
  index,
  textures,
  groups,
}: {
  index: number;
  textures: Partial<Record<SymbolId, THREE.Texture>>;
  groups: MutableRefObject<(THREE.Group | null)[]>;
}) {
  return (
    <group ref={(node) => { groups.current[index] = node; }}>
      <mesh>
        <boxGeometry args={[0.78, 0.78, 0.78]} />
        <meshStandardMaterial color="#fffaf4" roughness={0.48} />
      </mesh>
      {FACE_MESH.map((face) => (
        <mesh key={face.id} position={face.position} rotation={face.rot}>
          <planeGeometry args={[0.9, 0.9]} />
          <meshStandardMaterial
            key={textures[face.id] ? `${face.id}-tex` : `${face.id}-flat`}
            map={textures[face.id] ?? null}
            color={textures[face.id] ? "#ffffff" : (SYMBOLS.find((s) => s.id === face.id)?.tone ?? "#ffffff")}
            roughness={0.55}
            metalness={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function TableScene({
  faces,
  shakeId,
  reduce,
  sound,
  onSettled,
}: {
  faces: FaceTriple;
  shakeId: number;
  reduce: boolean;
  sound: boolean;
  onSettled: (id: number) => void;
}) {
  const textures = useFaceTextures();
  const groups = useRef<(THREE.Group | null)[]>([]);
  const bowl = useRef<THREE.Group>(null);
  const rig = useRef<THREE.Group>(null);
  const runtime = useRef<Runtime[]>(makeRuntime());
  const mode = useRef<Mode>("idle");
  const elapsed = useRef(0);
  const kickAt = useRef(0);
  const lastClack = useRef(0);
  const settledFor = useRef(0);
  const facesRef = useRef(faces);
  const soundRef = useRef(sound);
  const reduceRef = useRef(reduce);
  const onSettledRef = useRef(onSettled);
  const impacts = useRef<Impact[]>(makeImpacts());
  const motes = useRef<Mote[]>(makeMotes());
  const ringCursor = useRef(0);
  const moteCursor = useRef(0);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const shadows = useRef<(THREE.Mesh | null)[]>([]);
  const moteMesh = useRef<THREE.InstancedMesh>(null);
  const flashLight = useRef<THREE.PointLight>(null);
  const landKick = useRef(0);
  const flash = useRef(0);
  const restHold = useRef(0);
  facesRef.current = faces;
  soundRef.current = sound;
  reduceRef.current = reduce;
  onSettledRef.current = onSettled;

  const moteGeo = useMemo(() => new THREE.SphereGeometry(0.072, 7, 6), []);
  const moteMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: "#e2a84a", transparent: true, opacity: 0.92, depthWrite: false }),
    [],
  );
  useEffect(() => {
    return () => {
      moteGeo.dispose();
      moteMat.dispose();
    };
  }, [moteGeo, moteMat]);

  const tmp = useMemo(
    () => ({
      axis: new THREE.Vector3(),
      spin: new THREE.Quaternion(),
      delta: new THREE.Vector3(),
      dummy: new THREE.Object3D(),
      ndc: new THREE.Vector3(),
    }),
    [],
  );

  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 5.5, 3.55);
    camera.lookAt(0, 0.12, 0.02);
    if (camera instanceof THREE.PerspectiveCamera) camera.fov = 30;
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    const mesh = moteMesh.current;
    if (!mesh) return;
    for (let i = 0; i < MOTE_N; i++) {
      tmp.dummy.position.set(0, -8, 0);
      tmp.dummy.scale.setScalar(0);
      tmp.dummy.updateMatrix();
      mesh.setMatrixAt(i, tmp.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [tmp]);

  const snap = (next: FaceTriple) => {
    runtime.current.forEach((die, i) => {
      die.pos.copy(SLOTS[i]!);
      die.vel.set(0, 0, 0);
      die.ang.set(0, 0, 0);
      die.squash = 0;
      die.stretch = 0;
      die.bounced = false;
      die.stuck = true;
      const yaw = (i - 1) * 0.28;
      quaternionForSymbol(next[i]!, yaw, die.quat);
      const g = groups.current[i];
      if (g) {
        g.position.copy(die.pos);
        g.quaternion.copy(die.quat);
        g.scale.set(1, 1, 1);
      }
    });
  };

  useEffect(() => {
    if (mode.current !== "idle") return;
    if (shakeId !== 0 && shakeId !== settledFor.current) return;
    snap(faces);
  }, [faces, shakeId]);

  useEffect(() => {
    if (shakeId === 0 || shakeId === settledFor.current) return;
    const dice = runtime.current;
    dice.forEach((die, i) => {
      die.hang = 0;
      die.released = false;
      die.pos.set(i === 0 ? -0.2 : 0.2, FLOOR + 0.35, 0);
      die.vel.set(0, 0, 0);
      die.ang.set(i === 0 ? 12 : -12, i === 0 ? 8 : -8, 10);
      die.squash = 0;
      die.stretch = 0;
      die.bounced = false;
      die.stuck = false;
      quaternionForSymbol(facesRef.current[i]!, (Math.random() - 0.5) * Math.PI, die.toQuat);
      if (die.quat.dot(die.toQuat) < 0) die.toQuat.set(-die.toQuat.x, -die.toQuat.y, -die.toQuat.z, -die.toQuat.w);
      die.fromPos.copy(die.pos);
      die.fromQuat.copy(die.quat);
    });
    randomLanding(dice);
    mode.current = "shake";
    elapsed.current = 0;
    kickAt.current = 0;
    restHold.current = 0;
  }, [shakeId]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const dice = runtime.current;
    const shakeLen = (reduceRef.current ? 280 : SHAKE_MS) / 1000;
    const settleLen = (reduceRef.current ? 420 : SETTLE_MS) / 1000;
    const nowMs = performance.now();

    const burst = (x: number, z: number, power: number) => {
      if (reduceRef.current) return;
      const hit = impacts.current[ringCursor.current % RING_N]!;
      ringCursor.current += 1;
      hit.x = x;
      hit.z = z;
      hit.age = 0;
      hit.life = 0.46;
      hit.power = power;
      for (let k = 0; k < 7; k++) {
        const m = motes.current[moteCursor.current % MOTE_N]!;
        moteCursor.current += 1;
        const a = (k / 7) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const sp = (0.85 + Math.random() * 1.35) * (0.6 + power * 0.7);
        m.x = x + Math.cos(a) * 0.05;
        m.y = FLOOR + 0.05;
        m.z = z + Math.sin(a) * 0.05;
        m.vx = Math.cos(a) * sp;
        m.vz = Math.sin(a) * sp;
        m.vy = 1.3 + Math.random() * 2.1 * power;
        m.age = 0;
        m.life = 0.32 + Math.random() * 0.18;
        m.on = 1;
      }
      landKick.current = Math.min(1, landKick.current + power * 0.62);
      flash.current = Math.min(1, flash.current + power * 0.75);
    };

    const keepInside = (die: Runtime) => {
      tmp.ndc.copy(die.pos).project(camera);
      const x = tmp.ndc.x;
      const y = tmp.ndc.y;
      if (x > 0.56) {
        die.pos.x -= (x - 0.56) * 1.7;
        if (die.vel.x > 0) die.vel.x *= -0.32;
      } else if (x < -0.56) {
        die.pos.x += (-0.56 - x) * 1.7;
        if (die.vel.x < 0) die.vel.x *= -0.32;
      }
      if (y > 0.4) {
        const over = y - 0.4;
        die.pos.y -= over * 1.35;
        if (die.pos.y < FLOOR) die.pos.y = FLOOR;
        if (die.vel.y > 0) die.vel.y *= -0.22;
      } else if (y < -0.5 && die.vel.z > 0) {
        die.pos.z -= (-0.5 - y) * 1.6;
        die.vel.z *= -0.28;
      }
    };

    const land = (die: Runtime, impact: number) => {
      die.squash = Math.min(0.5, 0.12 + impact / 14);
      die.stretch = 0;
      if (impact < 0.9 || reduceRef.current) return;
      if (nowMs - die.lastHit < 100) return;
      die.lastHit = nowMs;
      burst(die.pos.x, die.pos.z, Math.min(0.45, impact / 16));
      if (soundRef.current && nowMs - lastClack.current > 70) {
        lastClack.current = nowMs;
        if (impact > 2.2) playClack(Math.min(1, impact / 8));
        else playThud(Math.min(0.8, impact / 7));
      }
    };

    const spin = (die: Runtime) => {
      const speed = die.ang.length();
      if (speed < 0.001) return;
      tmp.axis.copy(die.ang).multiplyScalar(1 / speed);
      tmp.spin.setFromAxisAngle(tmp.axis, speed * dt);
      die.quat.premultiply(tmp.spin).normalize();
    };

    const separate = () => {
      for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < dice.length; i++) {
          for (let j = i + 1; j < dice.length; j++) pushBoxes(dice[i]!, dice[j]!);
        }
      }
    };

    const finish = () => {
      for (const die of dice) {
        if (faceGap(die) < 0.35) die.quat.copy(die.toQuat);
        die.vel.set(0, 0, 0);
        die.ang.set(0, 0, 0);
        die.stretch = 0;
        die.pos.y = FLOOR;
        die.stuck = true;
      }
      separate();
      for (const die of dice) die.pos.y = FLOOR;
      mode.current = "idle";
      const id = shakeId;
      if (settledFor.current !== id) {
        settledFor.current = id;
        onSettledRef.current(id);
      }
    };

    if (mode.current === "shake") {
      elapsed.current += dt;
      if (reduceRef.current) {
        const u = Math.min(1, elapsed.current / settleLen);
        const e = easeOutCubic(u);
        for (const die of dice) {
          die.pos.lerpVectors(die.fromPos, die.toPos, e);
          die.quat.slerpQuaternions(die.fromQuat, die.toQuat, e);
          die.squash = 0;
          die.stretch = 0;
        }
        if (u >= 1) {
          if (soundRef.current) playClack(0.8);
          finish();
        }
      } else if (elapsed.current < SWIRL) {
        const u = elapsed.current / SWIRL;
        const turn = u * Math.PI * 2.4;
        for (const [i, die] of dice.entries()) {
          const a = turn + i * ((Math.PI * 2) / 3);
          const r = 0.16 + u * 0.38;
          die.pos.set(Math.cos(a) * r, FLOOR + 0.22 + Math.sin(u * Math.PI) * 0.48, Math.sin(a) * r * 0.6);
          die.ang.set(i === 0 ? 16 : -16, i === 0 ? 10 : -10, 12);
          die.stretch = 0.035;
          die.squash = 0;
          spin(die);
        }
      } else {
        if (!dice[0]?.released) {
          for (const die of dice) {
            die.released = true;
            const flight = 0.5;
            die.vel.set(
              (die.toPos.x - die.pos.x) / flight,
              1.85 + Math.random() * 0.45,
              (die.toPos.z - die.pos.z) / flight,
            );
            die.ang.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 18);
          }
        }
        let resting = 0;
        for (const die of dice) {
          if (die.stuck) {
            die.pos.y = FLOOR;
            die.vel.set(0, 0, 0);
            die.ang.set(0, 0, 0);
            die.stretch = 0;
            die.squash = Math.max(0, die.squash - dt * 3);
            die.quat.slerp(die.toQuat, 1 - Math.exp(-3.2 * dt));
            resting += 1;
            continue;
          }
          die.vel.y -= GRAVITY * dt;
          die.pos.addScaledVector(die.vel, dt);
          let grounded = false;
          if (die.pos.y <= FLOOR) {
            const impact = Math.max(0, -die.vel.y);
            die.pos.y = FLOOR;
            grounded = true;
            if (impact > 0.85) {
              die.vel.y = impact * 0.28;
              die.vel.x *= 0.8;
              die.vel.z *= 0.8;
              die.ang.x = die.ang.x * 0.55 + die.vel.z * 1.6;
              die.ang.z = die.ang.z * 0.55 - die.vel.x * 1.6;
              die.ang.y *= 0.7;
              land(die, impact);
            } else {
              die.vel.y = 0;
              const drag = Math.min(0.4, 7 * dt);
              die.vel.x *= 1 - drag;
              die.vel.z *= 1 - drag;
              const gap = faceGap(die);
              die.ang.multiplyScalar(Math.exp(-(gap < 0.4 ? 5.5 : 1.4) * dt));
              steerFace(die, (gap < 0.45 ? 5 : 9) * dt);
              if (impact > 0.28) land(die, impact);
              else die.squash = Math.max(0, die.squash - dt * 5);
            }
          } else {
            die.stretch = Math.min(0.06, Math.max(0, -die.vel.y) * 0.006);
            die.squash = Math.max(0, die.squash - dt * 5);
          }
          keepInside(die);
          spin(die);
          const slide = Math.hypot(die.vel.x, die.vel.z);
          const gap = grounded && die.vel.y === 0 ? faceGap(die) : Math.PI;
          const calm = grounded && die.vel.y === 0 && slide < 0.1 && die.ang.length() < 0.7 && gap < 0.38;
          if (calm) {
            die.hang += dt;
            if (gap < 0.28) die.quat.slerp(die.toQuat, 1 - Math.exp(-2.4 * dt));
          } else {
            die.hang = 0;
          }
          if ((die.hang > 0.2 && gap < 0.22) || elapsed.current > shakeLen + 1.35) {
            die.vel.set(0, 0, 0);
            die.ang.set(0, 0, 0);
            die.pos.y = FLOOR;
            die.stuck = true;
          }
        }
        if (resting < dice.length) {
          separate();
          for (const die of dice) {
            if (die.pos.y < FLOOR) die.pos.y = FLOOR;
            keepInside(die);
          }
        }
        if (resting === dice.length) restHold.current += dt;
        else restHold.current = 0;
        if (restHold.current > 0.45 || elapsed.current > shakeLen + 1.7) finish();
      }
    }

    landKick.current = Math.max(0, landKick.current - dt * 2.5);
    flash.current = Math.max(0, flash.current - dt * 3.6);
    for (let i = 0; i < RING_N; i++) {
      const hit = impacts.current[i]!;
      if (hit.age < hit.life) hit.age += dt;
      const ring = rings.current[i];
      if (!ring) continue;
      const u = hit.age / hit.life;
      const alive = u < 1 && hit.power > 0;
      ring.visible = alive;
      if (!alive) continue;
      const spread = 0.55 + u * (1.8 + hit.power * 2.1);
      ring.scale.set(spread, spread, spread);
      ring.position.set(hit.x, 0.09, hit.z);
      const mat = ring.material;
      if (!Array.isArray(mat)) mat.opacity = (1 - u) * (0.72 + hit.power * 0.28);
    }

    const mesh = moteMesh.current;
    if (mesh) {
      const dummy = tmp.dummy;
      for (let i = 0; i < MOTE_N; i++) {
        const m = motes.current[i]!;
        if (m.on) {
          m.age += dt;
          if (m.age >= m.life) m.on = 0;
          else {
            m.vy -= 11 * dt;
            m.x += m.vx * dt;
            m.y += m.vy * dt;
            m.z += m.vz * dt;
            if (m.y < FLOOR + 0.03) {
              m.y = FLOOR + 0.03;
              m.vy = Math.abs(m.vy) * 0.22;
              m.vx *= 0.55;
              m.vz *= 0.55;
            }
          }
        }
        const u = m.on ? m.age / m.life : 1;
        const s = m.on ? (1 - u) * (0.85 + (i % 3) * 0.35) : 0;
        dummy.position.set(m.x, m.on ? m.y : -8, m.z);
        dummy.scale.setScalar(s);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    dice.forEach((die, i) => {
      const shadow = shadows.current[i];
      if (shadow) {
        const h = Math.max(0, die.pos.y - FLOOR);
        const s = Math.max(0.32, (0.92 - h * 0.38) * SIZE);
        shadow.position.set(die.pos.x, 0.07, die.pos.z);
        shadow.scale.set(s, s, 1);
        const mat = shadow.material;
        if (!Array.isArray(mat)) mat.opacity = Math.max(0.05, 0.36 - h * 0.18);
      }
      const g = groups.current[i];
      if (!g) return;
      g.position.copy(die.pos);
      g.quaternion.copy(die.quat);
      const sq = die.squash;
      const st = die.stretch;
      g.scale.set(
        SIZE * (1 + sq * 0.1 - st * 0.04),
        SIZE * (1 - sq * 0.14 + st * 0.08),
        SIZE * (1 + sq * 0.1 - st * 0.04),
      );
    });

    const kick = reduceRef.current ? 0 : landKick.current * landKick.current;
    const t = performance.now() / 1000;
    if (rig.current) {
      rig.current.position.x = 0;
      rig.current.position.y = -kick * 0.045;
      rig.current.rotation.z = Math.sin(t * 48) * kick * 0.01;
    }
    if (flashLight.current) flashLight.current.intensity = flash.current * 3.2;
  });

  return (
    <group ref={rig}>
      <pointLight ref={flashLight} position={[0, 1.6, 0.2]} color="#ffe2b0" distance={7} decay={2} intensity={0} />
      <group ref={bowl}>
        {runtime.current.map((_, i) => (
          <mesh
            key={`shadow-${i}`}
            ref={(node) => {
              shadows.current[i] = node;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[SLOTS[i]!.x, 0.064, SLOTS[i]!.z]}
          >
            <circleGeometry args={[0.46, 28]} />
            <meshBasicMaterial color="#6a5040" transparent opacity={0.3} depthWrite={false} />
          </mesh>
        ))}
        {impacts.current.map((_, i) => (
          <mesh
            key={`ring-${i}`}
            ref={(node) => {
              rings.current[i] = node;
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            visible={false}
          >
            <ringGeometry args={[0.18, 0.5, 48]} />
            <meshBasicMaterial color="#8a5330" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <instancedMesh ref={moteMesh} args={[moteGeo, moteMat, MOTE_N]} frustumCulled={false} />
        {runtime.current.map((_, i) => (
          <Die key={i} index={i} textures={textures} groups={groups} />
        ))}
      </group>
    </group>
  );
}

export function DiceScene(props: {
  faces: FaceTriple;
  shakeId: number;
  reduce: boolean;
  sound: boolean;
  onSettled: (id: number) => void;
}) {
  return (
    <Canvas
      className="dice-canvas"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", touchAction: "none" }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 5.5, 3.55], fov: 30, near: 0.1, far: 40 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
    >
      <ambientLight intensity={0.82} />
      <directionalLight position={[3.2, 7.5, 2.4]} intensity={1.2} color="#fff7ee" />
      <directionalLight position={[-3.5, 4, -1.5]} intensity={0.34} color="#e7eef8" />
      <TableScene {...props} />
    </Canvas>
  );
}
