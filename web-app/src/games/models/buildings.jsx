import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

// Habitations et objets du village, stylisés. Formes simples et matériaux
// répandus (murs en terre, toits de chaume, bois) : le décor n'est pas la
// reproduction d'une architecture propre à une communauté précise.

const MUD = '#a87a4d'
const MUD_DARK = '#8c6440'
const THATCH = '#b8924f'
const THATCH_DARK = '#9a7740'
const WOOD = '#6e5137'

// Prisme triangulaire des pignons (axe le long de la maison).
const GABLE = (() => {
  const shape = new THREE.Shape([new THREE.Vector2(-2.2, 0), new THREE.Vector2(2.2, 0), new THREE.Vector2(0, 1.7)])
  const g = new THREE.ExtrudeGeometry(shape, { depth: 5.9, bevelEnabled: false })
  g.translate(0, 0, -2.95)
  g.rotateY(Math.PI / 2)
  return g
})()

const mat = (color, roughness = 0.95) => <meshStandardMaterial color={color} roughness={roughness} flatShading />

export function RoundHut({ scale = 1 }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2.9, 3, 2.4, 14]} />
        {mat(MUD)}
      </mesh>
      {/* Soubassement plus sombre */}
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[3.05, 3.1, 0.4, 14]} />
        {mat(MUD_DARK)}
      </mesh>
      <mesh position={[0, 1, 2.92]}>
        <boxGeometry args={[1, 1.9, 0.2]} />
        {mat('#2b1d12')}
      </mesh>
      <mesh position={[0, 3.75, 0]} castShadow>
        <coneGeometry args={[3.9, 3, 14, 2]} />
        {mat(THATCH)}
      </mesh>
      <mesh position={[0, 2.3, 0]}>
        <cylinderGeometry args={[3.92, 3.98, 0.18, 14, 1, true]} />
        <meshStandardMaterial color={THATCH_DARK} roughness={1} side={THREE.DoubleSide} flatShading />
      </mesh>
      <mesh position={[0, 5.35, 0]}>
        <coneGeometry args={[0.25, 0.5, 6]} />
        {mat(THATCH_DARK)}
      </mesh>
    </group>
  )
}

export function House({ scale = 1 }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[6, 2.6, 4.4]} />
        {mat(MUD)}
      </mesh>
      <mesh position={[0, 1.1, 2.21]}>
        <boxGeometry args={[1.1, 2, 0.1]} />
        {mat('#2b1d12')}
      </mesh>
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 1.5, 2.21]}>
          <boxGeometry args={[0.8, 0.7, 0.1]} />
          {mat('#3a2818')}
        </mesh>
      ))}
      {/* Toit à deux pans */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 3.35, s * 1.35]} rotation={[s * 0.62, 0, 0]} castShadow>
          <boxGeometry args={[6.9, 0.25, 3.5]} />
          {mat(THATCH)}
        </mesh>
      ))}
      {/* Pignons : prisme triangulaire sous le toit */}
      <mesh geometry={GABLE} position={[0, 2.6, 0]} castShadow>
        {mat(MUD_DARK)}
      </mesh>
    </group>
  )
}

export function Granary({ scale = 1 }) {
  return (
    <group scale={scale}>
      {[[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.6, z]} castShadow>
          <cylinderGeometry args={[0.09, 0.11, 1.2, 5]} />
          {mat(WOOD)}
        </mesh>
      ))}
      <mesh position={[0, 1.25, 0]}>
        <cylinderGeometry args={[1.25, 1.25, 0.12, 10]} />
        {mat(WOOD)}
      </mesh>
      <mesh position={[0, 2.05, 0]} castShadow>
        <cylinderGeometry args={[1.05, 0.95, 1.5, 10]} />
        {mat('#9c7a48')}
      </mesh>
      <mesh position={[0, 3.25, 0]} castShadow>
        <coneGeometry args={[1.55, 1.3, 10]} />
        {mat(THATCH)}
      </mesh>
    </group>
  )
}

// Foyer central : pierres, bûches, flammes animées et lumière vacillante.
export function FirePit() {
  const flames = useRef()
  const light = useRef()
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (flames.current) {
      flames.current.children.forEach((f, i) => {
        f.scale.y = 0.8 + Math.sin(t * (7 + i) + i) * 0.25 + Math.sin(t * 13 + i * 2) * 0.1
        f.rotation.y = t * (0.5 + i * 0.2)
      })
    }
    if (light.current) light.current.intensity = 5 + Math.sin(t * 9) * 1 + Math.sin(t * 23) * 0.6
  })
  return (
    <group>
      {Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * 0.95, 0.12, Math.sin(a) * 0.95]} scale={[0.3, 0.22, 0.26]} castShadow>
            <dodecahedronGeometry args={[1, 0]} />
            {mat('#77726a')}
          </mesh>
        )
      })}
      {[0, 1.1, 2.2].map((a) => (
        <mesh key={a} position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, a]}>
          <cylinderGeometry args={[0.08, 0.1, 1.3, 6]} />
          {mat('#3d2a1b')}
        </mesh>
      ))}
      <group ref={flames} position={[0, 0.2, 0]}>
        {[['#ff8a2b', 0.4, 1], ['#ffb547', 0.28, 0.8], ['#fff1b8', 0.15, 0.55]].map(([color, r, h]) => (
          <mesh key={color} position={[0, h / 2, 0]}>
            <coneGeometry args={[r, h, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.9} />
          </mesh>
        ))}
      </group>
      <pointLight ref={light} position={[0, 1.2, 0]} color="#ff9a3c" intensity={5} distance={14} decay={1.6} />
    </group>
  )
}

