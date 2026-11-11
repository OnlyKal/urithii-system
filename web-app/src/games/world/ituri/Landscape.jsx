import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { bananaPlant, bush, canopyTree, fern, foliageMaterial, grassTuft, limbaliTree, lisiereTree, palmTree, parasolTree, rock } from '../../models/vegetation.js'
import { useHd } from '../../hd/assets.js'
import { HdInstances, HdOr, HdTrees, useNearSplit } from '../../hd/HdModels.jsx'
import { RIVER_HALF_WIDTH, riverX, WORLD_SIZE } from './catalog.js'
import { groundColor, groundHeight, groundMasks, WATER_Y } from './terrain.js'
import { groundMaterial, waterFragmentHd, waterVertexHd } from '../../hd/environment.js'
import { SUN } from './Atmosphere.jsx'

// Terrain, rivière et végétation de l'environnement.

export function Terrain({ segments }) {
  const hd = useHd()
  const hdMaterial = useMemo(() => (hd ? groundMaterial() : null), [hd])
  useEffect(() => () => hdMaterial?.dispose(), [hdMaterial])
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const h = groundHeight(x, z)
      pos.setY(i, h)
      colors.set(groundColor(x, z, h), i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    if (hd) {
      // Masques des textures photo du sol (latérite, boue, litière).
      const masks = new Float32Array(pos.count * 3)
      for (let i = 0; i < pos.count; i++) masks.set(groundMasks(pos.getX(i), pos.getZ(i), pos.getY(i)), i * 3)
      g.setAttribute('masks', new THREE.BufferAttribute(masks, 3))
    }
    g.computeVertexNormals()
    return g
  }, [segments, hd])
  useEffect(() => () => geometry.dispose(), [geometry])
  if (hdMaterial) return <mesh geometry={geometry} material={hdMaterial} receiveShadow />
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.97} metalness={0} />
    </mesh>
  )
}

const waterVertex = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

const waterFragment = /* glsl */ `
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
varying vec2 vUv;
varying vec3 vWorld;
#include <fog_pars_fragment>
void main() {
  float edge = abs(vUv.x - 0.5) * 2.0;
  vec2 p = vWorld.xz;
  // Ondulations qui descendent le courant.
  float w = sin(p.x * 1.6 + sin(p.y * 0.5) + uTime * 0.8) * 0.5 + sin(p.y * 1.2 - uTime * 2.2 + p.x * 0.35) * 0.5;
  float fine = sin((p.x * 0.7 + p.y) * 3.4 - uTime * 3.2) * 0.5 + 0.5;
  vec3 col = mix(uDeep, uShallow, smoothstep(0.15, 0.9, edge));
  col += uSky * (0.1 + 0.08 * w);
  col += vec3(1.0) * smoothstep(0.9, 1.0, fine * (0.65 + 0.35 * w)) * 0.3;
  float foam = smoothstep(0.78, 0.95, edge + w * 0.04);
  col = mix(col, vec3(0.86, 0.9, 0.84), foam * 0.45);
  gl_FragColor = vec4(col, mix(0.86, 0.0, smoothstep(0.92, 1.0, edge)));
  #include <fog_fragment>
}`

export function River() {
  const hd = useHd()
  const material = useMemo(
    () =>
      hd
        ? new THREE.ShaderMaterial({
            vertexShader: waterVertexHd,
            fragmentShader: waterFragmentHd,
            transparent: true,
            fog: true,
            depthWrite: false,
            uniforms: THREE.UniformsUtils.merge([
              THREE.UniformsLib.fog,
              {
                uTime: { value: 0 },
                uSunDir: { value: new THREE.Vector3(SUN.x, SUN.y, SUN.z).normalize() },
                // Reflet de la canopée (vert) plus que du ciel, comme en forêt.
                uSkyTop: { value: new THREE.Color('#a9bcb8') },
                uSkyHorizon: { value: new THREE.Color('#5d6b44') },
                uDeep: { value: new THREE.Color('#231d10') }, // eau chargée de tanins
                uShallow: { value: new THREE.Color('#4a412a') },
              },
            ]),
          })
        : new THREE.ShaderMaterial({
        vertexShader: waterVertex,
        fragmentShader: waterFragment,
        transparent: true,
        fog: true,
        depthWrite: false,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          { uTime: { value: 0 }, uDeep: { value: new THREE.Color('#1f5560') }, uShallow: { value: new THREE.Color('#5f8f7a') }, uSky: { value: new THREE.Color('#9ec9d8') } },
        ]),
      }),
    [hd],
  )
  // Ruban qui suit le lit de la rivière.
  const geometry = useMemo(() => {
    const half = RIVER_HALF_WIDTH + 5
    const positions = []
    const uvs = []
    const index = []
    const steps = 130
    for (let i = 0; i <= steps; i++) {
      const z = -WORLD_SIZE / 2 + (i / steps) * WORLD_SIZE
      const x = riverX(z)
      positions.push(x - half, WATER_Y, z, x + half, WATER_Y, z)
      uvs.push(0, i / steps, 1, i / steps)
      if (i < steps) index.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(index)
    g.computeVertexNormals()
    return g
  }, [])
  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })
  return <mesh geometry={geometry} material={material} renderOrder={1} />
}

