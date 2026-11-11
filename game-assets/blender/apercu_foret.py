"""Scène d'aperçu : sous-bois de l'Ituri, pour juger les modèles dans leur ambiance.

  /Applications/Blender.app/Contents/MacOS/Blender -b --python game-assets/blender/apercu_foret.py -- \
      --out game-assets/build/apercu_foret.png [--samples 64] [--width 1280 --height 720]

Assemble les modèles exportés (game-assets/build/*.glb) et les ressources CC0
téléchargées (game-assets/sources/polyhaven) : ciel HDRI de forêt tropicale,
sol forestier photo, plantes du sous-bois, soleil rasant et brume volumétrique.
Ce rendu sert de référence visuelle : le jeu (Three.js) vise la même ambiance.
"""

import argparse
import glob
import math
import os
import random
import sys

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "sources", "polyhaven")
BUILD = os.path.join(ROOT, "build")


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=os.path.join(BUILD, "apercu_foret.png"))
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=720)
    p.add_argument("--seed", type=int, default=3)
    p.add_argument("--fog", type=float, default=0.006)
    p.add_argument("--camera", choices=["sentier", "couronne", "village", "animaux"], default="sentier")
    p.add_argument("--animaux", action="store_true", help="place l'okapi, l'éléphant et le paon")
    return p.parse_args(argv)


A = args()
rng = random.Random(A.seed)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def find(folder, key):
    hits = glob.glob(os.path.join(SRC, folder, f"*_{key}_*.jpg"))
    return hits[0] if hits else None


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


def import_gltf_folder(name):
    files = glob.glob(os.path.join(SRC, name, "*.gltf"))
    return import_glb(files[0]) if files else []


def hide_template(objs):
    """Garde un modèle importé comme gabarit (non rendu) et renvoie ses maillages."""
    # L'importeur glTF crée des icosphères pour afficher les os : on les écarte.
    shapes = {o.custom_shape for o in objs if o.type == "ARMATURE" for o in o.pose.bones if o.custom_shape}
    meshes = [o for o in objs if o.type == "MESH" and o not in shapes and not o.name.startswith("Icosphere")]
    for o in objs:
        o.hide_render = True
        o.hide_viewport = True
    return meshes


def instance(meshes, loc, rot_z, scale):
    for m in meshes:
        o = bpy.data.objects.new(m.name + "_i", m.data)
        o.matrix_world = m.matrix_world.copy()
        o.location = Vector((loc[0], loc[1], height(loc[0], loc[1]) - 0.05)) + m.matrix_world.translation
        o.rotation_euler = (o.rotation_euler.x, o.rotation_euler.y, rot_z)
        o.scale = tuple(s * scale for s in m.scale)
        scene.collection.objects.link(o)


# ------------------------------------------------------------- ciel (HDRI)
world = bpy.data.worlds.new("Foret")
scene.world = world
nt = world.node_tree
bg = nt.nodes["Background"]
hdri = glob.glob(os.path.join(SRC, "rainforest_trail", "*.hdr"))
if hdri:
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(hdri[0])
    nt.links.new(env.outputs["Color"], bg.inputs["Color"])
    bg.inputs["Strength"].default_value = 0.8
else:
    bg.inputs["Color"].default_value = (0.55, 0.65, 0.6, 1)

# ---------------------------------------------------------------- sol
# Relief doux, et un sentier de latérite rouge qui serpente vers les géants.
from mathutils import noise as mnoise


def path_x(y):
    return 1.5 + 2.6 * math.sin((y + 24) / 17) + 1.2 * math.sin((y + 5) / 7.5)


VILLAGE = A.camera == "village"
CLEARING = Vector((4.0, 14.0, 0))  # clairière du village


def clearing(x, y):
    """1 dans la clairière de terre battue du village, 0 en forêt."""
    if not VILLAGE:
        return 0.0
    d = (Vector((x, y, 0)) - CLEARING).length + 1.2 * mnoise.noise(Vector((x * 0.25, y * 0.25, 4)))
    return max(0.0, min(1.0, (11.0 - d) / 2.5))


