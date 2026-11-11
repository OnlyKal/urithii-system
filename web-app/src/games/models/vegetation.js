import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Géométries procédurales (style « low poly ») de la végétation et des
// rochers. Chaque modèle est fusionné en une seule géométrie colorée par
// sommet, puis dessiné en de nombreuses instances (InstancedMesh) : un appel
// de rendu par espèce, quel que soit le nombre d'arbres.

const tmpColor = new THREE.Color()

// Prépare une pièce : sans indices ni UV, couleur par sommet légèrement variée.
function part(geometry, color, { jitter = 0.06, at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const g = geometry.index ? geometry.toNonIndexed() : geometry
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  g.scale(...scale)
  g.rotateX(rot[0])
  g.rotateY(rot[1])
  g.rotateZ(rot[2])
  g.translate(...at)
  const base = new THREE.Color(color)
  const count = g.attributes.position.count
  const colors = new Float32Array(count * 3)
  // Une teinte par face (3 sommets) : facettes visibles, rendu « artisanal ».
  for (let i = 0; i < count; i += 3) {
    const k = 1 + (Math.sin(i * 12.9898 + count) * 0.5) * jitter * 2
    tmpColor.copy(base).multiplyScalar(k)
    for (let j = 0; j < 3 && i + j < count; j++) colors.set([tmpColor.r, tmpColor.g, tmpColor.b], (i + j) * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

const merge = (parts) => {
  const g = mergeGeometries(parts)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  return g
}

// Feuille ou palme : bande effilée qui s'incurve vers le bas.
function frond(length, width, droop, segments = 6) {
  const positions = []
  const point = (t, side) => {
    const w = width * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.35)
    return [side * w, droop * -t * t * length * 0.6 + t * length * 0.25, t * length]
  }
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments
    const t1 = (i + 1) / segments
    const a = point(t0, -1)
    const b = point(t0, 1)
    const c = point(t1, -1)
    const d = point(t1, 1)
    const mid0 = [0, a[1] + width * 0.08, a[2]]
    const mid1 = [0, c[1] + width * 0.08, c[2]]
    positions.push(...a, ...mid0, ...c, ...mid0, ...mid1, ...c, ...mid0, ...b, ...mid1, ...b, ...d, ...mid1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return g
}

const blob = (radius, detail = 0) => new THREE.IcosahedronGeometry(radius, detail)

export function canopyTree() {
  const parts = [
    part(new THREE.CylinderGeometry(0.32, 0.55, 13, 6), '#6b5a45', { at: [0, 6.5, 0] }),
    // Contreforts à la base du tronc.
    ...[0, 2.1, 4.2].map((a) => part(new THREE.BoxGeometry(0.12, 1.6, 1.3), '#5f4f3b', { at: [Math.sin(a) * 0.5, 0.8, Math.cos(a) * 0.5], rot: [0, a, 0] })),
    part(blob(1, 1), '#2f5d2e', { at: [0, 13.6, 0], scale: [4, 1.9, 4] }),
    part(blob(1, 1), '#3c6e33', { at: [1.8, 12.4, 1], scale: [2.6, 1.5, 2.6] }),
    part(blob(1, 1), '#356632', { at: [-1.7, 12.6, -1.1], scale: [2.8, 1.5, 2.6] }),
    part(blob(1, 0), '#4b7d3a', { at: [0.4, 15, -0.5], scale: [2.4, 1.2, 2.4] }),
  ]
  return merge(parts)
}

export function limbaliTree() {
  return merge([
    part(new THREE.CylinderGeometry(0.45, 0.8, 19, 7), '#5a4a3a', { at: [0, 9.5, 0] }),
    ...[0, 1.6, 3.2, 4.8].map((a) => part(new THREE.BoxGeometry(0.16, 2.2, 1.8), '#4e4032', { at: [Math.sin(a) * 0.7, 1.1, Math.cos(a) * 0.7], rot: [0, a, 0] })),
    part(blob(1, 1), '#1f4426', { at: [0, 19.5, 0], scale: [6, 2.6, 6] }),
    part(blob(1, 1), '#25502c', { at: [3, 18, 1.5], scale: [3.6, 2, 3.4] }),
    part(blob(1, 1), '#234a29', { at: [-3, 18.2, -1.4], scale: [3.8, 2, 3.4] }),
    part(blob(1, 1), '#2a5530', { at: [0.5, 18.4, -3], scale: [3.2, 1.8, 3] }),
  ])
}

export function parasolTree() {
  const parts = [
    part(new THREE.CylinderGeometry(0.2, 0.3, 10, 6), '#b9b29d', { at: [0, 6, 0] }),
    // Racines-échasses.
    ...[0, 1.3, 2.6, 3.9, 5.2].map((a) => part(new THREE.CylinderGeometry(0.06, 0.09, 2.2, 4), '#a59c84', { at: [Math.sin(a) * 0.55, 1, Math.cos(a) * 0.55], rot: [Math.cos(a) * 0.45, 0, -Math.sin(a) * 0.45] })),
    part(new THREE.CylinderGeometry(0.08, 0.08, 1, 4), '#b9b29d', { at: [0, 11.2, 0] }),
  ]
  // Couronne en parasol : feuilles palmées disposées en disque.
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    for (let j = 0; j < 5; j++) {
      const b = a + (j - 2) * 0.18
      parts.push(part(frond(2.6, 0.38, 0.5, 3), j === 2 ? '#5b8f3b' : '#679c42', { at: [Math.sin(a) * 1.6, 11.3, Math.cos(a) * 1.6], rot: [0, b, 0] }))
    }
  }
  parts.push(part(blob(1, 0), '#4f8434', { at: [0, 11.8, 0], scale: [1.8, 0.6, 1.8] }))
  return merge(parts)
}

export function palmTree() {
  const parts = []
  let x = 0
  for (let i = 0; i < 7; i++) {
    parts.push(part(new THREE.CylinderGeometry(0.26, 0.3, 1.25, 6), i % 2 ? '#6e5b3e' : '#64523a', { at: [x, 0.62 + i * 1.2, 0] }))
    x += 0.06 * i * 0.3
  }
  const top = [x, 8.6, 0]
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    parts.push(part(frond(4.2, 0.5, 1.5 + (i % 3) * 0.4, 6), i % 2 ? '#4f8a2d' : '#5a9634', { at: top, rot: [-0.25 + (i % 3) * 0.2, a, 0] }))
  }
  // Régimes de noix de palme.
  parts.push(part(blob(0.45, 0), '#b8461f', { at: [top[0] + 0.4, 8, 0.3] }))
  parts.push(part(blob(0.4, 0), '#9c3b1a', { at: [top[0] - 0.35, 8.05, -0.3] }))
  return merge(parts)
}

export function bananaPlant() {
  const parts = [part(new THREE.CylinderGeometry(0.16, 0.22, 2.2, 6), '#6f8f3a', { at: [0, 1.1, 0] })]
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2
    parts.push(part(frond(2.2, 0.5, 0.9, 4), i % 2 ? '#6aa338' : '#79b043', { at: [0, 2.1, 0], rot: [-0.5, a, 0] }))
  }
  return merge(parts)
}

export function lisiereTree() {
  return merge([
    part(new THREE.CylinderGeometry(0.18, 0.3, 5, 5), '#6b5a45', { at: [0, 2.5, 0] }),
    part(blob(1, 1), '#58873a', { at: [0, 5.8, 0], scale: [2.6, 1.8, 2.6] }),
    part(blob(1, 0), '#4c7a33', { at: [1, 5.2, 0.6], scale: [1.6, 1.2, 1.6] }),
  ])
}

export function bush() {
  return merge([
    part(blob(1, 0), '#2f5a2b', { at: [0, 0.35, 0], scale: [0.7, 0.5, 0.7] }),
    part(blob(1, 0), '#3a6a30', { at: [0.45, 0.28, 0.2], scale: [0.45, 0.38, 0.45] }),
  ])
}

export function fern() {
  const parts = []
  for (let i = 0; i < 7; i++) parts.push(part(frond(1.3, 0.22, 1.1, 4), i % 2 ? '#3f7a2e' : '#4b8a35', { at: [0, 0.1, 0], rot: [-0.7, (i / 7) * Math.PI * 2, 0] }))
  return merge(parts)
}

export function grassTuft() {
  const parts = []
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.07, 0, 0, 0.07, 0, 0, 0.02, 0.7, 0.1], 3))
    parts.push(part(g, i % 2 ? '#7aa045' : '#8bb04e', { rot: [0, (i / 4) * Math.PI + i, 0], at: [Math.sin(i) * 0.12, 0, Math.cos(i) * 0.12] }))
  }
  return merge(parts)
}

