import * as THREE from 'three'

// Fourrure et cheveux courts « en coques » (shells).
//
// Les modèles Blender stockent la longueur des poils dans l'alpha de la
// texture couleur (0 = peau nue, 1 = poil le plus long) et leurs réglages dans
// les extras glTF du matériau (« urithi_fourrure » : longueur en mètres,
// nombre de couches). On superpose ici des copies du maillage gonflées le
// long des normales ; chaque couche ne garde que les brins assez longs, et
// les brins s'affinent vers la pointe. Les copies partagent la géométrie et
// le squelette : elles suivent animations et expressions sans coût mémoire.

const MAX_LAYERS = 10

function shellMaterial(base, layer, offset, density) {
  const m = base.clone()
  m.transparent = false
  m.alphaTest = 0
  m.userData = {}
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uShell = { value: offset }
    shader.uniforms.uLayer = { value: layer }
    shader.uniforms.uDensity = { value: density }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uShell;')
      // Normale de repos (avant le skinning) : le décalage suit ensuite les os.
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uShell;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uLayer;
uniform float uDensity;
float furHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  float hairLength = texture2D(map, vMapUv).a;
  vec2 cell = vMapUv * uDensity;
  vec2 id = floor(cell);
  vec2 jitter = vec2(furHash(id), furHash(id + 17.3)) - 0.5;
  float r = length(fract(cell) - 0.5 + jitter * 0.5);
  if (hairLength < uLayer || r > 0.45 * (1.0 - uLayer) + 0.06) discard;
  diffuseColor.rgb *= 0.55 + 0.5 * uLayer; // racines dans l'ombre
  diffuseColor.a = 1.0;
}`,
      )
  }
  m.customProgramCacheKey = () => `urithi-fur-${layer.toFixed(3)}`
  return m
}

// Ajoute les coques à tous les maillages concernés d'un modèle cloné.
export function addFur(root) {
  const targets = []
  root.traverse((o) => {
    const settings = o.isMesh && o.material?.userData?.urithi_fourrure
    if (settings && o.material.map) targets.push([o, settings])
  })
  const scale = new THREE.Vector3()
  for (const [mesh, settings] of targets) {
    root.updateMatrixWorld(true)
    mesh.getWorldScale(scale)
    const layers = Math.min(MAX_LAYERS, settings.couches ?? 8)
    // Longueur exprimée dans le repère de l'objet (certains maillages sont à
    // l'échelle MakeHuman, × 10).
    const length = (settings.longueur ?? 0.01) / (scale.x || 1)
    const density = settings.motif === 'boucles serrées' ? 520 : 380
    for (let i = 1; i <= layers; i++) {
      const h = i / layers
      const material = shellMaterial(mesh.material, h, h * length, density)
      const shell = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, material) : new THREE.Mesh(mesh.geometry, material)
      if (mesh.isSkinnedMesh) shell.bind(mesh.skeleton, mesh.bindMatrix)
      shell.position.copy(mesh.position)
      shell.quaternion.copy(mesh.quaternion)
      shell.scale.copy(mesh.scale)
      shell.morphTargetInfluences = mesh.morphTargetInfluences // suit les expressions
      shell.morphTargetDictionary = mesh.morphTargetDictionary
      shell.castShadow = false
      shell.frustumCulled = false
      mesh.parent.add(shell)
    }
  }
  return targets.length
}
