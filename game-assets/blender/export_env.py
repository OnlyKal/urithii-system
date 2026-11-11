"""Prépare l'environnement HD du jeu : arbres de canopée, plantes scannées,
textures de sol et éclairage HDRI.

  /Applications/Blender.app/Contents/MacOS/Blender -b --python game-assets/blender/export_env.py

Sorties dans web-app/public/games/hd/ :
  arbre_v2.glb, arbre_v3.glb  arbres de canopée allégés (≈ 6 000 triangles),
                              instanciés par centaines ;
  plante_*.glb                plantes Poly Haven (CC0) allégées ;
  sol/*.jpg                   textures de sol (feuilles mortes, latérite, boue),
                              1024 px ;
  ciel_foret.hdr              HDRI de forêt tropicale réduit (éclairage).
"""

import glob
import os
import random

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD = os.path.join(ROOT, "build")
SRC = os.path.join(ROOT, "sources", "polyhaven")
OUT = os.path.abspath(os.path.join(ROOT, "..", "web-app", "public", "games", "hd"))

# (sortie, source Poly Haven, maillages à garder, budget de triangles)
PLANTS = [
    ("plante_fougere", "fern_02", ["fern_02_b"], 1200),
    ("plante_anthurium", "anthurium_botany_01", ["anthurium_botany_01_c"], 1400),
    ("plante_calathea", "calathea_orbifolia_01", ["calathea_orbifolia_01_a"], 1200),
    ("plante_herbe", "grass_medium_01", ["grass_medium_01_mid_a_LOD0"], 450),
    ("plante_pachira", "pachira_aquatica_01", ["pachira_aquatica_01_bark_d", "pachira_aquatica_01_leaves_d"], 4500),
]
TEXTURES = [
    ("feuilles", "leaves_forest_ground"),
    ("sous_bois", "forest_floor"),
    ("laterite", "red_laterite_soil_stones"),
    ("boue", "mud_forest"),
]


def tris(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def decimate(o, budget):
    if tris(o) <= budget:
        return
    bpy.context.view_layer.objects.active = o
    mod = o.modifiers.new("Allegement", "DECIMATE")
    mod.ratio = budget / tris(o)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def shrink_images(limit):
    for img in bpy.data.images:
        if img.size[0] > limit:
            img.scale(limit, max(1, int(img.size[1] * limit / img.size[0])))


def export(path):
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_image_format="WEBP", export_extras=True)


def canopy_tree(name):
    """Arbre de canopée allégé : bois décimé, une carte de feuillage sur deux,
    pas d'épiphytes (instancié par centaines)."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(BUILD, f"{name}.glb"))
    rnd = random.Random(5)
    for o in list(bpy.context.scene.objects):
        if o.type != "MESH":
            continue
        if o.name.startswith("Epiphyte"):
            bpy.data.objects.remove(o)
        elif o.name.startswith("ArbreGeant_Bois"):
            decimate(o, 3200)
        elif o.name.startswith("ArbreGeant_Feuillage"):
            import bmesh
            bm = bmesh.new()
            bm.from_mesh(o.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if rnd.random() < 0.6], context="FACES")
            bm.to_mesh(o.data)
            bm.free()
    shrink_images(512)
    total = sum(tris(o) for o in bpy.context.scene.objects if o.type == "MESH")
    export(os.path.join(OUT, f"{name}.glb"))
    print("CANOPEE", name, total, "triangles")


def plant(out, src, keep, budget):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glob.glob(os.path.join(SRC, src, "*.gltf"))[0])
    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    kept = [o for o in meshes if o.name in keep]
    for o in meshes:
        if o not in kept:
            bpy.data.objects.remove(o)
    total = sum(tris(o) for o in kept)
    for o in kept:
        decimate(o, max(150, int(budget * tris(o) / total)))
        # Posée à l'origine : le jeu la place sur le terrain.
        o.location.x = 0
        o.location.z = 0 if o.location.z else o.location.z
    for o in list(bpy.context.scene.objects):
        if o.type == "EMPTY" and not o.children:
            bpy.data.objects.remove(o)
    shrink_images(512)
    export(os.path.join(OUT, f"{out}.glb"))
    print("PLANTE", out, sum(tris(o) for o in kept), "triangles")


def textures():
    os.makedirs(os.path.join(OUT, "sol"), exist_ok=True)
    for out, src in TEXTURES:
        for key in ("diff", "nor_gl"):
            path = glob.glob(os.path.join(SRC, src, f"*_{key}_*.jpg"))
            if not path:
                continue
            img = bpy.data.images.load(path[0])
            img.scale(1024, 1024)
            img.filepath_raw = os.path.join(OUT, "sol", f"{out}_{'couleur' if key == 'diff' else 'normale'}.jpg")
            img.file_format = "JPEG"
            bpy.context.scene.render.image_settings.quality = 82
            img.save()
    hdr = glob.glob(os.path.join(SRC, "rainforest_trail", "*.hdr"))[0]
    img = bpy.data.images.load(hdr)
    img.scale(1024, 512)
    img.filepath_raw = os.path.join(OUT, "ciel_foret.hdr")
    img.file_format = "HDR"
    img.save()
    print("TEXTURES OK")


os.makedirs(OUT, exist_ok=True)
for name in ("arbre_v2", "arbre_v3"):
    canopy_tree(name)
for args in PLANTS:
    plant(*args)
textures()