def path_mask(x, y):
    """1 au milieu du sentier, 0 au-delà de ses bords (largeur ~1,6 m)."""
    c = clearing(x, y)
    if y < -60 or y > 30:
        return c
    d = abs(x - path_x(y))
    edge = 0.8 + 0.25 * mnoise.noise(Vector((x * 0.6, y * 0.6, 0)))
    return max(c, max(0.0, min(1.0, (edge + 0.5 - d) / 0.5)))


def height(x, y):
    h = 0.9 * mnoise.noise(Vector((x * 0.035, y * 0.035, 0.3))) + 0.25 * mnoise.noise(Vector((x * 0.15, y * 0.15, 1.7)))
    h *= 1 - 0.85 * clearing(x, y)  # clairière aplanie
    return h - 0.08 * path_mask(x, y)  # sentier légèrement creusé par les passages


bpy.ops.mesh.primitive_grid_add(x_subdivisions=260, y_subdivisions=260, size=160)
ground = bpy.context.active_object
me = ground.data
mask_attr = me.attributes.new("chemin", "FLOAT", "POINT")
for v in me.vertices:
    v.co.z = height(v.co.x, v.co.y)
    mask_attr.data[v.index].value = path_mask(v.co.x, v.co.y)
me.shade_smooth()
for loop in me.uv_layers.active.data:
    loop.uv = (loop.uv[0] * 60, loop.uv[1] * 60)  # environ 2,7 m par répétition

gm = bpy.data.materials.new("SolForestier")
gnt = gm.node_tree
bsdf = gnt.nodes["Principled BSDF"]


def texture_set(folder):
    nodes = {}
    for key, non_color in (("diff", False), ("rough", True), ("nor_gl", True)):
        path = find(folder, key)
        if path:
            tex = gnt.nodes.new("ShaderNodeTexImage")
            tex.image = bpy.data.images.load(path)
            if non_color:
                tex.image.colorspace_settings.name = "Non-Color"
            nodes[key] = tex
    return nodes


leaves = texture_set("leaves_forest_ground") or texture_set("forest_floor")
laterite = texture_set("red_laterite_soil_stones")
attr = gnt.nodes.new("ShaderNodeAttribute")
attr.attribute_name = "chemin"
breakup = gnt.nodes.new("ShaderNodeTexNoise")
breakup.inputs["Scale"].default_value = 3.0
fac = gnt.nodes.new("ShaderNodeMath")
fac.operation = "MULTIPLY"
fac.use_clamp = True
sharpen = gnt.nodes.new("ShaderNodeMapRange")
sharpen.inputs["From Min"].default_value, sharpen.inputs["From Max"].default_value = 0.25, 0.75
gnt.links.new(attr.outputs["Fac"], fac.inputs[0])
gnt.links.new(breakup.outputs["Fac"], sharpen.inputs["Value"])
gnt.links.new(sharpen.outputs["Result"], fac.inputs[1])
mask_node = gnt.nodes.new("ShaderNodeMath")
mask_node.operation = "MAXIMUM"
mask_node.use_clamp = True
gnt.links.new(fac.outputs[0], mask_node.inputs[0])
over = gnt.nodes.new("ShaderNodeMath")
over.operation = "SUBTRACT"
over.use_clamp = True
gnt.links.new(attr.outputs["Fac"], over.inputs[0])
over.inputs[1].default_value = 0.35  # cœur du sentier : latérite franche
full = gnt.nodes.new("ShaderNodeMath")
full.operation = "MULTIPLY"
full.use_clamp = True
full.inputs[1].default_value = 1 / 0.65
gnt.links.new(over.outputs[0], full.inputs[0])
gnt.links.new(full.outputs[0], mask_node.inputs[1])


def mixed(key, socket_kind):
    a, b = leaves.get(key), laterite.get(key)
    if not a:
        return None
    if not b:
        return a.outputs["Color"]
    mix = gnt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    gnt.links.new(mask_node.outputs[0], mix.inputs[0])
    gnt.links.new(a.outputs["Color"], mix.inputs[6])
    gnt.links.new(b.outputs["Color"], mix.inputs[7])
    return mix.outputs[2]


