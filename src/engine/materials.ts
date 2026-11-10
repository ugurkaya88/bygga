import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { PALETTE } from "./palette";

// the drawing's colours come from the brand's palette (palette.ts), Bygga's exactly as they were
export const INK = new THREE.Color(PALETTE.ink);
export const INK_OLD = new THREE.Color(PALETTE.inkOld);
export const TINT_NEW = new THREE.Color(PALETTE.tintNew);

export const FACE: Record<string, THREE.Color> = Object.fromEntries(Object.entries(PALETTE.face).map(([k, v]) => [k, new THREE.Color(v)]));

/** the flat shading steps of faces turned away from the light (the shader's uShade) */
const SHADE = new THREE.Vector3(...PALETTE.shade);

/**
 * How far back a face is pushed at most (mm) so the edge lines and hole marks on it draw over it. The push grows with
 * how steeply the face turns away (as glPolygonOffset's factor does), which at a far zoom on a face seen edge on can
 * reach many mm: enough to let a cam 5 mm under an 18 mm board's face, or the holes on its far face, show through it.
 * Capped in mm, nothing behind a face shows through at any zoom, and a 3 mm back panel still hides its far side.
 */
const FACE_PUSH_MM = 1.5;

const faceVert = /* glsl */ `
varying vec3 vN;
varying float vPushMax;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  // an orthographic camera's depth is linear: window depth per mm is half the projection's z scale
  vPushMax = isOrthographic ? abs(projectionMatrix[2][2]) * 0.5 * ${FACE_PUSH_MM.toFixed(2)} : 1.0;
}`;

const faceFrag = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uTint;
uniform float uTintAmt;
uniform float uOpacity;
uniform vec3 uShade;
varying vec3 vN;
varying float vPushMax;
void main() {
  // pushed back by its depth slope across a pixel, as polygonOffset(1, 1) would, but never more than FACE_PUSH_MM
  float z = gl_FragCoord.z;
  gl_FragDepth = z + min(max(abs(dFdx(z)), abs(dFdy(z))), vPushMax) + 2e-7;
  vec3 n = normalize(vN);
  vec3 L = normalize(vec3(-0.35, 1.0, 0.55));
  float d = dot(n, L);
  float shade = d > 0.72 ? 1.0 : (d > 0.18 ? uShade.x : (d > -0.2 ? uShade.y : uShade.z));
  vec3 c = mix(uColor, uTint, uTintAmt) * shade;
  gl_FragColor = vec4(c, uOpacity);
}`;

export function faceMaterial(color: THREE.Color) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: color.clone() },
      uTint: { value: TINT_NEW.clone() },
      uTintAmt: { value: 0 },
      uOpacity: { value: 1 },
      uShade: { value: SHADE.clone() },
    },
    vertexShader: faceVert,
    fragmentShader: faceFrag,
    transparent: true,
  });
}

const hullVert = /* glsl */ `
attribute vec3 hullDir;
uniform float uWidth;
uniform vec2 uRes;
void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * hullDir);
  vec2 dir = n.xy;
  float l = length(dir);
  dir = l > 1e-4 ? dir / l : vec2(0.0);
  clip.xy += dir * uWidth * 2.0 / uRes * clip.w;
  gl_Position = clip;
}`;
const hullFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
void main() { gl_FragColor = vec4(uColor, uOpacity); }`;

export function hullMaterial(width: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: INK.clone() },
      uOpacity: { value: 1 },
      uWidth: { value: width },
      uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: hullVert,
    fragmentShader: hullFrag,
    side: THREE.BackSide,
    transparent: true,
  });
}

export function lineMaterial(width: number) {
  const m = new LineMaterial({
    color: INK.getHex(),
    linewidth: width,
    worldUnits: false,
    transparent: true,
    dashed: false,
  });
  return m;
}

/** Add an attribute pointing away from the shape centre: used by the screen space outline. */
export function withHullDir(geo: THREE.BufferGeometry, center = new THREE.Vector3()) {
  const pos = geo.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).sub(center);
    if (v.lengthSq() < 1e-8) v.set(0, 1, 0);
    v.normalize();
    arr[i * 3] = v.x;
    arr[i * 3 + 1] = v.y;
    arr[i * 3 + 2] = v.z;
  }
  geo.setAttribute("hullDir", new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Outline direction for cylinders along Y: diagonal at the rims so sides and caps both get a clean outline. */
export function withCylHullDir(geo: THREE.BufferGeometry, cy = 0) {
  const pos = geo.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const rl = Math.hypot(v.x, v.z);
    const rx = rl > 1e-4 ? v.x / rl : 0;
    const rz = rl > 1e-4 ? v.z / rl : 0;
    const ay = v.y - cy >= 0 ? 1 : -1;
    const d = new THREE.Vector3(rx, ay * 0.35, rz);
    if (rl <= 1e-4) d.set(0, ay, 0);
    d.normalize();
    arr[i * 3] = d.x;
    arr[i * 3 + 1] = d.y;
    arr[i * 3 + 2] = d.z;
  }
  geo.setAttribute("hullDir", new THREE.BufferAttribute(arr, 3));
  return geo;
}

/** Outline direction for rounded boxes: the gradient of a superellipsoid, so flat faces push straight out. */
export function withBoxHullDir(geo: THREE.BufferGeometry, hx: number, hy: number, hz: number) {
  const pos = geo.getAttribute("position");
  const arr = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  const k = 7;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const gx = (Math.sign(v.x) * Math.pow(Math.abs(v.x / hx), k)) / hx;
    const gy = (Math.sign(v.y) * Math.pow(Math.abs(v.y / hy), k)) / hy;
    const gz = (Math.sign(v.z) * Math.pow(Math.abs(v.z / hz), k)) / hz;
    v.set(gx, gy, gz);
    if (v.lengthSq() < 1e-12) v.set(0, 1, 0);
    v.normalize();
    arr[i * 3] = v.x;
    arr[i * 3 + 1] = v.y;
    arr[i * 3 + 2] = v.z;
  }
  geo.setAttribute("hullDir", new THREE.BufferAttribute(arr, 3));
  return geo;
}
