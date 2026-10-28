import * as THREE from "three";
import type { SymbolId } from "@/game/logic";

/** Plane local +Z becomes the outward normal. Image up is plane +Y. */
export const FACE_DEFS: { id: SymbolId; rot: [number, number, number] }[] = [
  { id: "cua", rot: [0, Math.PI / 2, 0] },
  { id: "tom", rot: [0, -Math.PI / 2, 0] },
  { id: "bau", rot: [-Math.PI / 2, 0, 0] },
  { id: "ca", rot: [Math.PI / 2, 0, 0] },
  { id: "ga", rot: [0, 0, 0] },
  { id: "nai", rot: [0, Math.PI, 0] },
];

const OFFSET = 0.47;

function basis(rot: [number, number, number]) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  const imageUp = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  return { normal, imageUp };
}

export const FACE_MESH = FACE_DEFS.map((face) => {
  const { normal, imageUp } = basis(face.rot);
  return {
    id: face.id,
    rot: face.rot,
    position: normal.clone().multiplyScalar(OFFSET),
    normal,
    imageUp,
  };
});

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Lay `id` flat on top, picture upright toward the camera, plus a small yaw. */
export function quaternionForSymbol(id: SymbolId, yaw: number, out: THREE.Quaternion) {
  const face = FACE_MESH.find((f) => f.id === id) ?? FACE_MESH[0]!;
  const align = new THREE.Quaternion().setFromUnitVectors(face.normal, WORLD_UP);
  const up = face.imageUp.clone().applyQuaternion(align);
  const target = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw));
  let delta = Math.atan2(target.x, target.z) - Math.atan2(up.x, up.z);
  delta = Math.atan2(Math.sin(delta), Math.cos(delta));
  return out.setFromAxisAngle(WORLD_UP, delta).multiply(align);
}
