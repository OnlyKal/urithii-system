import { Sparkles } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CongoPeafowl, Okapi } from '../models/animals.jsx'
import { FirePit, RoundHut, Granary } from '../models/buildings.jsx'
import { canopyTree, foliageMaterial, palmTree, parasolTree } from '../models/vegetation.js'

// Bannière 3D de l'accueil des jeux : une île-diorama (forêt, rivière,
// village, okapi) qui tourne lentement.

function Island() {
  const { top, side } = useMemo(() => {
    // Dessus : grille découpée en disque, colorée selon le milieu.
    const t = new THREE.PlaneGeometry(18, 18, 72, 72)
    t.rotateX(-Math.PI / 2)
    const p = t.attributes.position
    const colors = []
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i)
      let z = p.getZ(i)
      const r = Math.hypot(x, z)
      if (r > 9) {
        x *= 9 / r
        z *= 9 / r
      }
      const river = Math.abs(x - Math.sin(z * 0.35) * 1.1 - 1.4) < 0.9
      const forest = x > 2.6
      const village = Math.hypot(x + 4, z) < 3.2
      const y = (river ? -0.32 : 0) + Math.sin(x * 0.9) * Math.cos(z * 0.7) * 0.12 + (forest ? 0.12 : 0)
      p.setXYZ(i, x, y, z)
      const c = river ? [0.3, 0.55, 0.62] : village ? [0.66, 0.52, 0.34] : forest ? [0.22, 0.36, 0.17] : [0.45, 0.6, 0.29]
      const k = 0.92 + Math.sin(x * 5.1 + z * 3.7) * 0.08
      colors.push(c[0] * k, c[1] * k, c[2] * k)
    }
    t.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    t.computeVertexNormals()
    const sideGeometry = new THREE.CylinderGeometry(9, 4.5, 3.4, 40, 3, true)
    const sp = sideGeometry.attributes.position
    for (let i = 0; i < sp.count; i++) {
      const y = sp.getY(i)
      if (y < 1.6 && y > -1.6) sp.setX(i, sp.getX(i) * (1 + Math.sin(i * 1.7) * 0.05))
    }
    sideGeometry.translate(0, -1.7, 0)
    sideGeometry.computeVertexNormals()
    return { top: t, side: sideGeometry }
  }, [])
  return (
    <group position={[0, 1.2, 0]}>
      <mesh geometry={top} receiveShadow>
        <meshStandardMaterial vertexColors flatShading roughness={0.95} />
      </mesh>
      <mesh geometry={side} castShadow>
        <meshStandardMaterial color="#7a5636" flatShading roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -3.4, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[4.5, 3, 20]} />
        <meshStandardMaterial color="#5e412a" flatShading roughness={1} />
      </mesh>
    </group>
  )
}

function Trees() {
  const material = useMemo(() => foliageMaterial({ windStart: 6, windAmp: 0.012 }), [])
  const geometries = useMemo(() => ({ canopy: canopyTree(), palm: palmTree(), parasol: parasolTree() }), [])
  useFrame((state) => {
    material.userData.uniforms.uTime.value = state.clock.elapsedTime
  })
  const trees = [
    ['canopy', 4.5, -3, 0.28], ['canopy', 6.3, 0.5, 0.25], ['canopy', 3.6, 3.8, 0.3], ['canopy', 6, -5, 0.24], ['parasol', 4.2, 1, 0.26],
    ['canopy', 7.2, 3.2, 0.22], ['palm', -2.8, 4.8, 0.3], ['palm', -6.5, 1.5, 0.28], ['palm', -1, -6.2, 0.26],
  ]
  return trees.map(([kind, x, z, s], i) => <mesh key={i} geometry={geometries[kind]} material={material} position={[x, 1.2, z]} scale={s} castShadow />)
}

function WalkingOkapi() {
  const group = useRef()
  const motion = useRef({ speed: 1 })
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.18
    group.current.position.set(Math.cos(t) * 5.2 + 0.6, 1.2, Math.sin(t) * 3.4)
    group.current.rotation.y = -t
  })
  return (
    <group ref={group} scale={0.42}>
      <Okapi motion={motion} />
    </group>
  )
}

function Diorama() {
  const group = useRef()
  const still = useRef({ speed: 0 })
  useFrame((state, dt) => {
    group.current.rotation.y += dt * 0.06
    group.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.12
  })
  return (
    <group ref={group} position={[0, -1.2, 0]}>
      <Island />
      <Trees />
      <group position={[-4.2, 1.2, -1.8]} scale={0.32} rotation={[0, 0.6, 0]}>
        <RoundHut />
      </group>
      <group position={[-5.6, 1.2, 2.8]} scale={0.3} rotation={[0, 2, 0]}>
        <RoundHut />
      </group>
      <group position={[-2.5, 1.2, -4.2]} scale={0.32}>
        <Granary />
      </group>
      <group position={[-3.4, 1.2, 0.9]} scale={0.35}>
        <FirePit />
      </group>
      <WalkingOkapi />
      <group position={[2.8, 1.2, 5.2]} scale={0.5} rotation={[0, -0.8, 0]}>
        <CongoPeafowl motion={still} />
      </group>
    </group>
  )
}

export default function HeroScene() {
  return (
    <Canvas shadows dpr={[1, 1.6]} camera={{ position: [0, 9, 26], fov: 34 }} gl={{ antialias: true, alpha: true }} onCreated={({ camera }) => camera.lookAt(0, 0, 0)}>
      <hemisphereLight args={['#e6f4ff', '#4a3a24', 0.85]} />
      <directionalLight position={[-8, 12, 6]} intensity={1.7} color="#ffe6bf" castShadow shadow-mapSize={[1024, 1024]} />
      <Diorama />
      <Sparkles count={50} scale={[16, 6, 12]} size={2.5} speed={0.3} opacity={0.6} color="#fff1b0" />
    </Canvas>
  )
}
