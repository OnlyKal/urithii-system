import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

// Personnage humain stylisé, articulé (hanches, genoux, épaules, coudes),
// animé par le code : repos, marche, course, saut, conversation.
//
// « motion » est une référence partagée avec le contrôleur :
//   { speed: 0 (arrêt) → 1 (marche) → 2 (course), air: bool, talk: bool }

function Limb({ upper, lower, radius, color, lowerColor = color, children, refs }) {
  return (
    <group ref={refs[0]}>
      <mesh position={[0, -upper / 2, 0]} castShadow>
        <capsuleGeometry args={[radius, upper - radius * 2, 3, 8]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
      <group ref={refs[1]} position={[0, -upper, 0]}>
        <mesh position={[0, -lower / 2, 0]} castShadow>
          <capsuleGeometry args={[radius * 0.9, lower - radius * 1.8, 3, 8]} />
          <meshStandardMaterial color={lowerColor} roughness={0.85} />
        </mesh>
        {children}
      </group>
    </group>
  )
}

export function Humanoid({ motion, outfit, accessories = 'none' }) {
  const hips = useRef()
  const torso = useRef()
  const head = useRef()
  const legL = [useRef(), useRef()]
  const legR = [useRef(), useRef()]
  const armL = [useRef(), useRef()]
  const armR = [useRef(), useRef()]
  const phase = useRef(Math.random() * 10)
  const { skin = '#6b4423', shirt = '#29cb94', pants = '#2f3b52', hat, wrap, shoes = '#3a2a1c' } = outfit

  useFrame((state, dt) => {
    const m = motion.current
    const speed = m.speed ?? 0
    const t = state.clock.elapsedTime
    phase.current += dt * (speed > 0.05 ? 5.2 + speed * 2.6 : 0)
    const p = phase.current
    const amp = Math.min(1, speed) * 0.55 + Math.max(0, speed - 1) * 0.35
    const swing = Math.sin(p) * amp
    const ease = 1 - Math.exp(-dt * 12)
    const to = (ref, x) => {
      if (ref.current) ref.current.rotation.x += (x - ref.current.rotation.x) * ease
    }
    if (m.air) {
      to(legL[0], -0.7); to(legL[1], 1.1); to(legR[0], -0.2); to(legR[1], 0.5)
      to(armL[0], -2.4); to(armR[0], -2.2); to(armL[1], -0.3); to(armR[1], -0.3)
    } else {
      to(legL[0], swing); to(legR[0], -swing)
      to(legL[1], Math.max(0, -Math.sin(p + 0.6)) * amp * 1.6)
      to(legR[1], Math.max(0, Math.sin(p + 0.6)) * amp * 1.6)
      const talkArm = m.talk ? -0.5 + Math.sin(t * 3) * 0.25 : 0
      to(armL[0], -swing * 0.9 + (speed < 0.05 ? Math.sin(t * 1.4) * 0.04 : 0))
      to(armR[0], swing * 0.9 + talkArm)
      to(armL[1], -0.25 - amp * 0.6)
      to(armR[1], -0.25 - amp * 0.6 + (m.talk ? -0.6 : 0))
    }
    if (hips.current) hips.current.position.y = 0.95 + Math.abs(Math.cos(p)) * amp * 0.07 + (speed < 0.05 ? Math.sin(t * 1.6) * 0.008 : 0)
    if (torso.current) torso.current.rotation.x = speed * 0.07 + (m.air ? 0.1 : 0)
    if (head.current) head.current.rotation.y = m.talk ? Math.sin(t * 0.9) * 0.15 : Math.sin(t * 0.35) * 0.08
  })

  return (
    <group ref={hips} position={[0, 0.95, 0]}>
      {/* Jambes */}
      <group position={[-0.12, 0, 0]}>
        <Limb upper={0.46} lower={0.46} radius={0.085} color={pants} refs={legL}>
          <mesh position={[0, -0.47, 0.05]} castShadow>
            <boxGeometry args={[0.13, 0.08, 0.26]} />
            <meshStandardMaterial color={shoes} roughness={0.9} />
          </mesh>
        </Limb>
      </group>
      <group position={[0.12, 0, 0]}>
        <Limb upper={0.46} lower={0.46} radius={0.085} color={pants} refs={legR}>
          <mesh position={[0, -0.47, 0.05]} castShadow>
            <boxGeometry args={[0.13, 0.08, 0.26]} />
            <meshStandardMaterial color={shoes} roughness={0.9} />
          </mesh>
        </Limb>
      </group>
      {/* Buste */}
      <group ref={torso}>
        <mesh position={[0, 0.3, 0]} castShadow>
          <capsuleGeometry args={[0.21, 0.32, 4, 10]} />
          <meshStandardMaterial color={shirt} roughness={0.8} />
        </mesh>
        {wrap && (
          <mesh position={[0, 0.02, 0]} castShadow>
            <cylinderGeometry args={[0.25, 0.3, 0.42, 10]} />
            <meshStandardMaterial color={wrap} roughness={0.8} />
          </mesh>
        )}
        {accessories === 'explorer' && (
          <>
            {/* Sac à dos et foulard aux couleurs d'URITHI */}
            <mesh position={[0, 0.32, -0.24]} castShadow>
              <boxGeometry args={[0.32, 0.4, 0.16]} />
              <meshStandardMaterial color="#ffb547" roughness={0.7} />
            </mesh>
            <mesh position={[0, 0.56, 0.02]} rotation={[0.2, 0, 0]}>
              <torusGeometry args={[0.15, 0.045, 6, 12]} />
              <meshStandardMaterial color="#29cb94" roughness={0.7} />
            </mesh>
          </>
        )}
        {accessories === 'ranger' && (
          <mesh position={[0.1, 0.4, 0.2]}>
            <boxGeometry args={[0.1, 0.07, 0.02]} />
            <meshStandardMaterial color="#ffb547" />
          </mesh>
        )}
        {/* Tête */}
        <group ref={head} position={[0, 0.72, 0]}>
          <mesh position={[0, -0.1, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.12, 8]} />
            <meshStandardMaterial color={skin} roughness={0.7} />
          </mesh>
          <mesh castShadow>
            <sphereGeometry args={[0.16, 16, 12]} />
            <meshStandardMaterial color={skin} roughness={0.65} />
          </mesh>
          {/* Cheveux courts */}
          <mesh position={[0, 0.05, -0.02]} scale={[1.04, 0.85, 1.04]}>
            <sphereGeometry args={[0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#1b1410" roughness={1} />
          </mesh>
          {/* Yeux */}
          {[-0.055, 0.055].map((x) => (
            <mesh key={x} position={[x, 0.02, 0.145]}>
              <sphereGeometry args={[0.02, 6, 6]} />
              <meshStandardMaterial color="#120c08" />
            </mesh>
          ))}
          {hat && (
            <group position={[0, 0.1, 0]}>
              <mesh>
                <cylinderGeometry args={[0.17, 0.17, 0.1, 12]} />
                <meshStandardMaterial color={hat} roughness={0.8} />
              </mesh>
              <mesh position={[0, -0.04, 0.1]} rotation={[0.1, 0, 0]}>
                <boxGeometry args={[0.3, 0.02, 0.18]} />
                <meshStandardMaterial color={hat} roughness={0.8} />
              </mesh>
            </group>
          )}
        </group>
        {/* Bras */}
        <group position={[-0.29, 0.48, 0]} rotation={[0, 0, -0.08]}>
          <Limb upper={0.32} lower={0.3} radius={0.06} color={shirt} lowerColor={skin} refs={armL} />
        </group>
        <group position={[0.29, 0.48, 0]} rotation={[0, 0, 0.08]}>
          <Limb upper={0.32} lower={0.3} radius={0.06} color={shirt} lowerColor={skin} refs={armR} />
        </group>
      </group>
    </group>
  )
}