export function rock() {
  const g = new THREE.DodecahedronGeometry(1, 0)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 3.1) * 0.18), p.getY(i) * 0.6, p.getZ(i) * (1 + Math.cos(i * 2.3) * 0.18))
  return merge([part(g, '#8a857a', { jitter: 0.1, at: [0, 0.25, 0] })])
}

// Liane de fumbwa enroulée autour d'un tronc support.
export function lianaTree() {
  const parts = [part(new THREE.CylinderGeometry(0.4, 0.6, 14, 6), '#6b5a45', { at: [0, 7, 0] }), part(blob(1, 1), '#335f2f', { at: [0, 14.5, 0], scale: [3.6, 1.8, 3.6] })]
  for (let i = 0; i < 26; i++) {
    const t = i / 26
    const a = t * Math.PI * 7
    const y = 0.4 + t * 9
    parts.push(part(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 3), '#4a5a2a', { at: [Math.sin(a) * 0.55, y, Math.cos(a) * 0.55], rot: [0.5, a, 0.4] }))
    parts.push(part(blob(1, 0), i % 2 ? '#2f7a34' : '#3b8a3c', { at: [Math.sin(a) * 0.75, y + 0.1, Math.cos(a) * 0.75], scale: [0.32, 0.12, 0.2], rot: [0, a, 0] }))
  }
  return merge(parts)
}

// Matériau partagé de la végétation, animé par le vent : les sommets
// s'inclinent d'autant plus qu'ils sont hauts.
export function foliageMaterial({ windStart = 1, windAmp = 0.025 } = {}) {
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide })
  const uniforms = { uTime: { value: 0 } }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 root = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 root = vec3(0.0);
        #endif
        float sway = max(0.0, position.y - ${windStart.toFixed(2)}) * ${windAmp.toFixed(4)};
        transformed.x += sin(uTime * 1.3 + root.x * 0.21 + root.z * 0.17 + position.y * 0.3) * sway;
        transformed.z += cos(uTime * 1.05 + root.x * 0.13 + position.y * 0.2) * sway * 0.6;`,
      )
  }
  material.userData.uniforms = uniforms
  return material
}
