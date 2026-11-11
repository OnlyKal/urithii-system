import * as THREE from 'three'

// Matériaux d'environnement du pack HD : sol photographique (Poly Haven,
// CC0) et eau de rivière forestière.

const SOL = '/games/hd/sol/'
const loader = new THREE.TextureLoader()

function tex(name, color = true) {
  const t = loader.load(`${SOL}${name}.jpg`)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (color) t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Sol : quatre textures projetées à plat (coordonnées du monde, environ une
// répétition pour 3 m), mélangées par des masques par sommet (attribut
// « masks » : latérite, boue, litière). Les couleurs par sommet du terrain
// stylisé nuancent légèrement le résultat. Relief : cartes de normales.
export function groundMaterial() {
  const maps = {
    uOpen: tex('sous_bois_couleur'),
    uLitter: tex('feuilles_couleur'),
    uSoil: tex('laterite_couleur'),
    uMud: tex('boue_couleur'),
    uOpenN: tex('sous_bois_normale', false),
    uLitterN: tex('feuilles_normale', false),
    uSoilN: tex('laterite_normale', false),
    uMudN: tex('boue_normale', false),
  }
  const m = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0, vertexColors: true })
  m.onBeforeCompile = (shader) => {
    for (const [k, v] of Object.entries(maps)) shader.uniforms[k] = { value: v }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 masks;\nvarying vec3 vMasks;\nvarying vec3 vGroundPos;\nvarying vec3 vGroundNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvMasks = masks;\nvGroundPos = (modelMatrix * vec4(position, 1.0)).xyz;\nvGroundNormal = normalize(mat3(modelMatrix) * normal);',
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform sampler2D uOpen; uniform sampler2D uLitter; uniform sampler2D uSoil; uniform sampler2D uMud;
uniform sampler2D uOpenN; uniform sampler2D uLitterN; uniform sampler2D uSoilN; uniform sampler2D uMudN;
varying vec3 vMasks; varying vec3 vGroundPos; varying vec3 vGroundNormal;
vec4 groundWeights() {
  // Bords irréguliers : léger bruit tiré de la texture de litière.
  float n = texture2D(uLitter, vGroundPos.xz * 0.031).g;
  float soil = smoothstep(0.25, 0.75, vMasks.x + (n - 0.5) * 0.5);
  float mud = smoothstep(0.2, 0.8, vMasks.y + (n - 0.5) * 0.4) * (1.0 - soil);
  float litter = smoothstep(0.2, 0.8, vMasks.z + (n - 0.5) * 0.6) * (1.0 - soil) * (1.0 - mud);
  float open = max(0.0, 1.0 - soil - mud - litter);
  return vec4(open, litter, soil, mud);
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
{
  vec2 uv = vGroundPos.xz / 3.0;
  // Seconde échelle, tournée, pour casser la répétition au loin.
  vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * vGroundPos.xz / 11.0;
  vec4 w = groundWeights();
  vec3 c = texture2D(uOpen, uv).rgb * w.x + texture2D(uLitter, uv).rgb * w.y + texture2D(uSoil, uv).rgb * w.z + texture2D(uMud, uv).rgb * w.w;
  vec3 c2 = texture2D(uOpen, uv2).rgb * w.x + texture2D(uLitter, uv2).rgb * w.y + texture2D(uSoil, uv2).rgb * w.z + texture2D(uMud, uv2).rgb * w.w;
  c = mix(c, c2, 0.35);
  // Couleur du terrain stylisé : nuance douce (zones plus vertes en lisière).
  diffuseColor.rgb = c * mix(vec3(1.0), vColor.rgb * 1.6, 0.25);
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec2 uv = vGroundPos.xz / 3.0;
  vec4 w = groundWeights();
  vec3 t = (texture2D(uOpenN, uv).xyz * w.x + texture2D(uLitterN, uv).xyz * w.y + texture2D(uSoilN, uv).xyz * w.z + texture2D(uMudN, uv).xyz * w.w) * 2.0 - 1.0;
  // Projection plane : la normale de la texture s'ajoute à celle du relief.
  vec3 worldN = normalize(vGroundNormal + vec3(t.x, 0.0, -t.y) * 0.9);
  normal = normalize((viewMatrix * vec4(worldN, 0.0)).xyz);
}`,
      )
      // Les couleurs par sommet servent de nuance, pas de multiplicateur direct.
      .replace('#include <color_fragment>', '')
  }
  m.customProgramCacheKey = () => 'urithi-sol-hd'
  return m
}

// Eau de rivière forestière : couleur thé (tanins), reflet du ciel selon
// l'angle (Fresnel), reflets du soleil sur des vaguelettes qui suivent le
// courant, transparence vers les berges, écume légère sur les rochers.
export const waterVertexHd = /* glsl */ `
#include <fog_pars_vertex>
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`

export const waterFragmentHd = /* glsl */ `
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uDeep;
uniform vec3 uShallow;
varying vec2 vUv;
varying vec3 vWorld;
#include <fog_pars_fragment>
vec2 wave(vec2 p, vec2 dir, float freq, float speed, float amp) {
  float ph = dot(p, dir) * freq + uTime * speed;
  return dir * cos(ph) * freq * amp;
}
void main() {
  vec2 p = vWorld.xz;
  // Pente des vaguelettes (somme de vagues orientées vers l'aval, -z).
  // Vaguelettes fines et irrégulières (directions et phases variées), plus
  // faibles au loin pour éviter les bandes (moiré).
  float dist = length(cameraPosition - vWorld);
  float fadeFar = 1.0 - smoothstep(8.0, 40.0, dist) * 0.8;
  vec2 g = wave(p, normalize(vec2(0.15, -1.0)), 1.3, 1.9, 0.018)
         + wave(p, normalize(vec2(-0.55, -0.83)), 2.7, 2.6, 0.012)
         + wave(p, normalize(vec2(0.72, -0.69)), 4.9, 3.3, 0.007)
         + wave(p, normalize(vec2(-0.25, -0.97)), 8.3, 4.6, 0.004)
         + wave(p, normalize(vec2(0.95, -0.3)), 13.1, 6.2, 0.0025);
  g *= fadeFar;
  vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
  vec3 view = normalize(cameraPosition - vWorld);
  float fresnel = 0.05 + 0.85 * pow(1.0 - max(dot(n, view), 0.0), 4.0);
  vec3 r = reflect(-view, n);
  vec3 sky = mix(uSkyHorizon, uSkyTop, smoothstep(0.0, 0.6, r.y));
  float edge = abs(vUv.x - 0.5) * 2.0;
  vec3 body = mix(uDeep, uShallow, smoothstep(0.35, 0.95, edge));
  vec3 col = mix(body, sky, fresnel);
  float sun = pow(max(dot(r, uSunDir), 0.0), 400.0);
  col += vec3(1.0, 0.93, 0.78) * sun * 1.4;
  // Reflets larges et doux de la lumière du sous-bois sur les ondulations.
  float sheen = pow(max(dot(r, normalize(uSunDir + vec3(0.0, 0.6, 0.0))), 0.0), 18.0);
  col += uSkyTop * sheen * 0.35;
  // Courant visible : traînées claires étirées dans le sens de l'écoulement.
  float flow = sin(p.x * 3.1 + sin(p.y * 0.35 + uTime * 0.4) * 2.0) * sin(p.y * 0.6 + uTime * 1.3);
  col += vec3(0.06, 0.06, 0.05) * smoothstep(0.55, 1.0, flow) * fadeFar;
  // Écume légère le long des berges, entraînée par le courant.
  float streak = sin(p.y * 0.9 + uTime * 1.6 + sin(p.x * 2.1) * 1.5) * 0.5 + 0.5;
  float foam = smoothstep(0.84, 0.98, edge) * smoothstep(0.55, 0.95, streak);
  col = mix(col, vec3(0.82, 0.84, 0.78), foam * 0.35);
  float alpha = mix(0.86, 0.0, smoothstep(0.9, 1.0, edge));
  gl_FragColor = vec4(col, max(alpha, fresnel * 0.9 * (1.0 - smoothstep(0.95, 1.0, edge))));
  // Même chaîne de couleur que les autres matériaux (tone mapping, sRGB).
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`