// Une espèce végétale en de nombreuses instances.
function Instances({ make, items, material, shadows = true, tint = 0 }) {
  const ref = useRef()
  const geometry = useMemo(make, [make])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const color = new THREE.Color()
    items.forEach((it, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.ry)
      m.compose(new THREE.Vector3(it.x, it.y - 0.05, it.z), q, new THREE.Vector3(it.s, it.s * (0.9 + (i % 5) * 0.05), it.s))
      mesh.setMatrixAt(i, m)
      if (tint) mesh.setColorAt(i, color.setHSL(0, 0, 1 - tint + ((i * 0.618) % 1) * tint))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, tint])
  useEffect(() => () => geometry.dispose(), [geometry])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={shadows} receiveShadow frustumCulled={false} />
}

// Répartit une liste entre plusieurs modèles (variété).
const split = (items, n) => Array.from({ length: n }, (_, k) => items.filter((_, i) => i % n === k))

// Végétation à deux niveaux de détail : HD près du joueur (rayon « radius »),
// modèle stylisé au-delà. Sans pack HD, tout reste stylisé.
function Lod({ hd, items, radius, stylised, children }) {
  if (!hd) return stylised(items)
  return <LodSplit items={items} radius={radius} stylised={stylised}>{children}</LodSplit>
}

function LodSplit({ items, radius, stylised, children }) {
  const { near, far } = useNearSplit(items, radius)
  return (
    <>
      {stylised(far)}
      <HdOr hd fallback={stylised(near)}>{children(near)}</HdOr>
    </>
  )
}

export function Vegetation({ layout, shadows, part = 'all' }) {
  const hd = useHd()
  const materials = useMemo(
    () => ({
      trees: foliageMaterial({ windStart: 6, windAmp: 0.012 }),
      low: foliageMaterial({ windStart: 0.2, windAmp: 0.06 }),
      rocks: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }),
    }),
    [],
  )
  useFrame((state) => {
    materials.trees.userData.uniforms.uTime.value = state.clock.elapsedTime
    materials.low.userData.uniforms.uTime.value = state.clock.elapsedTime
  })
  useEffect(() => () => Object.values(materials).forEach((m) => m.dispose()), [materials])
  const trees = part !== 'ground'
  const ground = part !== 'trees'
  return (
    <group>
      {trees && (
        <>
          <Lod hd={hd} items={layout.canopy} radius={65} stylised={(it) => <Instances make={canopyTree} items={it} material={materials.trees} shadows={shadows} tint={0.25} />}>
            {(near) => {
              const [a, b] = split(near, 2)
              // Canopée : deux variantes d'arbres géants allégés, sans ombre portée
              // (l'ombre douce vient de l'éclairage d'ambiance).
              return (
                <>
                  <HdInstances id="arbre_v2" items={a} scale={0.55} shadows={false} sink={0.1} />
                  <HdInstances id="arbre_v3" items={b} scale={0.6} shadows={false} sink={0.1} />
                </>
              )
            }}
          </Lod>
          <HdOr hd={hd} fallback={<Instances make={limbaliTree} items={layout.limbali} material={materials.trees} shadows={shadows} tint={0.15} />}>
            <HdTrees items={layout.limbali} shadows={shadows} />
          </HdOr>
          <Instances make={parasolTree} items={layout.parasol} material={materials.trees} shadows={shadows} />
          <Instances make={palmTree} items={layout.palms} material={materials.trees} shadows={shadows} />
          <Lod hd={hd} items={layout.lisiereTrees} radius={60} stylised={(it) => <Instances make={lisiereTree} items={it} material={materials.trees} shadows={shadows} tint={0.2} />}>
            {(near) => <HdInstances id="pachira" items={near} scale={4.2} shadows={false} jitter={0.25} />}
          </Lod>
          <Instances make={bananaPlant} items={layout.bananas} material={materials.low} shadows={shadows} />
        </>
      )}
      {ground && (
        <>
          <Lod hd={hd} items={layout.bushes} radius={35} stylised={(it) => <Instances make={bush} items={it} material={materials.low} shadows={false} tint={0.3} />}>
            {(near) => {
              const [a, b] = split(near, 2)
              return (
                <>
                  <HdInstances id="anthurium" items={a} scale={2.4} shadows={false} jitter={0.3} />
                  <HdInstances id="calathea" items={b} scale={2.6} shadows={false} jitter={0.3} />
                </>
              )
            }}
          </Lod>
          <Lod hd={hd} items={layout.ferns} radius={35} stylised={(it) => <Instances make={fern} items={it} material={materials.low} shadows={false} tint={0.25} />}>
            {(near) => <HdInstances id="fougere" items={near} scale={2.2} shadows={false} jitter={0.3} />}
          </Lod>
          <Lod hd={hd} items={layout.grass} radius={28} stylised={(it) => <Instances make={grassTuft} items={it} material={materials.low} shadows={false} tint={0.3} />}>
            {(near) => <HdInstances id="herbe" items={near} scale={3.2} shadows={false} jitter={0.3} sink={0.02} />}
          </Lod>
          <Instances make={rock} items={layout.rocks} material={materials.rocks} shadows={shadows} tint={0.2} />
          <Instances make={rock} items={layout.riverRocks} material={materials.rocks} shadows={false} tint={0.25} />
        </>
      )}
    </group>
  )
}