if (c := mixed("diff", "color")):
    gnt.links.new(c, bsdf.inputs["Base Color"])
if (r := mixed("rough", "value")):
    gnt.links.new(r, bsdf.inputs["Roughness"])
if (n := mixed("nor_gl", "normal")):
    nm = gnt.nodes.new("ShaderNodeNormalMap")
    gnt.links.new(n, nm.inputs["Color"])
    gnt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
ground.data.materials.append(gm)

# ------------------------------------------------------------- arbres géants
tree_path = os.path.join(BUILD, "arbre_geant.glb")
tree = hide_template(import_glb(tree_path)) if os.path.exists(tree_path) else []


def add_moss(mat):
    """Mousse sur les faces tournées vers le haut et au pied du tronc.

    Rendu de référence uniquement : pour le jeu, cette mousse sera cuite
    dans une texture (le glTF ne transporte pas ce mélange procédural)."""
    moss = find("moss_wood", "diff")
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not moss or not bsdf or not bsdf.inputs["Base Color"].links:
        return
    src = bsdf.inputs["Base Color"].links[0].from_socket
    coord = nt.nodes.new("ShaderNodeTexCoord")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(moss)
    tex.projection = "BOX"
    tex.projection_blend = 0.3
    mapping = nt.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = (0.5, 0.5, 0.5)
    nt.links.new(coord.outputs["Object"], mapping.inputs["Vector"])
    nt.links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
    geo = nt.nodes.new("ShaderNodeNewGeometry")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Normal"], sep.inputs["Vector"])
    up = nt.nodes.new("ShaderNodeMapRange")
    up.inputs["From Min"].default_value, up.inputs["From Max"].default_value = 0.15, 0.6
    nt.links.new(sep.outputs["Z"], up.inputs["Value"])
    pos = nt.nodes.new("ShaderNodeSeparateXYZ")
    nt.links.new(geo.outputs["Position"], pos.inputs["Vector"])
    low = nt.nodes.new("ShaderNodeMapRange")
    low.inputs["From Min"].default_value, low.inputs["From Max"].default_value = 3.5, 0.0
    nt.links.new(pos.outputs["Z"], low.inputs["Value"])
    noise_tex = nt.nodes.new("ShaderNodeTexNoise")
    noise_tex.inputs["Scale"].default_value = 0.6
    nt.links.new(coord.outputs["Object"], noise_tex.inputs["Vector"])
    both = nt.nodes.new("ShaderNodeMath")
    both.operation = "MAXIMUM"
    nt.links.new(up.outputs["Result"], both.inputs[0])
    nt.links.new(low.outputs["Result"], both.inputs[1])
    mask = nt.nodes.new("ShaderNodeMath")
    mask.operation = "MULTIPLY"
    mask.use_clamp = True
    nt.links.new(both.outputs[0], mask.inputs[0])
    ramp = nt.nodes.new("ShaderNodeMapRange")
    ramp.inputs["From Min"].default_value, ramp.inputs["From Max"].default_value = 0.42, 0.62
    nt.links.new(noise_tex.outputs["Fac"], ramp.inputs["Value"])
    nt.links.new(ramp.outputs["Result"], mask.inputs[1])
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    nt.links.new(mask.outputs[0], mix.inputs[0])
    nt.links.new(src, mix.inputs[6])
    nt.links.new(tex.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])


