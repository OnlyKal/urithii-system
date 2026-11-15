import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { contentName } from '../../core/content.js'
import { useRuntime } from '../../engine/runtime.js'
import { useHd } from '../../hd/assets.js'
import { HdAnimal, HdCharacter, HdOr, HdStatic, HdTree } from '../../hd/HdModels.jsx'
import { ANIMAL_BEHAVIOUR, ANIMAL_MODELS } from '../../models/animals.jsx'
import { Bridge, FirePit, Granary, House, RoundHut, StationDecor, UrithiPost } from '../../models/buildings.jsx'
import { Humanoid } from '../../models/Humanoid.jsx'
import { foliageMaterial, lianaTree, limbaliTree, palmTree, parasolTree } from '../../models/vegetation.js'
import { usePlatform } from '../../core/platform.js'
import { NPCS, PANORAMA, SUBJECTS, TRACES, villageStations } from './catalog.js'
import { FIRE, HUTS } from './layout.js'
import { BRIDGE, groundHeight, inWater } from './terrain.js'

// Éléments vivants et interactifs : arbres remarquables, animaux,
// personnages, espaces du village, et leurs marqueurs.

// Enregistre un élément interactif auprès du moteur.
function useInteractable(entry) {
  const runtime = useRuntime()
  useEffect(() => {
    runtime.interactables.set(entry.id, entry)
    return () => runtime.interactables.delete(entry.id)
  }, [runtime, entry])
}

// Losange flottant au-dessus d'un élément : menthe pour une cible de la
// mission en cours, blanc sinon ; masqué une fois l'élément découvert.
function Marker({ id, height }) {
  const runtime = useRuntime()
  const ref = useRef()
  const material = useRef()
  useFrame((state) => {
    if (!ref.current) return
    const target = runtime.targets.has(id)
    const visible = target || !runtime.done.has(id)
    ref.current.visible = visible
    if (!visible) return
    const t = state.clock.elapsedTime
    ref.current.position.y = height + Math.sin(t * 2 + height) * 0.15
    ref.current.rotation.y = t * 1.5
    const s = target ? 1 + Math.sin(t * 4) * 0.12 : 0.7
    ref.current.scale.setScalar(s)
    material.current.color.set(target ? '#29cb94' : '#ffffff')
    material.current.emissive.set(target ? '#29cb94' : '#ffe9c4')
  })
  return (
    <mesh ref={ref}>
      <octahedronGeometry args={[0.32, 0]} />
      <meshStandardMaterial ref={material} emissiveIntensity={0.8} roughness={0.3} transparent opacity={0.92} />
    </mesh>
  )
}

const SPECIMEN_MODEL = { palmier: palmTree, parasolier: parasolTree, limbali: limbaliTree, fumbwa: lianaTree }

function Specimen({ subject, material }) {
  const hd = useHd()
  const make = SPECIMEN_MODEL[subject.id]
  const geometry = useMemo(() => make(), [make])
  useEffect(() => () => geometry.dispose(), [geometry])
  const y = groundHeight(subject.x, subject.z)
  const entry = useMemo(() => {
    const position = new THREE.Vector3(subject.x, y, subject.z)
    return { id: subject.id, kind: 'plant', name: contentName(subject.id), radius: 4.2, solid: subject.id === 'limbali' ? 0.9 : 0.5, getPosition: () => position }
  }, [subject, y])
  useInteractable(entry)
  return (
    <group position={[subject.x, y, subject.z]}>
      {subject.id === 'limbali' ? (
        // Arbre remarquable : modèle HD complet, avec ses fougères épiphytes.
        <HdOr hd={hd} fallback={<mesh geometry={geometry} material={material} castShadow receiveShadow scale={1.1} />}>
          <HdTree scale={0.55} />
        </HdOr>
      ) : (
        <mesh geometry={geometry} material={material} castShadow receiveShadow />
      )}
      <group position={[0, 0, 0]}>
        <Marker id={subject.id} height={subject.id === 'fumbwa' ? 3.2 : 3} />
      </group>
    </group>
  )
}

export function Specimens() {
  const material = useMemo(() => foliageMaterial({ windStart: 6, windAmp: 0.012 }), [])
  useFrame((state) => {
    material.userData.uniforms.uTime.value = state.clock.elapsedTime
  })
  useEffect(() => () => material.dispose(), [material])
  return SUBJECTS.filter((s) => s.kind === 'plant').map((s) => <Specimen key={s.id} subject={s} material={material} />)
}

