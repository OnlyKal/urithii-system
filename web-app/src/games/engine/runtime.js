import { createContext, useContext } from 'react'
import * as THREE from 'three'

// État de la partie partagé entre la scène 3D et l'interface, hors de React
// pour ne pas provoquer de rendu à chaque image : position du joueur,
// éléments interactifs, obstacles, et rappels vers l'interface.

export function createRuntime({ queryColliders, spawn, callbacks }) {
  return {
    player: {
      pos: new THREE.Vector3(spawn.x, 0, spawn.z),
      vel: new THREE.Vector3(),
      ry: spawn.ry ?? 0,
      grounded: true,
      inWater: false,
    },
    // id → { id, kind, name, radius, getPosition(): Vector3, height }
    interactables: new Map(),
    nearest: null,
    paused: true,
    queryColliders,
    callbacks,
    // Cibles de la mission en cours (marqueurs).
    targets: new Set(),
    done: new Set(),
  }
}

export const RuntimeContext = createContext(null)
export const useRuntime = () => useContext(RuntimeContext)