def translucent_leaves(mat):
    """Feuilles traversées par la lumière (rendu de référence uniquement)."""
    nt = mat.node_tree
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    shader_in = out.inputs["Surface"].links[0].from_socket if out.inputs["Surface"].links else bsdf.outputs["BSDF"]
    trans = nt.nodes.new("ShaderNodeBsdfTranslucent")
    if bsdf.inputs["Base Color"].links:
        nt.links.new(bsdf.inputs["Base Color"].links[0].from_socket, trans.inputs["Color"])
    mix = nt.nodes.new("ShaderNodeMixShader")
    mix.inputs["Fac"].default_value = 0.5
    nt.links.new(shader_in, mix.inputs[1])
    nt.links.new(trans.outputs["BSDF"], mix.inputs[2])
    # La transparence découpée doit s'appliquer aussi à la part translucide.
    alpha_src = bsdf.inputs["Alpha"].links[0].from_socket if bsdf.inputs["Alpha"].links else None
    if alpha_src:
        transp = nt.nodes.new("ShaderNodeBsdfTransparent")
        cut = nt.nodes.new("ShaderNodeMixShader")
        nt.links.new(alpha_src, cut.inputs["Fac"])
        nt.links.new(transp.outputs["BSDF"], cut.inputs[1])
        nt.links.new(mix.outputs["Shader"], cut.inputs[2])
        nt.links.new(cut.outputs["Shader"], out.inputs["Surface"])
    else:
        nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])


for m in bpy.data.materials:
    if m.name.startswith("Ecorce") or m.name.startswith("Liane"):
        add_moss(m)
    elif m.name.startswith("Feuillage"):
        translucent_leaves(m)
for loc, rot, s in [((0, 0, 0), 0, 1.0), ((-26, 30, 0), 2.1, 1.1), ((24, 38, 0), 4.0, 0.95), ((-9, 62, 0), 1.0, 1.15), ((38, 8, 0), 5.2, 0.9), ((-40, 4, 0), 3.0, 1.0)]:
    instance(tree, loc, rot, s)

# Animaux (pose de repos), le long du sentier.
if A.animaux:
    for name, loc, rot in (("okapi", (path_x(-13) + 1.6, -13, 0), 2.4), ("elephant", (path_x(-4) - 3.5, -4, 0), 0.5), ("paon", (path_x(-16.5) - 0.6, -16.5, 0), -2.6)):
        path = os.path.join(BUILD, f"{name}.glb")
        if os.path.exists(path):
            instance(hide_template(import_glb(path)), loc, rot, 1.0)

# Habitations du village (scène « village »).
if VILLAGE:
    built = {}
    for name in ("case_ronde", "maison", "grenier"):
        path = os.path.join(BUILD, f"{name}.glb")
        if os.path.exists(path):
            built[name] = hide_template(import_glb(path))
    for name, loc, rot in (("case_ronde", (1.5, 15, 0), 0.25), ("case_ronde", (11, 18.5, 0), -0.5), ("maison", (-5.5, 18.5, 0), 0.55),
                           ("grenier", (6.5, 11, 0), 0.0), ("grenier", (-4, 12.5, 0), 1.2)):
        if name in built:
            instance(built[name], loc, rot, 1.0)

# ------------------------------------------------------- sous-bois (CC0)
plants = {}
for name in ("fern_02", "anthurium_botany_01", "calathea_orbifolia_01", "shrub_01", "pachira_aquatica_01", "rock_moss_set_01", "dead_tree_trunk", "root_cluster_01"):
    objs = import_gltf_folder(name)
    if objs:
        plants[name] = hide_template(objs)
weights = {"fern_02": 40, "anthurium_botany_01": 16, "calathea_orbifolia_01": 16, "shrub_01": 22, "pachira_aquatica_01": 6, "rock_moss_set_01": 1, "dead_tree_trunk": 1, "root_cluster_01": 3}
names = [n for n in plants for _ in range(weights.get(n, 5))]
for _ in range(1100 if names else 0):
    r, a = rng.uniform(2.5, 50), rng.uniform(0, 2 * math.pi)
    x, y = math.cos(a) * r, math.sin(a) * r + 12
    if path_mask(x, y) > 0 or abs(x - path_x(y)) < 1.6 or clearing(x, y) > 0 or (VILLAGE and (Vector((x, y, 0)) - CLEARING).length < 12.5) \
            or (A.animaux and -22 < y < 0 and -9 < x - path_x(y) < 4):
        continue
    n = rng.choice(names)
    scale = {"fern_02": rng.uniform(2.2, 4.0), "anthurium_botany_01": rng.uniform(2.0, 3.2), "calathea_orbifolia_01": rng.uniform(2.2, 3.4), "shrub_01": rng.uniform(1.4, 2.4), "pachira_aquatica_01": rng.uniform(1.6, 2.6)}.get(n, rng.uniform(0.6, 1.0))
    if n in ("rock_moss_set_01", "dead_tree_trunk") and y < -5:
        continue
    # Rien de haut juste devant l'objectif : la vue reste dégagée.
    if n in ("pachira_aquatica_01", "shrub_01") and math.hypot(x - 2.0, y + 24) < 9:
        continue
    instance(plants[n], (x, y, 0), rng.uniform(0, 2 * math.pi), scale)

