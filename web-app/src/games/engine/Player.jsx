import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useHd } from '../hd/assets.js'
import { HdCharacter, HdOr } from '../hd/HdModels.jsx'
import { Humanoid } from '../models/Humanoid.jsx'
import { PLAY_RADIUS, zoneAt } from '../world/ituri/catalog.js'
import { inWater, surfaceHeight } from '../world/ituri/terrain.js'
import { useRuntime } from './runtime.js'

// Personnage du joueur : déplacements relatifs à la caméra, course, saut,
// gravité, collisions, caméra à la troisième personne, détection des zones
// et des éléments proches.

// Vitesses (m/s) proches d'une marche soutenue et d'un petit footing : les
// animations du pack HD sont accélérées d'autant (voir HdCharacter), pour que
// les pieds restent posés au sol au lieu de glisser à grandes enjambées.
const WALK = 1.8
const RUN = 4.0
const JUMP = 6.4
const GRAVITY = 19
const RADIUS = 0.4

const camTarget = new THREE.Vector3()
const camWanted = new THREE.Vector3()
const move = new THREE.Vector3()

export function Player({ input, outfit, avatar = 'joueur' }) {
  const runtime = useRuntime()
  const hd = useHd()
  const group = useRef()
  const motion = useRef({ speed: 0, mps: 0, air: false })
  const { camera } = useThree()
  const timers = useRef({ zone: 0, save: 0, step: 0, distance: 0, seconds: 0, zoneId: null })
  const initialised = useRef(false)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const p = runtime.player
    const look = input.look
    if (!initialised.current) {
      p.pos.y = surfaceHeight(p.pos.x, p.pos.z)
      look.yaw = p.ry + Math.PI
      camera.position.set(p.pos.x + Math.sin(look.yaw) * 8, p.pos.y + 4, p.pos.z + Math.cos(look.yaw) * 8)
      initialised.current = true
    }

    const active = !runtime.paused
    const axis = active ? input.axis() : { x: 0, y: 0 }
    // Rotation de la caméra : flèches gauche et droite (tour complet possible).
    const turn = active ? input.turn() : 0
    if (turn) {
      look.yaw -= turn * 2.4 * dt
      input.lastLook = performance.now()
    }
    // En marche, la caméra revient doucement derrière le personnage (sauf
    // juste après un réglage manuel) : tourner avec Q/D ou A/D fait ainsi
    // pivoter la vue, jusqu'à un tour complet.
    if (active && (axis.x || axis.y > 0) && performance.now() - input.lastLook > 1200) {
      const behind = p.ry + Math.PI
      const delta = Math.atan2(Math.sin(behind - look.yaw), Math.cos(behind - look.yaw))
      look.yaw += delta * (1 - Math.exp(-dt * 1.6))
    }
    const running = active && input.running()
    const water = inWater(p.pos.x, p.pos.z)
    p.inWater = water
    const top = (running ? RUN : WALK) * (water ? 0.55 : 1)
    // Direction relative à la caméra.
    const fx = -Math.sin(look.yaw)
    const fz = -Math.cos(look.yaw)
    move.set(fx * axis.y + Math.cos(look.yaw) * axis.x, 0, fz * axis.y - Math.sin(look.yaw) * axis.x)
    const amount = Math.min(1, move.length())
    if (amount > 0.01) move.normalize()
    const accel = 1 - Math.exp(-dt * (p.grounded ? 10 : 2.5))
    p.vel.x += (move.x * top * amount - p.vel.x) * accel
    p.vel.z += (move.z * top * amount - p.vel.z) * accel

    if (active && input.jumpQueued && p.grounded && !water) {
      p.vel.y = JUMP
      p.grounded = false
      runtime.callbacks.onJump?.()
    }
    input.jumpQueued = false
    p.vel.y -= GRAVITY * dt

    const before = { x: p.pos.x, z: p.pos.z }
    p.pos.x += p.vel.x * dt
    p.pos.z += p.vel.z * dt
    // Obstacles : le joueur glisse le long des troncs et des murs.
    for (const c of runtime.queryColliders(p.pos.x, p.pos.z)) {
      const dx = p.pos.x - c.x
      const dz = p.pos.z - c.z
      const d = Math.hypot(dx, dz)
      const min = c.r + RADIUS
      if (d < min && d > 0.0001) {
        p.pos.x = c.x + (dx / d) * min
        p.pos.z = c.z + (dz / d) * min
      }
    }
    for (const it of runtime.interactables.values()) {
      if (!it.solid) continue
      const ip = it.getPosition()
      const dx = p.pos.x - ip.x
      const dz = p.pos.z - ip.z
      const d = Math.hypot(dx, dz)
      const min = it.solid + RADIUS
      if (d < min && d > 0.0001) {
        p.pos.x = ip.x + (dx / d) * min
        p.pos.z = ip.z + (dz / d) * min
      }
    }
    // Limite de la zone jouable.
    const r = Math.hypot(p.pos.x, p.pos.z)
    if (r > PLAY_RADIUS) {
      p.pos.x *= PLAY_RADIUS / r
      p.pos.z *= PLAY_RADIUS / r
    }
    const ground = surfaceHeight(p.pos.x, p.pos.z)
    // Pente trop raide : on reste en place.
    if (p.grounded && ground - p.pos.y > 0.9) {
      p.pos.x = before.x
      p.pos.z = before.z
    }
    p.pos.y += p.vel.y * dt
    const floor = surfaceHeight(p.pos.x, p.pos.z)
    if (p.pos.y <= floor) {
      if (!p.grounded && p.vel.y < -4) runtime.callbacks.onLand?.()
      p.pos.y = floor
      p.vel.y = 0
      p.grounded = true
    } else if (p.pos.y - floor > 0.25) {
      p.grounded = false
    } else if (p.vel.y <= 0) {
      p.pos.y = floor
      p.vel.y = 0
      p.grounded = true
    }

    const horizontal = Math.hypot(p.vel.x, p.vel.z)
    if (horizontal > 0.3) {
      const target = Math.atan2(p.vel.x, p.vel.z)
      let delta = target - p.ry
      delta = Math.atan2(Math.sin(delta), Math.cos(delta))
      p.ry += delta * (1 - Math.exp(-dt * 12))
    }
    motion.current.speed = horizontal < 0.2 ? 0 : horizontal / WALK
    motion.current.mps = horizontal
    motion.current.air = !p.grounded
    if (group.current) {
      group.current.position.set(p.pos.x, p.pos.y - (water ? 0.35 : 0), p.pos.z)
      group.current.rotation.y = p.ry
    }

    // Caméra à la troisième personne, au-dessus du sol.
    const head = p.pos.y + 1.55
    camTarget.set(p.pos.x, head, p.pos.z)
    const d = look.distance
    camWanted.set(
      p.pos.x + Math.sin(look.yaw) * Math.cos(look.pitch) * d,
      head + Math.sin(look.pitch) * d,
      p.pos.z + Math.cos(look.yaw) * Math.cos(look.pitch) * d,
    )
    const groundAtCam = surfaceHeight(camWanted.x, camWanted.z) + 0.6
    if (camWanted.y < groundAtCam) camWanted.y = groundAtCam
    camera.position.lerp(camWanted, 1 - Math.exp(-dt * 8))
    camera.lookAt(camTarget)

    // Pas, distance parcourue, zones, élément le plus proche, sauvegarde.
    const t = timers.current
    const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z)
    if (p.grounded && moved > 0.001) {
      t.distance += moved
      t.step += moved
      if (t.step > (running ? 1.0 : 0.65)) {
        t.step = 0
        runtime.callbacks.onStep?.(water)
      }
    }
    if (active) t.seconds += dt
    t.zone -= dt
    if (t.zone <= 0) {
      t.zone = 0.25
      const zone = zoneAt(p.pos.x, p.pos.z)
      if (zone !== t.zoneId) {
        t.zoneId = zone
        runtime.callbacks.onZone?.(zone)
      }
      runtime.callbacks.onPosition?.(p.pos, p.ry, water)
    }
    let nearest = null
    let best = Infinity
    for (const it of runtime.interactables.values()) {
      const ip = it.getPosition()
      const dist = Math.hypot(ip.x - p.pos.x, ip.z - p.pos.z)
      if (dist < it.radius && dist < best) {
        best = dist
        nearest = it
      }
    }
    if (nearest !== runtime.nearest) {
      runtime.nearest = nearest
      runtime.callbacks.onNear?.(nearest)
    }
    if (input.interactQueued) {
      input.interactQueued = false
      if (active && nearest) runtime.callbacks.onInteract?.(nearest, { running })
    }
    t.save -= dt
    if (t.save <= 0) {
      t.save = 5
      runtime.callbacks.onSave?.({ x: p.pos.x, z: p.pos.z, ry: p.ry }, { seconds: t.seconds, distance: t.distance })
      t.seconds = 0
      t.distance = 0
    }
  })

  return (
    <group ref={group}>
      <HdOr hd={hd} fallback={<Humanoid motion={motion} outfit={outfit} accessories="explorer" />}>
        <HdCharacter id={avatar} motion={motion} />
      </HdOr>
      {/* Ombre de contact douce, visible même sans ombres portées */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 16]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  )
}
