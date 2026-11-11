import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

// Animaux stylisés, articulés et animés par le code. Chaque modèle regarde
// vers +z et lit « motion.current.speed » (0 arrêt, 1 marche, 2 fuite).

// Rayures blanches des pattes de l'okapi.
function stripeTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 16
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#3f2419'
  ctx.fillRect(0, 0, 16, 128)
  ctx.fillStyle = '#efe8da'
  for (let y = 6; y < 128; y += 15) ctx.fillRect(0, y, 16, 6 + (y % 4))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

// Patte à deux segments, pivot en haut.
function Leg({ legRef, kneeRef, length, radius, color, lowerColor = color, map, hoof = '#2a1d16' }) {
  const half = length / 2
  return (
    <group ref={legRef}>
      <mesh position={[0, -half / 2, 0]} castShadow>
        <cylinderGeometry args={[radius, radius * 0.8, half, 7]} />
        <meshStandardMaterial color={map ? '#ffffff' : color} map={map} roughness={0.85} />
      </mesh>
      <group ref={kneeRef} position={[0, -half, 0]}>
        <mesh position={[0, -half / 2, 0]} castShadow>
          <cylinderGeometry args={[radius * 0.8, radius * 0.65, half, 7]} />
          <meshStandardMaterial color={map ? '#ffffff' : lowerColor} map={map} roughness={0.85} />
        </mesh>
        <mesh position={[0, -half, 0]}>
          <cylinderGeometry args={[radius * 0.7, radius * 0.75, 0.08, 7]} />
          <meshStandardMaterial color={hoof} roughness={0.9} />
        </mesh>
      </group>
    </group>
  )
}

// Démarche à quatre temps : paires diagonales en opposition.
function useGait(motion, legs, { rate = 4, amp = 0.45 } = {}) {
  const phase = useRef(Math.random() * 6)
  useFrame((_, dt) => {
    const speed = motion.current.speed ?? 0
    phase.current += dt * (speed > 0.05 ? rate * (0.7 + speed * 0.6) : 0)
    const a = Math.min(1.4, speed) * amp
    const ease = 1 - Math.exp(-dt * 10)
    legs.forEach(([leg, knee], i) => {
      const offset = [0, Math.PI, Math.PI, 0][i]
      const s = Math.sin(phase.current + offset)
      if (leg.current) leg.current.rotation.x += (s * a - leg.current.rotation.x) * ease
      if (knee.current) knee.current.rotation.x += (Math.max(0, -Math.cos(phase.current + offset)) * a * 1.2 - knee.current.rotation.x) * ease
    })
  })
  return phase
}

const useLegs = () => [
  [useRef(), useRef()],
  [useRef(), useRef()],
  [useRef(), useRef()],
  [useRef(), useRef()],
]

export function Okapi({ motion }) {
  const map = useMemo(stripeTexture, [])
  const legs = useLegs()
  const neck = useRef()
  const ears = useRef()
  useGait(motion, legs, { rate: 4.2 })
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const speed = motion.current.speed ?? 0
    // Au repos, l'okapi broute et dresse les oreilles.
    if (neck.current) neck.current.rotation.x += ((speed < 0.05 ? 0.5 + Math.sin(t * 0.5) * 0.35 : -0.1) - neck.current.rotation.x) * 0.05
    if (ears.current) ears.current.rotation.z = Math.sin(t * 2.3) * 0.08
  })
  const brown = '#4a2a1e'
  const positions = [[-0.22, 0.62], [0.22, 0.62], [-0.22, -0.6], [0.22, -0.6]]
  return (
    <group>
      <mesh position={[0, 1.28, 0]} rotation={[Math.PI / 2 + 0.06, 0, 0]} castShadow>
        <capsuleGeometry args={[0.36, 1.05, 6, 12]} />
        <meshStandardMaterial color={brown} roughness={0.55} />
      </mesh>
      {/* Arrière-train rayé */}
      <mesh position={[0, 1.16, -0.68]} scale={[1, 0.9, 0.6]} castShadow>
        <sphereGeometry args={[0.37, 12, 10]} />
        <meshStandardMaterial map={map} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.25, -0.98]} rotation={[0.3, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.02, 0.6, 5]} />
        <meshStandardMaterial color="#2a1912" />
      </mesh>
      {positions.map(([x, z], i) => (
        <group key={i} position={[x, 1.08, z]}>
          <Leg legRef={legs[i][0]} kneeRef={legs[i][1]} length={1.04} radius={0.075} map={i > 1 ? map : undefined} color={brown} lowerColor="#e8e0d0" />
        </group>
      ))}
      <group ref={neck} position={[0, 1.5, 0.72]}>
        <mesh position={[0, 0.32, 0.12]} rotation={[0.35, 0, 0]} castShadow>
          <capsuleGeometry args={[0.15, 0.55, 4, 10]} />
          <meshStandardMaterial color={brown} roughness={0.55} />
        </mesh>
        <group position={[0, 0.68, 0.3]}>
          <mesh rotation={[1.25, 0, 0]} castShadow>
            <capsuleGeometry args={[0.13, 0.3, 4, 10]} />
            <meshStandardMaterial color="#3a2218" roughness={0.6} />
          </mesh>
          <mesh position={[0, -0.12, 0.25]}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshStandardMaterial color="#d8cbb5" roughness={0.7} />
          </mesh>
          <group ref={ears}>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.15, 0.12, -0.08]} rotation={[0, 0, s * -0.9]}>
                <coneGeometry args={[0.08, 0.26, 6]} />
                <meshStandardMaterial color={brown} roughness={0.7} />
              </mesh>
            ))}
          </group>
        </group>
      </group>
    </group>
  )
}