// Animal : se promène autour de son domaine, broute, et s'enfuit si l'on
// s'approche en courant.
function Animal({ subject }) {
  const runtime = useRuntime()
  const Model = ANIMAL_MODELS[subject.id]
  const behaviour = ANIMAL_BEHAVIOUR[subject.id]
  const group = useRef()
  const motion = useRef({ speed: 0 })
  const position = useMemo(() => new THREE.Vector3(subject.x, groundHeight(subject.x, subject.z), subject.z), [subject])
  const brain = useRef({ target: null, wait: 2 + Math.random() * 3, ry: Math.random() * 6, fleeing: 0 })
  const entry = useMemo(
    () => ({ id: subject.id, kind: 'animal', name: contentName(subject.id), radius: 7.5, solid: behaviour.radius, getPosition: () => position, animal: true }),
    [subject, position, behaviour],
  )
  useInteractable(entry)

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const b = brain.current
    const player = runtime.player
    const dx = position.x - player.pos.x
    const dz = position.z - player.pos.z
    const dist = Math.hypot(dx, dz)
    const playerSpeed = Math.hypot(player.vel.x, player.vel.z)
    // Un joueur qui court tout près effraie l'animal.
    if (dist < behaviour.wary && playerSpeed > 5) {
      b.fleeing = 2.5
      const away = Math.atan2(dx, dz)
      b.target = { x: position.x + Math.sin(away) * 14, z: position.z + Math.cos(away) * 14 }
      runtime.callbacks.onAnimalFlee?.(subject.id)
    }
    let speed = 0
    if (b.target) {
      const tx = b.target.x - position.x
      const tz = b.target.z - position.z
      const remaining = Math.hypot(tx, tz)
      const homeDist = Math.hypot(b.target.x - subject.x, b.target.z - subject.z)
      if (remaining < 0.6 || homeDist > subject.roam * 1.8 || inWater(b.target.x, b.target.z)) {
        b.target = null
        b.wait = 3 + Math.random() * 5
      } else {
        speed = b.fleeing > 0 ? behaviour.flee : behaviour.walk
        const want = Math.atan2(tx, tz)
        const delta = Math.atan2(Math.sin(want - b.ry), Math.cos(want - b.ry))
        b.ry += delta * (1 - Math.exp(-dt * 3))
        position.x += Math.sin(b.ry) * speed * dt
        position.z += Math.cos(b.ry) * speed * dt
      }
    } else {
      b.wait -= dt
      if (b.wait <= 0) {
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * subject.roam
        b.target = { x: subject.x + Math.cos(a) * r, z: subject.z + Math.sin(a) * r }
      }
    }
    b.fleeing = Math.max(0, b.fleeing - dt)
    position.y = groundHeight(position.x, position.z)
    motion.current.speed = speed === 0 ? 0 : speed / behaviour.walk > 2 ? 2 : 1
    if (group.current) {
      group.current.position.copy(position)
      group.current.rotation.y = b.ry
    }
  })

  const hd = useHd()
  return (
    <group ref={group}>
      <HdOr hd={hd} fallback={<Model motion={motion} />}>
        <HdAnimal id={subject.id} motion={motion} />
      </HdOr>
      <Marker id={subject.id} height={subject.id === 'elephant-foret' ? 4.4 : subject.id === 'okapi' ? 3 : 1.7} />
    </group>
  )
}

export function Animals() {
  return SUBJECTS.filter((s) => s.kind === 'animal').map((s) => <Animal key={s.id} subject={s} />)
}

function Npc({ npc }) {
  const runtime = useRuntime()
  const hd = useHd()
  const motion = useRef({ speed: 0, talk: false })
  const group = useRef()
  const y = groundHeight(npc.x, npc.z)
  const position = useMemo(() => new THREE.Vector3(npc.x, y, npc.z), [npc, y])
  const entry = useMemo(() => ({ id: npc.id, kind: 'npc', name: `${npc.name} · ${npc.role}`, radius: 3.4, solid: 0.45, getPosition: () => position, npc }), [npc, position])
  useInteractable(entry)
  // Se tourne vers le joueur lorsqu'il approche.
  useFrame((_, dt) => {
    const p = runtime.player.pos
    const dist = Math.hypot(p.x - npc.x, p.z - npc.z)
    motion.current.talk = runtime.talking === npc.id
    motion.current.near = dist < 6
    const want = dist < 6 ? Math.atan2(p.x - npc.x, p.z - npc.z) : npc.ry
    if (group.current) {
      const r = group.current.rotation
      r.y += Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y)) * (1 - Math.exp(-dt * 4))
    }
  })
  return (
    <group position={[npc.x, y, npc.z]}>
      <group ref={group} rotation={[0, npc.ry, 0]}>
        <HdOr hd={hd} fallback={<Humanoid motion={motion} outfit={npc.outfit} accessories={npc.id === 'ecogarde' ? 'ranger' : 'none'} />}>
          <HdCharacter id={npc.id} motion={motion} />
        </HdOr>
      </group>
      <Marker id={npc.id} height={2.5} />
    </group>
  )
}

