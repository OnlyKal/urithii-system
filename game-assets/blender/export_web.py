"""Prépare le pack HD du jeu à partir de game-assets/build.

  /Applications/Blender.app/Contents/MacOS/Blender -b --python game-assets/blender/export_web.py

- arbre géant : bois et fougères épiphytes allégés, textures limitées à 1024 px ;
- autres modèles (personnages, animaux, cases) : copiés tels quels, car leurs
  expressions, animations et cartes de fourrure ne doivent pas être recuites.
Sortie : web-app/public/games/hd/ (servi en statique, chargé seulement en
qualité « Haute »).
"""

import os
import shutil

import bpy

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BUILD = os.path.join(ROOT, "build")
OUT = os.path.abspath(os.path.join(ROOT, "..", "web-app", "public", "games", "hd"))

COPY = ["ecogarde", "guide", "joueur", "joueuse", "okapi", "elephant", "paon", "case_ronde", "maison", "grenier"]
TREE_BUDGET = {"ArbreGeant_Bois": 22000, "Epiphyte": 1200}


def triangles(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def tree():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(BUILD, "arbre_geant.glb"))
    done = set()
    for o in bpy.context.scene.objects:
        if o.type != "MESH" or o.data.name in done:
            continue
        done.add(o.data.name)
        budget = next((b for k, b in TREE_BUDGET.items() if o.name.startswith(k)), None)
        if budget and triangles(o) > budget:
            # Les copies liées (fougères) partagent le maillage : une seule décimation.
            bpy.context.view_layer.objects.active = o
            mod = o.modifiers.new("Allegement", "DECIMATE")
            mod.ratio = budget / triangles(o)
            mesh = o.data
            dg = bpy.context.evaluated_depsgraph_get()
            new = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            o.modifiers.remove(mod)
            for user in [u for u in bpy.data.objects if u.data == mesh]:
                user.data = new
    for img in bpy.data.images:
        if img.size[0] > 1024:
            img.scale(1024, 1024)
    tris = sum(triangles(o) for o in bpy.context.scene.objects if o.type == "MESH")
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "arbre_geant.glb"), export_format="GLB",
                              export_image_format="WEBP", export_extras=True)
    print("ARBRE", tris, "triangles affichés")


os.makedirs(OUT, exist_ok=True)
for name in COPY:
    shutil.copy2(os.path.join(BUILD, f"{name}.glb"), os.path.join(OUT, f"{name}.glb"))
tree()
total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT) if f.endswith(".glb"))
print("PACK HD", round(total / 1e6, 1), "Mo")