// Décors des espaces du village.
export function StationDecor({ kind }) {
  if (kind === 'cooking') {
    return (
      <group>
        {[0, 2.1, 4.2].map((a) => (
          <mesh key={a} position={[Math.cos(a) * 0.35, 0.15, Math.sin(a) * 0.35]} scale={0.22}>
            <dodecahedronGeometry args={[1, 0]} />
            {mat('#77726a')}
          </mesh>
        ))}
        <mesh position={[0, 0.5, 0]} castShadow>
          <sphereGeometry args={[0.42, 12, 8, 0, Math.PI * 2, Math.PI * 0.25, Math.PI * 0.75]} />
          <meshStandardMaterial color="#2a2522" roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[1.3, 0.35, 0.4]} castShadow>
          <cylinderGeometry args={[0.3, 0.22, 0.7, 10]} />
          {mat(WOOD)}
        </mesh>
        <mesh position={[1.3, 1, 0.4]} rotation={[0.1, 0, 0.12]}>
          <cylinderGeometry args={[0.05, 0.06, 1.3, 6]} />
          {mat('#8a6a48')}
        </mesh>
      </group>
    )
  }
  if (kind === 'cloth') {
    return (
      <group>
        {[-1.4, 1.4].map((x) => (
          <mesh key={x} position={[x, 1, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.07, 2, 5]} />
            {mat(WOOD)}
          </mesh>
        ))}
        <mesh position={[0, 1.95, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 3, 5]} />
          {mat(WOOD)}
        </mesh>
        {[['#c2552b', -0.8], ['#29cb94', 0], ['#ffb547', 0.8]].map(([color, x]) => (
          <mesh key={color} position={[x, 1.4, 0]} castShadow>
            <boxGeometry args={[0.7, 1.1, 0.03]} />
            <meshStandardMaterial color={color} roughness={0.9} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
    )
  }
  if (kind === 'memory') {
    return (
      <group>
        {[[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.2, z]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 2.4, 6]} />
            {mat(WOOD)}
          </mesh>
        ))}
        <mesh position={[0, 2.75, 0]} castShadow>
          <coneGeometry args={[2.9, 1.3, 4]} />
          {mat(THATCH)}
        </mesh>
        <mesh position={[0, 0.45, -0.6]} castShadow>
          <boxGeometry args={[1.2, 0.7, 0.6]} />
          {mat('#5a3d26')}
        </mesh>
        <mesh position={[0, 0.3, 0.6]}>
          <boxGeometry args={[2.2, 0.12, 0.4]} />
          {mat(WOOD)}
        </mesh>
      </group>
    )
  }
  if (kind === 'speech') {
    return (
      <group>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 1.6, 0.22, Math.sin(a) * 1.6]} rotation={[0, -a, 0]} castShadow>
              <cylinderGeometry args={[0.25, 0.28, 0.44, 8]} />
              {mat('#7a5a3c')}
            </mesh>
          )
        })}
      </group>
    )
  }
  // Atelier : établi, paniers et poteries.
  return (
    <group>
      <mesh position={[0, 0.75, 0]} castShadow>
        <boxGeometry args={[2.2, 0.12, 0.9]} />
        {mat(WOOD)}
      </mesh>
      {[[-0.95, -0.35], [0.95, -0.35], [-0.95, 0.35], [0.95, 0.35]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.37, z]}>
          <boxGeometry args={[0.1, 0.74, 0.1]} />
          {mat(WOOD)}
        </mesh>
      ))}
      <mesh position={[-0.5, 1.0, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.2, 0.4, 10, 1, true]} />
        <meshStandardMaterial color="#c4a06a" roughness={1} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0.5, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.25, 10, 8]} />
        {mat('#9a5a34')}
      </mesh>
      <mesh position={[1.6, 0.3, 0.6]} castShadow>
        <sphereGeometry args={[0.32, 10, 8]} />
        {mat('#8a4e2c')}
      </mesh>
    </group>
  )
}

// Borne URITHI : poteau sculpté surmonté de l'emblème, qui signale un
// espace documentaire.
export function UrithiPost({ color = '#29cb94' }) {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow>
        <boxGeometry args={[0.28, 1.6, 0.28]} />
        {mat('#5a3d26')}
      </mesh>
      <mesh position={[0, 1.75, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[0.42, 0.42, 0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
    </group>
  )
}

// Pont de planches.
export function Bridge({ x0, x1, z, deck }) {
  const length = x1 - x0
  const planks = Math.round(length / 0.55)
  return (
    <group position={[(x0 + x1) / 2, 0, z]}>
      {Array.from({ length: planks }, (_, i) => (
        <mesh key={i} position={[-length / 2 + (i + 0.5) * (length / planks), deck - 0.06, 0]} rotation={[0, 0, (i % 3) * 0.01]} castShadow receiveShadow>
          <boxGeometry args={[length / planks - 0.05, 0.12, 3.2]} />
          {mat(i % 2 ? '#7a5a3a' : '#6e5034')}
        </mesh>
      ))}
      {[-1.55, 1.55].map((side) => (
        <group key={side}>
          <mesh position={[0, deck + 0.85, side]}>
            <boxGeometry args={[length, 0.08, 0.08]} />
            {mat(WOOD)}
          </mesh>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[-length / 2 + (i / 6) * length, deck - 0.05, side]} castShadow>
              <cylinderGeometry args={[0.09, 0.1, 3.4, 6]} />
              {mat(WOOD)}
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}