export function Npcs() {
  return NPCS.map((n) => <Npc key={n.id} npc={n} />)
}

const POST_COLOR = { memoire: '#ffb547', langues: '#ffb547', savoirs: '#ffb547', communautes: '#c2552b', mediatheque: '#3f5ca6' }

function Station({ station }) {
  const y = groundHeight(station.x, station.z)
  const position = useMemo(() => new THREE.Vector3(station.x, y, station.z), [station, y])
  const entry = useMemo(() => ({ id: station.id, kind: 'station', name: station.name, radius: station.icon === 'palaver' ? 4.4 : 3.6, solid: station.icon === 'palaver' ? 0.7 : undefined, getPosition: () => position, station }), [station, position])
  useInteractable(entry)
  const tall = station.icon === 'memory' || station.icon === 'palaver'
  return (
    <group position={[station.x, y, station.z]} rotation={[0, ['theme', 'media'].includes(station.icon) ? Math.atan2(-30 - station.x, 20 - station.z) : 0, 0]}>
      <StationDecor kind={station.icon} />
      <group position={[tall ? 2.2 : 1.6, 0, 1.4]}>
        <UrithiPost color={POST_COLOR[station.id] ?? (station.icon === 'theme' ? '#ffd08a' : '#29cb94')} />
      </group>
      <Marker id={station.id} height={station.icon === 'palaver' ? 7 : tall ? 4 : 2.8} />
    </group>
  )
}

// Espaces du village : suivent le référentiel publié (catégories racines).
function Stations() {
  const platform = usePlatform()
  const stations = useMemo(() => villageStations(platform.roots), [platform.roots])
  return stations.map((s) => <Station key={s.id} station={s} />)
}

// Bornes d'observation des fiches de l'atlas sans modèle 3D.
function Trace({ trace }) {
  const y = groundHeight(trace.x, trace.z)
  const position = useMemo(() => new THREE.Vector3(trace.x, y, trace.z), [trace, y])
  const entry = useMemo(() => ({ id: trace.id, kind: 'trace', traceKind: trace.kind, name: contentName(trace.id), radius: 3, solid: 0.2, getPosition: () => position }), [trace, position])
  useInteractable(entry)
  return (
    <group position={[trace.x, y, trace.z]} rotation={[0, trace.x * 7.3, 0]}>
      <StationDecor kind="trace" />
      <Marker id={trace.id} height={1.9} />
    </group>
  )
}

export function Traces() {
  return TRACES.map((t) => <Trace key={t.id} trace={t} />)
}

// Longue-vue du belvédère.
export function Panorama() {
  const y = groundHeight(PANORAMA.x, PANORAMA.z)
  const position = useMemo(() => new THREE.Vector3(PANORAMA.x, y, PANORAMA.z), [y])
  const entry = useMemo(() => ({ id: PANORAMA.id, kind: 'panorama', name: 'longue-vue', radius: 3.2, solid: 0.3, getPosition: () => position }), [position])
  useInteractable(entry)
  return (
    <group position={[PANORAMA.x, y, PANORAMA.z]}>
      <StationDecor kind="spyglass" />
      <Marker id={PANORAMA.id} height={2.4} />
    </group>
  )
}

const HD_HUT = { house: 'maison', granary: 'grenier', round: 'case' }

export function Village() {
  const hd = useHd()
  return (
    <group>
      {HUTS.map((h, i) => {
        const Model = h.kind === 'house' ? House : h.kind === 'granary' ? Granary : RoundHut
        return (
          <group key={i} position={[h.x, h.y - 0.05, h.z]} rotation={[0, h.ry, 0]}>
            <HdOr hd={hd} fallback={<Model scale={h.s} />}>
              <HdStatic id={HD_HUT[h.kind] ?? 'case'} scale={h.s} />
            </HdOr>
          </group>
        )
      })}
      <group position={[FIRE.x, groundHeight(FIRE.x, FIRE.z), FIRE.z]}>
        <FirePit />
      </group>
      <Stations />
      <Bridge x0={BRIDGE.x0} x1={BRIDGE.x1} z={BRIDGE.z} deck={BRIDGE.deck} />
    </group>
  )
}
