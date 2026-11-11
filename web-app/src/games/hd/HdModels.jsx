import { useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Component, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useRuntime } from '../engine/runtime.js'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { useHdModel } from './assets.js'
import { addFur } from './fur.js'

// Modèles réalistes du pack HD : personnages, animaux, habitations, arbres.
// Chacun s'affiche à la place du modèle stylisé dès qu'il est chargé ; en
// cas d'échec (fichier absent, réseau), le modèle stylisé reste affiché.

class Fallback extends Component {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error) {
    console.warn('Pack HD indisponible, modèle stylisé conservé :', error?.message)
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

// Affiche « children » (modèle HD) avec repli sur « fallback » (stylisé)
// pendant le chargement et en cas d'erreur.
export function HdOr({ hd, fallback, children }) {
  if (!hd) return fallback
  return (
    <Fallback fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </Fallback>
  )
}

function useClone(key, { skinned = false, fur = false } = {}) {
  const gltf = useHdModel(key)
  return useMemo(() => {
    const scene = skinned ? cloneSkinned(gltf.scene) : gltf.scene.clone(true)
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        // Les maillages animés sortent parfois de leur boîte englobante.
        if (o.isSkinnedMesh) o.frustumCulled = false
      }
    })
    if (fur) addFur(scene)
    return { scene, animations: gltf.animations }
  }, [gltf, skinned, fur])
}

function morphMeshes(scene) {
  const list = []
  scene.traverse((o) => {
    if (o.morphTargetDictionary && o.morphTargetInfluences) list.push(o)
  })
  return list
}

function setMorph(meshes, name, value) {
  for (const m of meshes) {
    const i = m.morphTargetDictionary[name]
    if (i !== undefined) m.morphTargetInfluences[i] = value
  }
}

// Joue l'animation correspondant à l'état (« repos », « marche », « course »,
// « parole ») avec un fondu enchaîné.
function useStateClip(actions, motion, { speedFor } = {}) {
  const current = useRef(null)
  useFrame(() => {
    const m = motion.current
    const name = m.talk && actions.parole ? 'parole' : m.speed >= 1.5 ? 'course' : m.speed > 0.05 ? 'marche' : 'repos'
    const action = actions[name] ?? actions.repos
    // isRunning() : en mode strict, React démonte puis remonte le composant ;
    // l'action en cours est alors arrêtée et doit être relancée.
    if (!action || (current.current === action && action.isRunning())) {
      if (action && speedFor) action.timeScale = speedFor(m, name)
      return
    }
    action.reset().fadeIn(0.25).play()
    if (current.current && current.current !== action) current.current.fadeOut(0.25)
    current.current = action
  })
}

// Personnage : animations du squelette, clignement des yeux aléatoire,
// bouche pendant les dialogues, léger sourire face au joueur.
export function HdCharacter({ id, motion }) {
  const { scene, animations } = useClone(id, { skinned: true, fur: true })
  const group = useRef()
  const { actions } = useAnimations(animations, group)
  const morphs = useMemo(() => morphMeshes(scene), [scene])
  const face = useRef({ nextBlink: 1 + Math.random() * 3, blink: 0, smile: 0 })
  useStateClip(actions, motion, { speedFor: (m, name) => (name === 'marche' ? Math.max(0.8, m.speed) : 1) })
  useFrame((state, dt) => {
    const f = face.current
    const t = state.clock.elapsedTime
    f.nextBlink -= dt
    if (f.nextBlink <= 0) {
      f.blink = 1
      f.nextBlink = 2 + Math.random() * 4
    }
    f.blink = Math.max(0, f.blink - dt * 8)
    const talking = motion.current.talk
    const mouth = talking ? 0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 5.3 + 1) : 0
    f.smile += ((talking || motion.current.near ? 0.35 : 0) - f.smile) * Math.min(1, dt * 3)
    setMorph(morphs, 'clignement', Math.sin(f.blink * Math.PI))
    setMorph(morphs, 'parole', Math.max(0, mouth))
    setMorph(morphs, 'sourire', f.smile)
  })
  return <primitive ref={group} object={scene} />
}

// Animal : repos (broute), marche, course (fuite).
export function HdAnimal({ id, motion }) {
  const { scene, animations } = useClone(id, { skinned: true, fur: true })
  const group = useRef()
  const { actions } = useAnimations(animations, group)
  useStateClip(actions, motion)
  return <primitive ref={group} object={scene} />
}

// Modèle fixe (habitations).
export function HdStatic({ id, scale = 1 }) {
  const { scene } = useClone(id)
  return <primitive object={scene} scale={scale} />
}

// Modèle instancié : un appel de rendu par maillage du modèle, pour toutes
// les copies (arbres, plantes). Les fougères épiphytes de l'arbre géant ne
// sont dessinées que sur l'arbre remarquable, pour limiter les triangles.
// « jitter » : variation de taille entre copies.
export function HdInstances({ id, items, scale = 1, shadows = true, jitter = 0.1, sink = 0.05 }) {
  const gltf = useHdModel(id)
  const parts = useMemo(() => {
    const out = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      if (!o.isMesh || o.name.startsWith('Epiphyte')) return
      out.push({ geometry: o.geometry, material: o.material, local: o.matrixWorld.clone() })
    })
    return out
  }, [gltf])
  return parts.map((p, i) => <InstancedPart key={i} part={p} items={items} scale={scale} shadows={shadows} jitter={jitter} sink={sink} />)
}

export const HdTrees = ({ items, scale = 0.5, shadows = true, id = 'arbre' }) => <HdInstances id={id} items={items} scale={scale} shadows={shadows} sink={0.1} />

function InstancedPart({ part, items, scale, shadows, jitter, sink }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    items.forEach((it, i) => {
      q.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, it.ry)
      const s = scale * it.s * (1 - jitter + ((i * 0.618) % 1) * jitter * 2)
      m.compose(new THREE.Vector3(it.x, it.y - sink, it.z), q, new THREE.Vector3(s, s, s)).multiply(part.local)
      mesh.setMatrixAt(i, m)
    })
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [items, scale, part, jitter, sink])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[part.geometry, part.material, items.length]} castShadow={shadows} receiveShadow frustumCulled={false} />
}

// Arbre isolé complet (avec épiphytes), pour l'arbre remarquable.
export function HdTree({ scale = 0.5 }) {
  const { scene } = useClone('arbre')
  return <primitive object={scene} scale={scale} />
}

// Niveau de détail par distance : les copies proches du joueur utilisent le
// modèle HD, les autres le modèle stylisé (léger), noyé dans la brume. La
// répartition est recalculée quand le joueur s'est déplacé de quelques mètres.
export function useNearSplit(items, radius) {
  const runtime = useRuntime()
  const last = useRef(null)
  const compute = (x, z) => {
    const near = []
    const far = []
    const r2 = radius * radius
    for (const it of items) ((it.x - x) ** 2 + (it.z - z) ** 2 < r2 ? near : far).push(it)
    return { near, far }
  }
  const [split, setSplit] = useState(() => compute(runtime.player.pos.x, runtime.player.pos.z))
  useFrame(() => {
    const p = runtime.player.pos
    if (last.current && Math.hypot(p.x - last.current.x, p.z - last.current.z) < radius * 0.12) return
    last.current = { x: p.x, z: p.z }
    setSplit(compute(p.x, p.z))
  })
  return split
}