export function ForestElephant({ motion }) {
  const legs = useLegs()
  const trunk = [useRef(), useRef(), useRef(), useRef()]
  const ears = [useRef(), useRef()]
  useGait(motion, legs, { rate: 2.4, amp: 0.3 })
  useFrame((state) => {
    const t = state.clock.elapsedTime
    trunk.forEach((r, i) => {
      if (r.current) r.current.rotation.x = 0.18 + Math.sin(t * 0.9 + i * 0.5) * 0.12 * (i + 1) * 0.5
    })
    ears.forEach((r, i) => {
      if (r.current) r.current.rotation.y = (i ? -1 : 1) * (0.25 + Math.sin(t * 1.3) * 0.12)
    })
  })
  const skin = '#6c655d'
  const positions = [[-0.55, 0.85], [0.55, 0.85], [-0.55, -0.85], [0.55, -0.85]]
  return (
    <group>
      <mesh position={[0, 2.05, 0]} scale={[1.25, 1.1, 1.65]} castShadow>
        <sphereGeometry args={[1, 18, 14]} />
        <meshStandardMaterial color={skin} roughness={0.95} />
      </mesh>
      {positions.map(([x, z], i) => (
        <group key={i} position={[x, 1.55, z]}>
          <Leg legRef={legs[i][0]} kneeRef={legs[i][1]} length={1.55} radius={0.3} color={skin} hoof="#4d4741" />
        </group>
      ))}
      <group position={[0, 2.45, 1.55]}>
        <mesh castShadow>
          <sphereGeometry args={[0.72, 16, 12]} />
          <meshStandardMaterial color={skin} roughness={0.95} />
        </mesh>
        {/* Oreilles arrondies, propres à l'éléphant de forêt */}
        {[-1, 1].map((s, i) => (
          <group key={s} ref={ears[i]} position={[s * 0.6, 0.05, -0.2]}>
            <mesh position={[s * 0.38, -0.1, 0]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, 0.12]} castShadow>
              <sphereGeometry args={[0.55, 14, 10]} />
              <meshStandardMaterial color="#635c55" roughness={0.95} />
            </mesh>
          </group>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0.25 * s, -0.55, 0.55]} rotation={[0.35, 0, 0]}>
            <coneGeometry args={[0.07, 0.9, 7]} />
            <meshStandardMaterial color="#efe6cf" roughness={0.5} />
          </mesh>
        ))}
        {/* Trompe articulée */}
        <group ref={trunk[0]} position={[0, -0.25, 0.6]}>
          <mesh position={[0, -0.25, 0]}>
            <cylinderGeometry args={[0.2, 0.22, 0.5, 8]} />
            <meshStandardMaterial color={skin} roughness={0.95} />
          </mesh>
          <group ref={trunk[1]} position={[0, -0.5, 0]}>
            <mesh position={[0, -0.22, 0]}>
              <cylinderGeometry args={[0.16, 0.19, 0.45, 8]} />
              <meshStandardMaterial color={skin} roughness={0.95} />
            </mesh>
            <group ref={trunk[2]} position={[0, -0.45, 0]}>
              <mesh position={[0, -0.2, 0]}>
                <cylinderGeometry args={[0.12, 0.15, 0.4, 8]} />
                <meshStandardMaterial color={skin} roughness={0.95} />
              </mesh>
              <group ref={trunk[3]} position={[0, -0.4, 0]}>
                <mesh position={[0, -0.16, 0]}>
                  <cylinderGeometry args={[0.1, 0.12, 0.32, 8]} />
                  <meshStandardMaterial color={skin} roughness={0.95} />
                </mesh>
              </group>
            </group>
          </group>
        </group>
      </group>
      <mesh position={[0, 2.1, -1.65]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.03, 0.9, 5]} />
        <meshStandardMaterial color="#4d4741" />
      </mesh>
    </group>
  )
}

