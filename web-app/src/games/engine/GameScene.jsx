import { Environment, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { HDRI, HdContext, preloadHd } from '../hd/assets.js'
import { Butterflies, Birds, ForestMotes, LightShafts, Lighting } from '../world/ituri/Atmosphere.jsx'
import { Animals, Npcs, Panorama, Specimens, Traces, Village } from '../world/ituri/Inhabitants.jsx'
import { River, Terrain, Vegetation } from '../world/ituri/Landscape.jsx'
import { attachLook } from './input.js'
import { Player } from './Player.jsx'
import { QUALITY } from './quality.js'
import { RuntimeContext } from './runtime.js'
import { STAGES } from './stages.js'

// Scène 3D de la partie. Le monde est construit par étapes successives
// (terrain, arbres, sous-bois, village, habitants) : l'écran de chargement
// suit l'avancement réel, et le navigateur reste réactif.


function Advance({ stage, onStage }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    // Laisse le temps d'afficher l'étape, puis passe à la suivante.
    const id = setTimeout(() => {
      if (stage === STAGES.length - 1) gl.compile(scene, camera)
      onStage(stage + 1)
    }, 40)
    return () => clearTimeout(id)
  }, [stage, onStage, gl, scene, camera])
  return null
}

export default function GameScene({ quality, runtime, input, layout, outfit, avatar = 'joueur', onStage, stage }) {
  const q = QUALITY[quality]
  // Pack HD (modèles réalistes) : qualité « Haute » seulement.
  const hd = quality === 'high'
  useEffect(() => {
    if (hd) preloadHd(avatar)
  }, [hd, avatar])
  const [dpr, setDpr] = useState(q.dpr[1])
  const [element, setElement] = useState(null)
  useEffect(() => (element ? attachLook(element, input) : undefined), [element, input])
  // Brume : en HD, brume exponentielle dorée de sous-bois (comme les rendus de référence).
  const hdOn = quality === 'high'
  const fog = useMemo(() => (hdOn ? new THREE.FogExp2('#aeb796', 0.0075) : new THREE.Fog('#cddfd6', 28, q.far * 0.8)), [q.far, hdOn])

  return (
    <Canvas
      className="game-canvas"
      shadows={q.shadows ? 'soft' : false}
      dpr={dpr}
      camera={{ fov: 55, near: 0.1, far: q.far + 4500 }}
      gl={{ antialias: quality !== 'low', powerPreference: 'high-performance' }}
      onCreated={({ gl, scene }) => {
        // AgX en HD : rendu proche de Blender (mêmes réglages que les aperçus).
        gl.toneMapping = hdOn ? THREE.AgXToneMapping : THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = hdOn ? 1.0 : 1.05
        scene.fog = fog
        setElement(gl.domElement)
      }}
    >
      <PerformanceMonitor onDecline={() => setDpr((d) => Math.max(q.dpr[0], d - 0.25))} onIncline={() => setDpr((d) => Math.min(q.dpr[1], d + 0.25))} />
      <HdContext.Provider value={hd}>
      <RuntimeContext.Provider value={runtime}>
        {stage <= STAGES.length - 1 && <Advance stage={stage} onStage={onStage} />}
        {hd && stage >= 1 && (
          // Éclairage d'ambiance par l'HDRI de forêt tropicale (Poly Haven, CC0).
          <Suspense fallback={null}>
            <Environment files={HDRI} environmentIntensity={0.55} />
          </Suspense>
        )}
        {stage >= 1 && (
          <>
            <Lighting shadows={q.shadows} shadowSize={q.shadowSize} />
            <Terrain segments={q.terrain} />
            <River />
          </>
        )}
        {stage >= 2 && <Vegetation layout={layout} shadows={q.shadows} part="trees" />}
        {stage >= 3 && <Vegetation layout={layout} shadows={q.shadows} part="ground" />}
        {stage >= 4 && (
          <>
            <Village />
            <Specimens />
            <Traces />
            <Panorama />
          </>
        )}
        {stage >= 5 && (
          <>
            <Animals />
            <Npcs />
            <Player input={input} outfit={outfit} avatar={avatar} />
          </>
        )}
        {stage >= 6 && (
          <>
            <Butterflies count={quality === 'low' ? 12 : 26} />
            <Birds />
            {quality !== 'low' && <LightShafts />}
            <ForestMotes />
          </>
        )}
      </RuntimeContext.Provider>
      </HdContext.Provider>
    </Canvas>
  )
}
