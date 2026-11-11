import { Sky, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useRuntime } from '../../engine/runtime.js'
import { VILLAGE } from './catalog.js'
import { groundHeight } from './terrain.js'

// Lumière, ciel, brume et vie ambiante (papillons, oiseaux, particules et
// rayons de lumière sous la canopée).

export const SUN = new THREE.Vector3(-0.55, 0.62, 0.42).normalize()

export function Lighting({ shadows, shadowSize }) {
  const runtime = useRuntime()
  const sun = useRef()
  useFrame(() => {
    const light = sun.current
    if (!light) return
    // La zone d'ombre suit le joueur.
    const p = runtime.player.pos
    light.position.set(p.x + SUN.x * 60, p.y + SUN.y * 60, p.z + SUN.z * 60)
    light.target.position.set(p.x, p.y, p.z)
    light.target.updateMatrixWorld()
  })
  return (
    <>
      <Sky distance={4500} sunPosition={[SUN.x * 100, SUN.y * 100, SUN.z * 100]} turbidity={6} rayleigh={1.4} mieCoefficient={0.006} mieDirectionalG={0.85} />
      <hemisphereLight args={['#d6ecff', '#4d5a2c', 1.05]} />
      <ambientLight intensity={0.15} />
      <directionalLight
        ref={sun}
        color="#fff0d2"
        intensity={2.4}
        castShadow={shadows}
        shadow-mapSize={[shadowSize || 512, shadowSize || 512]}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}

// Papillons : petites ailes qui battent, en vol erratique.
export function Butterflies({ count = 26 }) {
  const ref = useRef()
  const data = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: VILLAGE.x + 10 + Math.sin(i * 7.3) * 34,
        z: VILLAGE.z + Math.cos(i * 3.1) * 30,
        phase: i * 1.7,
        speed: 0.4 + (i % 5) * 0.1,
      })),
    [count],
  )
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, -0.18, 0.02, 0.08, -0.14, 0, -0.1, 0, 0, 0, 0.18, 0.02, 0.08, 0.14, 0, -0.1], 3))
    g.computeVertexNormals()
    return g
  }, [])
  const colors = useMemo(() => ['#ffb547', '#f4f0e0', '#29cb94', '#e86a3a', '#7fb3ff'], [])
  useLayoutEffect(() => {
    const color = new THREE.Color()
    data.forEach((_, i) => ref.current.setColorAt(i, color.set(colors[i % colors.length])))
    ref.current.instanceColor.needsUpdate = true
  }, [data, colors])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const e = useMemo(() => new THREE.Euler(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    data.forEach((b, i) => {
      const x = b.x + Math.sin(t * b.speed + b.phase) * 4 + Math.sin(t * 1.7 + i) * 0.6
      const z = b.z + Math.cos(t * b.speed * 0.8 + b.phase) * 4
      const y = groundHeight(x, z) + 1 + Math.sin(t * 2.1 + b.phase) * 0.5
      const flap = Math.abs(Math.sin(t * 14 + b.phase))
      e.set(0, t * b.speed + b.phase, 0)
      q.setFromEuler(e)
      m.compose(v.set(x, y, z), q, s.set(1, 0.3 + flap, 1))
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, count]} frustumCulled={false}>
      <meshStandardMaterial side={THREE.DoubleSide} roughness={0.6} />
    </instancedMesh>
  )
}

// Oiseaux planant au-dessus de la canopée.
export function Birds() {
  const group = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    group.current?.children.forEach((bird, i) => {
      const a = t * (0.09 + i * 0.01) + i * 1.3
      bird.position.set(25 + Math.cos(a) * (50 + i * 6), 34 + i * 2 + Math.sin(t + i) * 1.5, -10 + Math.sin(a) * (40 + i * 5))
      bird.rotation.y = -a
      bird.children[0].rotation.z = 0.4 + Math.sin(t * 6 + i) * 0.5
      bird.children[1].rotation.z = -0.4 - Math.sin(t * 6 + i) * 0.5
    })
  })
  return (
    <group ref={group}>
      {Array.from({ length: 6 }, (_, i) => (
        <group key={i}>
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.5, 0, 0]}>
              <boxGeometry args={[1, 0.04, 0.3]} />
              <meshBasicMaterial color="#2a2a2a" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// Rayons de lumière filtrant à travers la canopée.
export function LightShafts() {
  const shafts = useMemo(
    () => [[46, -6], [58, 20], [70, -30], [40, -40], [55, 44], [75, 5], [34, -60], [80, -50]].map(([x, z], i) => ({ x, z, y: groundHeight(x, z), r: 0.3 + (i % 3) * 0.12 })),
    [],
  )
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#fff3c9', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    [],
  )
  useFrame((state) => {
    material.opacity = 0.06 + Math.sin(state.clock.elapsedTime * 0.4) * 0.02
  })
  return shafts.map((s, i) => (
    <mesh key={i} position={[s.x, s.y + 8, s.z]} rotation={[0.35, i, 0.2]} material={material}>
      <cylinderGeometry args={[s.r * 4, s.r * 7, 18, 8, 1, true]} />
    </mesh>
  ))
}

export function ForestMotes() {
  return (
    <>
      <Sparkles count={70} scale={[50, 8, 60]} position={[58, 4, -10]} size={3} speed={0.25} opacity={0.55} color="#fff1b0" />
      <Sparkles count={40} scale={[30, 3, 30]} position={[14, 0.5, 6]} size={2.4} speed={0.4} opacity={0.5} color="#d9f7ec" />
    </>
  )
}