export function CongoPeafowl({ motion }) {
  const legs = [[useRef(), useRef()], [useRef(), useRef()]]
  const neck = useRef()
  const phase = useRef(0)
  useFrame((state, dt) => {
    const speed = motion.current.speed ?? 0
    phase.current += dt * (speed > 0.05 ? 9 + speed * 4 : 0)
    legs.forEach(([leg], i) => {
      if (leg.current) leg.current.rotation.x = Math.sin(phase.current + i * Math.PI) * Math.min(1, speed) * 0.6
    })
    // Picore au repos.
    const t = state.clock.elapsedTime
    if (neck.current) neck.current.rotation.x = speed < 0.05 ? Math.max(0, Math.sin(t * 1.7)) ** 6 * 1.2 : 0.1
  })
  return (
    <group scale={1.15}>
      <mesh position={[0, 0.55, 0]} scale={[0.75, 0.75, 1.1]} castShadow>
        <sphereGeometry args={[0.28, 14, 10]} />
        <meshStandardMaterial color="#1c3354" roughness={0.35} metalness={0.25} />
      </mesh>
      {/* Queue courte aux reflets verts */}
      <mesh position={[0, 0.58, -0.34]} rotation={[-0.5, 0, 0]} scale={[1, 0.35, 1]}>
        <coneGeometry args={[0.2, 0.42, 8]} />
        <meshStandardMaterial color="#1f4d3c" roughness={0.3} metalness={0.3} />
      </mesh>
      {legs.map(([leg], i) => (
        <group key={i} ref={leg} position={[(i ? 1 : -1) * 0.09, 0.4, 0.02]}>
          <mesh position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.018, 0.015, 0.36, 5]} />
            <meshStandardMaterial color="#6b6f75" />
          </mesh>
        </group>
      ))}
      <group ref={neck} position={[0, 0.68, 0.22]}>
        <mesh position={[0, 0.13, 0.04]} rotation={[0.25, 0, 0]}>
          <cylinderGeometry args={[0.055, 0.075, 0.28, 8]} />
          <meshStandardMaterial color="#b0412c" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.3, 0.08]}>
          <sphereGeometry args={[0.075, 10, 8]} />
          <meshStandardMaterial color="#1c2638" roughness={0.5} />
        </mesh>
        {/* Huppe claire */}
        <mesh position={[0, 0.4, 0.06]}>
          <coneGeometry args={[0.03, 0.1, 5]} />
          <meshStandardMaterial color="#e9e3d2" />
        </mesh>
        <mesh position={[0, 0.29, 0.17]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.022, 0.07, 5]} />
          <meshStandardMaterial color="#5b5a55" />
        </mesh>
      </group>
    </group>
  )
}

export const ANIMAL_MODELS = { okapi: Okapi, 'elephant-foret': ForestElephant, 'paon-congo': CongoPeafowl }
// Vitesses de marche et de fuite (m/s), distance de fuite.
export const ANIMAL_BEHAVIOUR = {
  okapi: { walk: 1.1, flee: 5.5, wary: 9, radius: 1.2 },
  'elephant-foret': { walk: 1, flee: 3.2, wary: 7, radius: 2.2 },
  'paon-congo': { walk: 0.7, flee: 3.8, wary: 7, radius: 0.5 },
}