# Étage intermédiaire : jeunes arbres (Pachira) entre les géants.
if "pachira_aquatica_01" in plants:
    for _ in range(40):
        r, a = rng.uniform(9, 55), rng.uniform(0, 2 * math.pi)
        x, y = math.cos(a) * r, math.sin(a) * r + 14
        if y < -12:
            continue
        instance(plants["pachira_aquatica_01"], (x, y, 0), rng.uniform(0, 6.3), rng.uniform(3.0, 5.0))

# ------------------------------------------------------ soleil et brume
sun = bpy.data.lights.new("Soleil", "SUN")
sun.energy = 7.5
sun.color = (1.0, 0.86, 0.62)
sun.angle = math.radians(1.5)
so = bpy.data.objects.new("Soleil", sun)
# Contre-jour en forêt ; au village, soleil de trois quarts face aux façades.
so.rotation_euler = (math.radians(58), 0, math.radians(30 if VILLAGE else 200))
scene.collection.objects.link(so)

bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 20, 18))
fog = bpy.context.active_object
fog.scale = (140, 140, 36)
fm = bpy.data.materials.new("Brume")
fnt = fm.node_tree
fnt.nodes.remove(fnt.nodes["Principled BSDF"])
vol = fnt.nodes.new("ShaderNodeVolumePrincipled")
vol.inputs["Density"].default_value = A.fog
vol.inputs["Color"].default_value = (0.85, 0.92, 0.85, 1)
vol.inputs["Anisotropy"].default_value = 0.55  # diffusion vers l'avant : rayons visibles
fnt.links.new(vol.outputs["Volume"], fnt.nodes["Material Output"].inputs["Volume"])
fog.data.materials.append(fm)

# ---------------------------------------------------------------- caméra
cam = bpy.data.cameras.new("Camera")
cam.lens = 20
co = bpy.data.objects.new("Camera", cam)
if A.camera == "couronne":
    # Au pied du géant, regard vers la couronne : juge le feuillage et les lianes.
    cam.lens = 16
    co.location = (7, -9, height(7, -9) + 1.6)
    target = Vector((0, 0, 24))
elif A.camera == "animaux":
    # Sur le sentier, à hauteur d'homme, vers l'okapi et l'éléphant.
    cam.lens = 30
    co.location = (path_x(-22) + 0.5, -22, height(path_x(-22), -22) + 1.6)
    target = Vector((path_x(-10) - 1.0, -10, 1.3))
elif VILLAGE:
    # À l'entrée de la clairière, regard vers les cases.
    cam.lens = 24
    co.location = (3.5, -1.5, height(3.5, -1.5) + 1.7)
    target = Vector((3, 16, 2.8))
else:
    co.location = (path_x(-24), -24, height(path_x(-24), -24) + 1.7)
    target = Vector((0, 4, 7))
co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
scene.collection.objects.link(co)
scene.camera = co

# ---------------------------------------------------------------- rendu
scene.render.engine = "CYCLES"
scene.cycles.samples = A.samples
scene.cycles.use_denoising = True
scene.cycles.volume_bounces = 1
scene.cycles.max_bounces = 6
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"
    prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    print("GPU indisponible :", e)
scene.render.resolution_x, scene.render.resolution_y = A.width, A.height
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.filepath = os.path.abspath(A.out)
print("PLANTES", sorted(plants))
bpy.ops.render.render(write_still=True)
print("APERCU", A.out)
