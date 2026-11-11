"""Animaux de la forêt de l'Ituri : maillage continu, squelette, pelage, animations.

  /Applications/Blender.app/Contents/MacOS/Blender -b --python game-assets/blender/animaux.py -- \
      --only okapi --out-dir game-assets/build [--preview game-assets/build/okapi.png]

Méthode (pour chaque animal) :
  1. un graphe anatomique (articulations et rayons) transformé en maillage
     continu par le modificateur Skin, puis subdivisé ;
  2. un squelette aux os nommés, et des poids de peau calculés automatiquement ;
  3. un pelage calculé par un matériau procédural (robe, rayures, face),
     cuit dans une texture couleur et une carte de normales (poil fin) ;
  4. des animations générées : « repos » (broute, oreilles), « marche »,
     « course ». Three.js les joue avec un AnimationMixer.
L'animal regarde vers -Y dans Blender, soit +Z dans Three.js, comme les
modèles actuels du jeu (web-app/src/games/models/animals.jsx).
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--only", default="okapi")
    p.add_argument("--out-dir", default=os.path.join(ROOT, "build"))
    p.add_argument("--preview", default="")
    p.add_argument("--portrait", default="", help="rendu en gros plan de la tête")
    p.add_argument("--texture-size", type=int, default=1024)
    p.add_argument("--fps", type=int, default=24)
    return p.parse_args(argv)


A = args()


# ============================================================ outils communs
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = A.fps


def gpu_cycles(samples=16):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception as e:  # CPU en secours
        print("GPU indisponible :", e)


def skin_body(name, joints, edges, root):
    """Maillage continu à partir d'un graphe d'articulations.

    joints : {nom: ((x, y, z), rayon_x, rayon_y)} ; edges : [(a, b)]."""
    names = list(joints)
    me = bpy.data.meshes.new(name)
    me.from_pydata([joints[n][0] for n in names], [(names.index(a), names.index(b)) for a, b in edges], [])
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    skin = obj.modifiers.new("Skin", "SKIN")
    skin.use_smooth_shade = True
    skin.branch_smoothing = 1.0
    for i, n in enumerate(names):
        sv = me.skin_vertices[0].data[i]
        sv.radius = (joints[n][1], joints[n][2])
        sv.use_root = n == root
    sub = obj.modifiers.new("Subdivision", "SUBSURF")
    sub.levels = 2
    sub.render_levels = 2
    bpy.ops.object.modifier_apply(modifier="Skin")
    bpy.ops.object.modifier_apply(modifier="Subdivision")
    obj.data.shade_smooth()
    return obj


def meta_body(name, elements, resolution=0.014, voxel=0.012, faces=14000):
    """Corps organique par volumes : masses ellipsoïdes et segments (capsules)
    qui fusionnent, puis remaillage régulier et allègement.

    elements : ("ell", centre, (sx, sy, sz), rayon, (rx, ry, rz))
             | ("cap", a, b, rayon)"""
    mb = bpy.data.metaballs.new(name)
    mb.resolution = resolution
    mb.render_resolution = resolution
    mb.threshold = 0.6
    obj = bpy.data.objects.new(name, mb)
    bpy.context.scene.collection.objects.link(obj)
    from mathutils import Euler
    for el in elements:
        if el[0] in ("ell", "neg"):
            _, c, size, r, rot = el
            e = mb.elements.new(type="ELLIPSOID")
            e.use_negative = el[0] == "neg"  # creux : flanc, tempe
            e.co = c
            e.size_x, e.size_y, e.size_z = size
            e.radius = r
            e.rotation = Euler(rot).to_quaternion()
        else:
            _, a, b, r = el
            a, b = Vector(a), Vector(b)
            e = mb.elements.new(type="CAPSULE")
            e.co = (a + b) / 2
            e.size_x = (b - a).length / 2
            e.radius = r
            e.rotation = Vector((1, 0, 0)).rotation_difference((b - a).normalized())
        e.stiffness = 1.6
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    body = bpy.context.view_layer.objects.active
    body.name = name
    rm = body.modifiers.new("Remaillage", "REMESH")
    rm.mode = "VOXEL"
    rm.voxel_size = voxel
    bpy.ops.object.modifier_apply(modifier=rm.name)
    sm = body.modifiers.new("Lissage", "CORRECTIVE_SMOOTH")
    sm.iterations = 6
    sm.smooth_type = "LENGTH_WEIGHTED"
    bpy.ops.object.modifier_apply(modifier=sm.name)
    dec = body.modifiers.new("Allegement", "DECIMATE")
    dec.ratio = min(1.0, faces / max(1, len(body.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=dec.name)
    body.data.shade_smooth()
    return body


def leaf_ear(name, base, tip, width, cup=0.35, thickness=0.012, ragged=0.0):
    """Oreille large et creusée : feuille ovale incurvée, avec épaisseur."""
    import bmesh
    base, tip = Vector(base), Vector(tip)
    axis = tip - base
    length = axis.length
    d = axis.normalized()
    side = d.cross(Vector((0, -1, 0)))
    side = side.normalized() if side.length > 1e-3 else Vector((1, 0, 0))
    normal = side.cross(d)
    bm = bmesh.new()
    rows, cols = 14, 10
    grid = []
    for i in range(rows + 1):
        t = i / rows
        w = width * math.sin(math.pi * min(1.0, t * 0.92 + 0.08)) * (1 - 0.35 * t)
        row = []
        for j in range(cols + 1):
            u = (j / cols - 0.5) * 2
            wr = w * (1 + ragged * noise.noise(Vector((t * 7.0, u * 2.0, 3.3))) * abs(u))
            p = base + d * (t * length) + side * (u * wr) + normal * (cup * w * (1 - u * u))
            row.append(bm.verts.new(p))
        grid.append(row)
    for i in range(rows):
        for j in range(cols):
            bm.faces.new((grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    mod = obj.modifiers.new("Epaisseur", "SOLIDIFY")
    mod.thickness = thickness
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    me.shade_smooth()
    return obj


def eyes(name, centers, radius, body=None, lid_color=(0.02, 0.012, 0.008), show=0.55):
    """Yeux brillants. Avec « body », chaque œil est posé sur la surface de la
    tête (lancer de rayon depuis l'extérieur), enfoncé dans son orbite, et
    entouré d'une paupière (anneau de peau)."""
    objs = []
    mat = bpy.data.materials.new(name + "_oeil")
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.012, 0.008, 0.006, 1)
    b.inputs["Roughness"].default_value = 0.08  # œil humide, brillant
    lid = bpy.data.materials.new(name + "_paupiere")
    lb = lid.node_tree.nodes["Principled BSDF"]
    lb.inputs["Base Color"].default_value = (*lid_color, 1)
    lb.inputs["Roughness"].default_value = 0.6
    for i, c in enumerate(centers):
        c = Vector(c)
        normal = Vector((1 if c.x >= 0 else -1, 0, 0))
        if body is not None:
            origin = c + normal * 1.0
            hit, loc, n, _ = body.ray_cast(origin, -normal)
            if hit:
                normal = n.normalized()
                c = loc - normal * radius * (1 - show * 0.7)  # œil enfoncé : seule une calotte dépasse
        bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=20, ring_count=12, location=c)
        o = bpy.context.active_object
        o.name = f"{name}_oeil_{i}"
        o.data.materials.append(mat)
        o.data.shade_smooth()
        objs.append(o)
        if body is not None:
            bpy.ops.mesh.primitive_torus_add(major_radius=radius * 0.92, minor_radius=radius * 0.14,
                                             major_segments=24, minor_segments=6, location=c + normal * radius * 0.42)
            t = bpy.context.active_object
            t.rotation_euler = normal.to_track_quat("Z", "Y").to_euler()
            t.name = f"{name}_paupiere_{i}"
            t.data.materials.append(lid)
            t.data.shade_smooth()
            objs.append(t)
    return objs


def join(objs, name):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def build_armature(name, bones):
    """bones : [(nom, parent, tête, queue)] — rouleau nul : l'axe X local
    des os de pattes reste parallèle à l'axe X du monde (flexion avant/arrière)."""
    arm = bpy.data.armatures.new(name)
    obj = bpy.data.objects.new(name, arm)
    bpy.context.scene.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    for bname, parent, head, tail in bones:
        b = arm.edit_bones.new(bname)
        b.head, b.tail = Vector(head), Vector(tail)
        b.roll = 0.0
        if parent:
            b.parent = arm.edit_bones[parent]
            b.use_connect = (arm.edit_bones[parent].tail - b.head).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


def bind(mesh, arm):
    """Lie la peau au squelette. Poids automatiques (« bone heat ») ; s'ils
    échouent (fréquent sur les petits maillages), poids par proximité : chaque
    sommet suit les deux os les plus proches, pondérés par l'inverse de la
    distance au segment."""
    bpy.ops.object.select_all(action="DESELECT")
    mesh.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    weighted = sum(1 for v in mesh.data.vertices if any(g.weight > 0 for g in v.groups))
    if weighted >= 0.95 * len(mesh.data.vertices):
        return
    print(f"Poids automatiques incomplets ({weighted}/{len(mesh.data.vertices)}) : poids par proximité.")
    from mathutils.geometry import intersect_point_line
    segs = []
    for b in arm.data.bones:
        if not b.use_deform:
            continue
        h, t = arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local
        segs.append((b.name, h, t))
    for vg in list(mesh.vertex_groups):
        mesh.vertex_groups.remove(vg)
    groups = {n: mesh.vertex_groups.new(name=n) for n, _, _ in segs}
    mw = mesh.matrix_world
    for v in mesh.data.vertices:
        p = mw @ v.co
        dists = []
        for n, h, t in segs:
            q, f = intersect_point_line(p, h, t)
            f = min(1.0, max(0.0, f))
            dists.append(((p - h.lerp(t, f)).length, n))
        dists.sort()
        (d1, n1), (d2, n2) = dists[0], dists[1]
        w1, w2 = 1 / max(d1, 1e-4) ** 2, 1 / max(d2, 1e-4) ** 2
        groups[n1].add([v.index], w1 / (w1 + w2), "REPLACE")
        groups[n2].add([v.index], w2 / (w1 + w2), "REPLACE")


def smart_uv(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.01)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_coat(obj, build_shader, size, fur=None):
    """Cuit la couleur (et le relief du poil) du matériau procédural dans
    deux images, puis remplace le matériau par une version glTF simple.

    fur = (masque, longueur_m, couches) : « masque(nt) » renvoie une sortie de
    nœud (0 = peau nue, 1 = poil le plus long). Ce masque est cuit dans le
    canal alpha de la texture couleur (le matériau reste opaque : l'alpha est
    libre) ; la longueur et le nombre de couches vont dans les données du
    matériau (« extras » glTF). Le jeu génère les coques de fourrure à partir
    de ces informations."""
    gpu_cycles(16)
    scene = bpy.context.scene
    proc = bpy.data.materials.new(obj.name + "_procedural")
    build_shader(proc.node_tree)
    obj.data.materials.clear()
    obj.data.materials.append(proc)
    col = bpy.data.images.new(obj.name + "_couleur", size, size, alpha=fur is not None)
    nor = bpy.data.images.new(obj.name + "_normale", size, size)
    nor.colorspace_settings.name = "Non-Color"
    target = proc.node_tree.nodes.new("ShaderNodeTexImage")
    proc.node_tree.nodes.active = target
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    scene.render.bake.margin = 8
    target.image = col
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
    target.image = nor
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT")
    if fur is not None:
        import numpy as np
        mask_fn, length, layers = fur
        nt = proc.node_tree
        bsdf_p = nt.nodes["Principled BSDF"]
        links_out = [l for l in nt.links if l.to_node == bsdf_p and l.to_socket.name == "Base Color"]
        m = mask_fn(nt)
        nt.links.new(m, bsdf_p.inputs["Emission Color"])
        bsdf_p.inputs["Emission Strength"].default_value = 1.0
        lng = bpy.data.images.new(obj.name + "_longueur_poil", size, size)
        lng.colorspace_settings.name = "Non-Color"
        target.image = lng
        bpy.ops.object.bake(type="EMIT")
        px = np.empty(size * size * 4, dtype=np.float32)
        col.pixels.foreach_get(px)
        lp = np.empty(size * size * 4, dtype=np.float32)
        lng.pixels.foreach_get(lp)
        px = px.reshape(-1, 4)
        # Alpha minimal 2/255 : aucun encodeur ne peut alors effacer la
        # couleur sous un alpha nul ; reste sous le seuil de la 1re coque.
        px[:, 3] = np.clip(lp.reshape(-1, 4)[:, 0], 2 / 255, 1)
        col.pixels.foreach_set(px.ravel())
        # Alpha = donnée indépendante (longueur du poil), pas une transparence :
        # sans ce réglage, Blender prémultiplie et noircit la couleur.
        col.alpha_mode = "CHANNEL_PACKED"
    col.pack()
    nor.pack()
    final = bpy.data.materials.new(obj.name + "_pelage")
    nt = final.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = col
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = nor
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(n.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = 0.62
    if "Sheen Weight" in bsdf.inputs:
        # Pas de « sheen » : l'export glTF le transforme en reflet blanc
        # (sheenColorFactor = 1) qui grise la robe. Le poil ras est rendu
        # par la carte de normales.
        bsdf.inputs["Sheen Weight"].default_value = 0.0
    if fur is not None:
        final["urithi_fourrure"] = {"longueur": fur[1], "couches": fur[2], "masque": "alpha de la texture couleur"}
        obj["fourrure"] = {"materiau": final.name, "longueur": fur[1], "couches": fur[2]}
    obj.data.materials.clear()
    obj.data.materials.append(final)
    return final


def fur_shells(body, material_name, length, layers, density=900.0):
    """Coques de fourrure pour l'aperçu Blender (non exportées) : copies du
    pelage gonflées le long des normales, percées d'un motif de poils qui
    s'affine vers la pointe ; la longueur suit l'alpha de la texture."""
    mat = bpy.data.materials.get(material_name)
    img = next(n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image and n.image.name.endswith("_couleur"))
    idx = [i for i, m in enumerate(body.data.materials) if m == mat][0]
    base = body.copy()
    base.data = body.data.copy()
    bpy.context.scene.collection.objects.link(base)
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(base.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != idx], context="FACES")
    bm.to_mesh(base.data)
    bm.free()
    shells = []
    for i in range(1, layers + 1):
        h = i / layers
        o = base.copy()
        bpy.context.scene.collection.objects.link(o)
        o.name = f"{body.name}_coque_{i}"
        d = o.modifiers.new("Gonflement", "DISPLACE")
        d.direction = "NORMAL"
        d.mid_level = 0.0
        d.strength = h * length
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_move_to_index(modifier=d.name, index=0)
        m = bpy.data.materials.new(f"Coque_{i}")
        nt = m.node_tree
        nodes, links = nt.nodes, nt.links
        bsdf = nodes["Principled BSDF"]
        out = nodes["Material Output"]
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = img
        tc = nodes.new("ShaderNodeTexCoord")
        vor = nodes.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = density
        links.new(tc.outputs["Object"], vor.inputs["Vector"])
        strand = nodes.new("ShaderNodeMath")
        strand.operation = "LESS_THAN"  # le brin s'affine vers la pointe
        links.new(vor.outputs["Distance"], strand.inputs[0])
        strand.inputs[1].default_value = 0.45 * (1 - h) + 0.05
        long_enough = nodes.new("ShaderNodeMath")
        long_enough.operation = "GREATER_THAN"
        links.new(tex.outputs["Alpha"], long_enough.inputs[0])
        long_enough.inputs[1].default_value = h - 0.001
        alpha = nodes.new("ShaderNodeMath")
        alpha.operation = "MULTIPLY"
        links.new(strand.outputs[0], alpha.inputs[0])
        links.new(long_enough.outputs[0], alpha.inputs[1])
        shade = nodes.new("ShaderNodeMix")
        shade.data_type = "RGBA"
        shade.blend_type = "MULTIPLY"
        shade.inputs[0].default_value = 1.0
        links.new(tex.outputs["Color"], shade.inputs[6])
        k = 0.55 + 0.5 * h  # racines dans l'ombre, pointes éclairées
        shade.inputs[7].default_value = (k, k, k, 1)
        links.new(shade.outputs[2], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.7
        transp = nodes.new("ShaderNodeBsdfTransparent")
        mix = nodes.new("ShaderNodeMixShader")
        links.new(alpha.outputs[0], mix.inputs["Fac"])
        links.new(transp.outputs["BSDF"], mix.inputs[1])
        links.new(bsdf.outputs["BSDF"], mix.inputs[2])
        links.new(mix.outputs["Shader"], out.inputs["Surface"])
        o.data = base.data.copy()
        o.data.materials.clear()
        o.data.materials.append(m)
        shells.append(o)
    bpy.data.objects.remove(base)
    bpy.context.scene.cycles.transparent_max_bounces = layers * 2 + 8
    return shells


def key_pose(arm, frame, rotations):
    """rotations : {os: (rx, ry, rz)} en radians, clé posée à « frame »."""
    for bname, rot in rotations.items():
        pb = arm.pose.bones[bname]
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = rot
        pb.keyframe_insert("rotation_euler", frame=frame)


def make_action(arm, name, frames, pose_at):
    """Crée l'action « name » : pose_at(phase 0→1) renvoie les rotations."""
    action = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = action
    for f in range(frames + 1):
        key_pose(arm, f, pose_at(f / frames))
    # Boucle parfaite : interpolation linéaire entre clés denses.
    for fc in getattr(action, "fcurves", []):
        for kp in fc.keyframe_points:
            kp.interpolation = "LINEAR"
    action.use_fake_user = True
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    arm.animation_data.action = None
    return action


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=path, export_format="GLB", export_image_format="WEBP",
        export_animations=True, export_animation_mode="NLA_TRACKS", export_skins=True,
        export_apply=False, export_extras=True,
    )
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print("EXPORT", os.path.basename(path), "triangles", tris)


# ================================================================== okapi
def okapi():
    """Okapi (Okapia johnstoni) : ~1,6 m au garrot, robe chocolat-bordeaux,
    arrière-train et pattes rayés de blanc, joues claires, grandes oreilles."""
    J = {
        # Colonne : dos qui descend du garrot vers la croupe, ventre profond.
        "bassin":  ((0, 0.85, 1.36), 0.27, 0.32),
        "rein":    ((0, 0.42, 1.40), 0.31, 0.38),
        "ventre":  ((0, -0.05, 1.38), 0.34, 0.43),
        "poitrail": ((0, -0.55, 1.40), 0.30, 0.42),
        "garrot":  ((0, -0.88, 1.52), 0.22, 0.30),
        # Cou plus court et épais, tête portée en avant.
        "cou1":    ((0, -1.10, 1.66), 0.17, 0.23),
        "cou2":    ((0, -1.26, 1.83), 0.14, 0.18),
        "nuque":   ((0, -1.38, 1.94), 0.12, 0.14),
        "front":   ((0, -1.52, 1.93), 0.11, 0.12),
        "chanfrein": ((0, -1.71, 1.82), 0.08, 0.095),
        "museau":  ((0, -1.84, 1.74), 0.07, 0.075),
        # Queue
        "queue1":  ((0, 1.08, 1.34), 0.05, 0.05),
        "queue2":  ((0, 1.17, 1.06), 0.03, 0.03),
        "fouet":   ((0, 1.19, 0.92), 0.05, 0.05),
    }
    E = [("bassin", "rein"), ("rein", "ventre"), ("ventre", "poitrail"), ("poitrail", "garrot"),
         ("garrot", "cou1"), ("cou1", "cou2"), ("cou2", "nuque"), ("nuque", "front"), ("front", "chanfrein"), ("chanfrein", "museau"),
         ("bassin", "queue1"), ("queue1", "queue2"), ("queue2", "fouet")]
    legs = {}
    for side, sx in (("g", 1), ("d", -1)):
        x = 0.19 * sx
        front = [("epaule", (x, -0.62, 1.20), 0.14, 0.21), ("coude", (x, -0.58, 0.92), 0.095, 0.11),
                 ("genou", (x, -0.60, 0.50), 0.062, 0.066), ("boulet", (x, -0.60, 0.14), 0.047, 0.05), ("sabot", (x, -0.64, 0.035), 0.056, 0.06)]
        hind = [("hanche", (x * 1.05, 0.72, 1.12), 0.18, 0.25), ("grasset", (x * 1.05, 0.58, 0.82), 0.125, 0.15),
                ("jarret", (x * 1.0, 0.84, 0.50), 0.062, 0.07), ("boulet", (x * 1.0, 0.80, 0.14), 0.047, 0.05), ("sabot", (x * 1.0, 0.77, 0.035), 0.056, 0.06)]
        for label, chain, attach in (("av", front, "poitrail"), ("ar", hind, "bassin")):
            prev = attach
            names = []
            for joint, pos, rx, ry in chain:
                key = f"{joint}_{label}_{side}"
                J[key] = (pos, rx, ry)
                E.append((prev, key))
                prev = key
                names.append(key)
            legs[(label, side)] = names
    for side, sx in (("g", 1), ("d", -1)):
        # Grandes oreilles mobiles.
        J[f"oreille_{side}"] = ((0.11 * sx, -1.40, 2.05), 0.07, 0.025)
        J[f"oreille_bout_{side}"] = ((0.27 * sx, -1.34, 2.20), 0.035, 0.012)
        E += [("nuque", f"oreille_{side}"), (f"oreille_{side}", f"oreille_bout_{side}")]

    P = lambda n: Vector(J[n][0])
    def chain(points, radii, steps=4):
        """Chaîne de capsules qui se chevauchent : volume continu, sans perles."""
        out = []
        for i in range(len(points) - 1):
            a, b = Vector(points[i]), Vector(points[i + 1])
            for k in range(steps):
                t0, t1 = k / steps, (k + 1) / steps
                r = radii[i] + (radii[i + 1] - radii[i]) * (t0 + t1) / 2
                out.append(("cap", a.lerp(b, t0), a.lerp(b, t1), r))
        return out

    # Colonne et tronc : grosse chaîne du fouet de la croupe au garrot.
    els = chain([(0, 0.98, 1.30), (0, 0.72, 1.33), (0, 0.30, 1.37), (0, -0.15, 1.37), (0, -0.58, 1.38), (0, -0.86, 1.48)],
                [0.20, 0.30, 0.33, 0.35, 0.33, 0.24])
    # Ventre (plus bas) et poitrail (profond entre les antérieurs).
    els += chain([(0, 0.45, 1.20), (0, 0.0, 1.16), (0, -0.45, 1.18)], [0.22, 0.27, 0.25])
    els += [("ell", (0, -0.62, 1.26), (0.85, 0.9, 1.1), 0.26, (0, 0, 0)),
            ("ell", (0.1, 0.70, 1.28), (0.7, 1.0, 1.0), 0.24, (0, 0, 0)),
            ("ell", (-0.1, 0.70, 1.28), (0.7, 1.0, 1.0), 0.24, (0, 0, 0))]
    # Encolure puis tête, en chaîne continue (rayons décroissants).
    els += chain([(0, -0.86, 1.48), (0, -1.08, 1.64), (0, -1.26, 1.82), (0, -1.40, 1.94)], [0.22, 0.17, 0.135, 0.12])
    els += chain([(0, -1.40, 1.94), (0, -1.53, 1.92), (0, -1.70, 1.82), (0, -1.84, 1.74)], [0.12, 0.105, 0.08, 0.07])
    # Ganache (joues) et mâchoire.
    els += chain([(0, -1.44, 1.84), (0, -1.62, 1.76), (0, -1.78, 1.71)], [0.085, 0.065, 0.055], steps=3)
    # Musculature : crête de l'encolure, épaules, triceps, fessiers, ischio-jambiers.
    els += chain([(0, -0.95, 1.62), (0, -1.15, 1.80), (0, -1.33, 1.95)], [0.10, 0.085, 0.07], steps=3)
    for sx in (1, -1):
        els += [("ell", (0.17 * sx, -0.50, 1.06), (0.5, 0.8, 1.1), 0.14, (0, 0, 0)),     # triceps
                ("ell", (0.13 * sx, 0.78, 1.33), (0.6, 1.0, 0.9), 0.20, (0, 0, 0)),     # fessier
                ("ell", (0.15 * sx, 0.93, 1.02), (0.5, 0.7, 1.3), 0.13, (0.2, 0, 0)),   # ischio-jambiers
                ("ell", (0.06 * sx, -1.52, 1.83), (0.6, 1.0, 0.8), 0.07, (0.3, 0, 0)),  # joue, masséter
                ("ell", (0.075 * sx, -1.54, 1.955), (0.7, 0.8, 0.6), 0.045, (0, 0, 0))]  # arcade sourcilière
    els += [("ell", (0, -1.875, 1.745), (1.0, 0.7, 0.9), 0.065, (0, 0, 0))]            # mufle
    for sx in (1, -1):
        els += [("ell", (0.07 * sx, -1.47, 1.86), (0.55, 1.0, 1.1), 0.08, (0.2, 0, 0)),   # ganache large
                ("ell", (0.035 * sx, -1.84, 1.77), (0.7, 0.9, 0.7), 0.045, (0, 0, 0))]  # naseau
    els += [("ell", (0, -1.62, 1.93), (1.2, 2.2, 0.5), 0.06, (0.42, 0, 0))]             # chanfrein plat
    # Articulations lisibles (carpe, jarret, boulets) et flanc creusé devant la cuisse.
    for (label, side), names in legs.items():
        sx = 1 if side == "g" else -1
        if label == "av":
            els += [("ell", P(names[2]) + Vector((0, -0.025, 0.0)), (0.8, 0.8, 1.1), 0.065, (0, 0, 0))]
        else:
            els += [("ell", P(names[2]) + Vector((0, 0.035, 0.03)), (0.6, 1.0, 1.2), 0.07, (0, 0, 0))]
        els += [("ell", P(names[3]) + Vector((0, 0.01, 0.0)), (0.9, 1.0, 0.9), 0.05, (0, 0, 0))]
    for sx in (1, -1):
        els += [("neg", (0.37 * sx, 0.46, 1.10), (0.5, 1.1, 0.75), 0.13, (0, 0, 0))]
    # Ossicônes du mâle : deux petites cornes couvertes de peau.
    for sx in (1, -1):
        els += [("cap", (0.055 * sx, -1.45, 2.03), (0.06 * sx, -1.46, 2.075), 0.028)]
    # Queue.
    els += chain([(0, 0.98, 1.30), P("queue2"), P("fouet")], [0.05, 0.035, 0.03], steps=3)
    els += [("ell", P("fouet") + Vector((0, 0.01, -0.05)), (0.7, 0.7, 1.5), 0.06, (0, 0, 0))]
    for side, sx in (("g", 1), ("d", -1)):
        f = legs[("av", side)]
        h = legs[("ar", side)]
        # Antérieur : omoplate et avant-bras musclés, canon fin, sabot.
        def cloven(foot):
            """Deux onglons pointus vers l'avant, sculptés dans le volume."""
            return [("ell", foot + Vector((dx, -0.03, -0.005)), (0.45, 1.0, 0.6), 0.055, (0.15, 0, 0)) for dx in (-0.018, 0.018)]
        els += [("ell", P(f[0]) + Vector((0, 0.02, 0.06)), (0.5, 0.95, 1.3), 0.2, (0.25, 0, 0)),
                ("cap", P(f[0]), P(f[1]), 0.12), ("cap", P(f[1]), P(f[2]), 0.08),
                ("cap", P(f[2]), P(f[3]), 0.052), ("cap", P(f[3]), P(f[4]), 0.046)] + cloven(P(f[4]))
        # Postérieur : cuisse puissante, jarret, canon, sabot.
        els += [("ell", P(h[0]) + Vector((0, 0.02, -0.05)), (0.55, 1.0, 1.35), 0.24, (-0.2, 0, 0)),
                ("cap", P(h[0]), P(h[1]), 0.15), ("cap", P(h[1]), P(h[2]), 0.085),
                ("cap", P(h[2]), P(h[3]), 0.052), ("cap", P(h[3]), P(h[4]), 0.046)] + cloven(P(h[4]))
    body = meta_body("Okapi", els)

    # Squelette : un os par segment du graphe, aux noms explicites.
    bones = [("racine", None, P("ventre"), (0, -0.05, 1.62)),
             ("dos", "racine", P("ventre"), P("rein")), ("bassin", "dos", P("rein"), P("bassin")),
             ("poitrine", "racine", P("ventre"), P("poitrail")), ("garrot", "poitrine", P("poitrail"), P("garrot")),
             ("cou1", "garrot", P("garrot"), P("cou1")), ("cou2", "cou1", P("cou1"), P("cou2")), ("cou3", "cou2", P("cou2"), P("nuque")),
             ("tete", "cou3", P("nuque"), P("chanfrein")), ("museau", "tete", P("chanfrein"), P("museau")),
             ("queue1", "bassin", P("bassin"), P("queue1")), ("queue2", "queue1", P("queue1"), P("queue2")), ("queue3", "queue2", P("queue2"), P("fouet"))]
    for side in ("g", "d"):
        bones.append((f"oreille_{side}", "tete", P(f"oreille_{side}"), P(f"oreille_bout_{side}")))
        for label, attach in (("av", "poitrine"), ("ar", "bassin")):
            chain = legs[(label, side)]
            parent = attach
            for i in range(len(chain) - 1):
                bname = f"patte_{label}_{side}_{i + 1}"
                bones.append((bname, parent, P(chain[i]), P(chain[i + 1])))
                parent = bname
    arm = build_armature("Okapi_Squelette", bones)

    # Pelage procédural (coordonnées objet, au repos), cuit en textures.
    def coat(nt):
        nodes, links = nt.nodes, nt.links
        bsdf = nodes["Principled BSDF"]
        tc = nodes.new("ShaderNodeTexCoord")
        sep = nodes.new("ShaderNodeSeparateXYZ")
        links.new(tc.outputs["Object"], sep.inputs["Vector"])

        def math_node(op, a, b=None, clamp=False):
            n = nodes.new("ShaderNodeMath")
            n.operation = op
            n.use_clamp = clamp
            for i, v in enumerate((a, b)):
                if v is None:
                    continue
                if isinstance(v, (int, float)):
                    n.inputs[i].default_value = v
                else:
                    links.new(v, n.inputs[i])
            return n.outputs[0]

        def smooth(v, lo, hi):
            m = nodes.new("ShaderNodeMapRange")
            m.interpolation_type = "SMOOTHSTEP"
            m.inputs["From Min"].default_value, m.inputs["From Max"].default_value = lo, hi
            links.new(v, m.inputs["Value"])
            return m.outputs["Result"]

        X, Y, Z = sep.outputs["X"], sep.outputs["Y"], sep.outputs["Z"]
        ax = math_node("ABSOLUTE", X)
        warp = nodes.new("ShaderNodeTexNoise")
        warp.inputs["Scale"].default_value = 3.0
        links.new(tc.outputs["Object"], warp.inputs["Vector"])
        # Rayures horizontales ondulées : sin(z·k + bruit).
        zw = math_node("ADD", math_node("MULTIPLY", Z, 95.0), math_node("MULTIPLY", warp.outputs["Fac"], 14.0))
        stripes = smooth(math_node("SINE", zw), 0.35, 0.6)
        # Zones rayées : arrière-train (y > 0.35, sous 1,45 m) et haut des pattes.
        hind = math_node("MULTIPLY", smooth(Y, 0.42, 0.7), smooth(math_node("SUBTRACT", 1.52, Z), 0.0, 0.2))
        upper_legs = math_node("MULTIPLY", smooth(math_node("SUBTRACT", 1.0, Z), 0.0, 0.12), smooth(Z, 0.5, 0.58))
        striped = math_node("MULTIPLY", math_node("MAXIMUM", hind, upper_legs), stripes, clamp=True)
        # Bas des pattes blanc crème, bague sombre au boulet, sabot noir.
        low = smooth(math_node("SUBTRACT", 0.55, Z), 0.0, 0.06)
        ring = math_node("MULTIPLY", smooth(Z, 0.09, 0.12), smooth(math_node("SUBTRACT", 0.2, Z), 0.0, 0.03))
        hoof = smooth(math_node("SUBTRACT", 0.09, Z), 0.0, 0.02)
        white_low = math_node("SUBTRACT", low, math_node("MAXIMUM", ring, hoof), clamp=True)
        # Face : joues et gorge claires, front et chanfrein sombres.
        # Tête (y < -1.42) : joues, mâchoire et côtés du chanfrein clairs sous
        # la ligne de l'œil, qui descend vers le museau ; front et nez sombres.
        head = smooth(math_node("SUBTRACT", -1.42, Y), 0.0, 0.06)
        eye_line = math_node("ADD", 2.52, math_node("MULTIPLY", Y, 0.42))  # z de la ligne de l'œil
        below = smooth(math_node("SUBTRACT", eye_line, Z), 0.0, 0.03)
        nose = math_node("MULTIPLY", smooth(math_node("SUBTRACT", -1.875, Y), 0.0, 0.02), 0.6)
        cheeks = math_node("SUBTRACT", math_node("MULTIPLY", head, math_node("MULTIPLY", below, smooth(ax, 0.025, 0.05))), nose, clamp=True)
        white = math_node("MAXIMUM", math_node("MAXIMUM", striped, white_low), cheeks, clamp=True)
        # Narines (deux fentes sombres au bout du mufle) et commissure des lèvres.
        def spot(cx, cy, cz, r):
            d = nodes.new("ShaderNodeVectorMath")
            d.operation = "DISTANCE"
            links.new(tc.outputs["Object"], d.inputs[0])
            d.inputs[1].default_value = (cx, cy, cz)
            return smooth(math_node("SUBTRACT", r, d.outputs["Value"]), 0.0, r * 0.4)
        nostrils = math_node("MAXIMUM", spot(0.032, -1.915, 1.765, 0.016), spot(-0.032, -1.915, 1.765, 0.016))
        mouth_z = math_node("ADD", 1.705, math_node("MULTIPLY", math_node("ADD", Y, 1.8), 0.35))
        mouth = math_node("MULTIPLY", smooth(math_node("SUBTRACT", 0.007, math_node("ABSOLUTE", math_node("SUBTRACT", Z, mouth_z))), 0.0, 0.004),
                          smooth(math_node("SUBTRACT", -1.72, Y), 0.0, 0.02))
        face_dark = math_node("MAXIMUM", nostrils, mouth)
        dark = math_node("MAXIMUM", math_node("MAXIMUM", math_node("MAXIMUM", hoof, ring), nose), face_dark)
        forehead = math_node("MULTIPLY", head, math_node("SUBTRACT", 1.0, below), clamp=True)

        robe = nodes.new("ShaderNodeMix")
        robe.data_type = "RGBA"
        links.new(warp.outputs["Fac"], robe.inputs[0])
        # Ventre et intérieur des cuisses un peu plus roux.
        belly = math_node("MULTIPLY", smooth(math_node("SUBTRACT", 1.22, Z), 0.0, 0.1), smooth(Z, 0.95, 1.05))
        belly_mix = nodes.new("ShaderNodeMix")
        belly_mix.data_type = "RGBA"
        links.new(math_node("MULTIPLY", belly, 0.7), belly_mix.inputs[0])
        links.new(robe.outputs[2], belly_mix.inputs[6])
        belly_mix.inputs[7].default_value = (0.075, 0.025, 0.012, 1)
        red = nodes.new("ShaderNodeMix")  # front et chanfrein roux
        red.data_type = "RGBA"
        links.new(forehead, red.inputs[0])
        links.new(belly_mix.outputs[2], red.inputs[6])
        red.inputs[7].default_value = (0.11, 0.035, 0.016, 1)
        robe.inputs[6].default_value = (0.028, 0.011, 0.007, 1)  # brun presque noir
        robe.inputs[7].default_value = (0.06, 0.019, 0.010, 1)  # reflets bordeaux
        cream = nodes.new("ShaderNodeMix")
        cream.data_type = "RGBA"
        links.new(white, cream.inputs[0])
        links.new(red.outputs[2], cream.inputs[6])
        cream.inputs[7].default_value = (0.62, 0.53, 0.40, 1)  # crème
        blk = nodes.new("ShaderNodeMix")
        blk.data_type = "RGBA"
        links.new(dark, blk.inputs[0])
        links.new(cream.outputs[2], blk.inputs[6])
        blk.inputs[7].default_value = (0.012, 0.009, 0.007, 1)
        links.new(blk.outputs[2], bsdf.inputs["Base Color"])
        # Poil ras : relief fin et étiré le long du corps.
        # Poil ras couché vers l'arrière : bruit étiré le long du corps.
        flow = nodes.new("ShaderNodeMapping")
        flow.inputs["Scale"].default_value = (1.0, 0.12, 1.0)
        links.new(tc.outputs["Object"], flow.inputs["Vector"])
        hair = nodes.new("ShaderNodeTexNoise")
        hair.inputs["Scale"].default_value = 320.0
        hair.inputs["Detail"].default_value = 3.0
        links.new(flow.outputs["Vector"], hair.inputs["Vector"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.25
        bump.inputs["Distance"].default_value = 0.002
        links.new(hair.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    smart_uv(body)
    def fur_mask(nt):
        math_node, smooth, mix = shader_tools(nt)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
        Y, Z = sep.outputs["Y"], sep.outputs["Z"]
        hooves = smooth(math_node("SUBTRACT", 0.1, Z), 0.0, 0.03)
        lower = math_node("MULTIPLY", smooth(math_node("SUBTRACT", 0.55, Z), 0.0, 0.1), 0.45)   # poil plus ras au bas des pattes
        muzzle = math_node("MULTIPLY", smooth(math_node("SUBTRACT", -1.80, Y), 0.0, 0.05), 0.6)
        return math_node("SUBTRACT", 1.0, math_node("MAXIMUM", math_node("MAXIMUM", hooves, lower), muzzle), clamp=True)

    coat_mat = bake_coat(body, coat, A.texture_size, fur=(fur_mask, 0.012, 16))
    # Oreilles : même pelage sombre (couleur unie proche de la robe), yeux brillants.
    ear_mat = bpy.data.materials.new("Okapi_oreille")
    eb = ear_mat.node_tree.nodes["Principled BSDF"]
    eb.inputs["Base Color"].default_value = (0.035, 0.014, 0.009, 1)
    eb.inputs["Roughness"].default_value = 0.7
    parts = [body]
    for side, sx in (("g", 1), ("d", -1)):
        ear = leaf_ear(f"Okapi_oreille_{side}", (0.09 * sx, -1.40, 2.02), (0.33 * sx, -1.35, 2.22), 0.105, cup=0.6, thickness=0.006)
        ear.data.materials.append(ear_mat)
        parts.append(ear)
    parts += eyes("Okapi", [(0.08, -1.56, 1.955), (-0.08, -1.56, 1.955)], 0.024, body=body, lid_color=(0.02, 0.008, 0.005))
    body = join(parts, "Okapi")
    bind(body, arm)

    # Animations. Phase 0→1 ; paires diagonales (av-g / ar-d) en opposition.
    def legs_pose(t, amp, lift):
        rot = {}
        for label, side, off in (("av", "g", 0.0), ("ar", "d", 0.0), ("av", "d", 0.5), ("ar", "g", 0.5)):
            ph = 2 * math.pi * (t + off)
            swing = math.sin(ph) * amp
            fold = max(0.0, math.cos(ph)) * lift  # pli quand la patte revient
            sgn = 1 if label == "av" else -1
            rot[f"patte_{label}_{side}_1"] = (swing, 0, 0)
            rot[f"patte_{label}_{side}_2"] = (-fold * 0.6 * sgn, 0, 0)
            rot[f"patte_{label}_{side}_3"] = (fold * 1.1 * sgn, 0, 0)
            rot[f"patte_{label}_{side}_4"] = (-fold * 0.5 * sgn, 0, 0)
        return rot

    def walk(t):
        r = legs_pose(t, 0.32, 0.55)
        bob = math.sin(4 * math.pi * t) * 0.03
        r.update({"cou1": (0.05 + bob, 0, 0), "tete": (-0.05 - bob, 0, 0), "queue2": (0.1, math.sin(2 * math.pi * t) * 0.2, 0)})
        return r

    def run(t):
        r = legs_pose(t, 0.6, 0.95)
        r.update({"cou1": (-0.12 + math.sin(4 * math.pi * t) * 0.06, 0, 0), "queue1": (-0.4, 0, 0)})
        return r

    def idle(t):
        # Broute : encolure qui descend lentement, oreilles qui pivotent.
        graze = 0.5 - 0.5 * math.cos(2 * math.pi * t)
        r = {f"patte_{l}_{s}_{i}": (0, 0, 0) for l in ("av", "ar") for s in ("g", "d") for i in range(1, 5)}
        r.update({"cou1": (0.55 * graze, 0, 0), "cou2": (0.35 * graze, 0, 0), "tete": (0.25 * graze, 0, 0),
                  "oreille_g": (0, 0, 0.25 * math.sin(6 * math.pi * t)), "oreille_d": (0, 0, -0.25 * math.sin(4 * math.pi * t + 1)),
                  "queue2": (0, 0.35 * math.sin(8 * math.pi * t), 0)})
        return r

    make_action(arm, "marche", 28, walk)
    make_action(arm, "course", 16, run)
    make_action(arm, "repos", 120, idle)
    return body, arm



# ============================================================== éléphant
def shader_tools(nt):
    """Petits constructeurs de nœuds partagés par les pelages et les peaux."""
    nodes, links = nt.nodes, nt.links

    def math_node(op, a, b=None, clamp=False):
        n = nodes.new("ShaderNodeMath")
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                links.new(v, n.inputs[i])
        return n.outputs[0]

    def smooth(v, lo, hi):
        m = nodes.new("ShaderNodeMapRange")
        m.interpolation_type = "SMOOTHSTEP"
        m.inputs["From Min"].default_value, m.inputs["From Max"].default_value = lo, hi
        links.new(v, m.inputs["Value"])
        return m.outputs["Result"]

    def mix(fac, a, b):
        n = nodes.new("ShaderNodeMix")
        n.data_type = "RGBA"
        if isinstance(fac, (int, float)):
            n.inputs[0].default_value = fac
        else:
            links.new(fac, n.inputs[0])
        for idx, v in ((6, a), (7, b)):
            if isinstance(v, tuple):
                n.inputs[idx].default_value = (*v, 1)
            else:
                links.new(v, n.inputs[idx])
        return n.outputs[2]

    return math_node, smooth, mix


def chain_capsules(points, radii, steps=4):
    out = []
    for i in range(len(points) - 1):
        a, b = Vector(points[i]), Vector(points[i + 1])
        for k in range(steps):
            t0, t1 = k / steps, (k + 1) / steps
            r = radii[i] + (radii[i + 1] - radii[i]) * (t0 + t1) / 2
            out.append(("cap", a.lerp(b, t0), a.lerp(b, t1), r))
    return out


def tusk(name, points, r0, r1, mat, sides=10):
    """Défense : tube effilé qui suit une courbe."""
    import bmesh
    pts = [Vector(p) for p in points]
    bm = bmesh.new()
    rings = []
    for i, c in enumerate(pts):
        t = i / (len(pts) - 1)
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = d.cross(Vector((1, 0, 0)))
        side = side.normalized() if side.length > 1e-3 else Vector((0, 1, 0))
        up = d.cross(side)
        r = r0 + (r1 - r0) * t ** 0.8
        rings.append([bm.verts.new(c + (side * math.cos(k / sides * 2 * math.pi) + up * math.sin(k / sides * 2 * math.pi)) * r) for k in range(sides)])
    for i in range(len(rings) - 1):
        for k in range(sides):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
    tip = bm.verts.new(pts[-1] + (pts[-1] - pts[-2]).normalized() * r1 * 2)
    for k in range(sides):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % sides], tip))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def elephant():
    """Éléphant de forêt (Loxodonta cyclotis) : ~2,4 m au garrot, peau gris-brun
    ridée, oreilles arrondies et pendantes, défenses droites tournées vers le bas."""
    # Articulations des pattes (utilisées aussi par le squelette).
    legs = {}
    for side, sx in (("g", 1), ("d", -1)):
        legs[("av", side)] = [(0.50 * sx, -0.78, 1.80), (0.50 * sx, -0.72, 1.18), (0.50 * sx, -0.76, 0.62), (0.50 * sx, -0.78, 0.16), (0.50 * sx, -0.82, 0.03)]
        legs[("ar", side)] = [(0.52 * sx, 1.12, 1.78), (0.52 * sx, 1.02, 1.16), (0.52 * sx, 1.20, 0.62), (0.52 * sx, 1.16, 0.16), (0.52 * sx, 1.12, 0.03)]
    trunk = [(0, -1.80, 2.08), (0, -2.02, 1.62), (0, -2.08, 1.12), (0, -2.03, 0.62), (0, -1.98, 0.28), (0, -2.08, 0.12)]
    tail = [(0, 1.92, 1.88), (0, 2.02, 1.40), (0, 2.05, 0.98)]

    els = chain_capsules([(0, 1.45, 1.86), (0, 0.6, 2.02), (0, -0.3, 2.02), (0, -0.92, 2.08)], [0.78, 0.95, 0.92, 0.72])
    els += chain_capsules([(0, 0.7, 1.55), (0, -0.4, 1.52)], [0.72, 0.70])           # ventre
    els += chain_capsules([(0, -0.92, 2.08), (0, -1.35, 2.25), (0, -1.55, 2.40)], [0.72, 0.58, 0.48])  # encolure, crâne
    els += [("ell", (0, -1.55, 2.62), (1.0, 0.9, 0.8), 0.36, (0, 0, 0)),           # front bombé
            ("ell", (0, -1.72, 1.82), (0.9, 0.8, 0.7), 0.17, (0, 0, 0))]            # lèvre inférieure
    els += chain_capsules(trunk, [0.24, 0.17, 0.13, 0.10, 0.075, 0.06])
    els += chain_capsules(tail, [0.06, 0.04, 0.03], steps=3)
    els += [("ell", Vector(tail[-1]) + Vector((0, 0, -0.08)), (0.6, 0.6, 1.6), 0.07, (0, 0, 0))]
    for (label, side), j in legs.items():
        top = 0.40 if label == "av" else 0.44
        els += chain_capsules(j, [top, 0.31, 0.26, 0.27, 0.30], steps=3)
        els += [("ell", Vector(j[0]) + Vector((0, 0, 0.1)), (0.8, 1.0, 1.3), top * 1.05, (0, 0, 0))]  # épaule, cuisse
    # Ongles : 3 à 4 bombements sur l'avant de chaque pied.
    nails = []
    for (label, side), j in legs.items():
        foot = Vector(j[4])
        count = 4 if label == "av" else 3
        for i in range(count):
            a = (i / (count - 1) - 0.5) * 1.6
            c = foot + Vector((math.sin(a) * 0.27, -math.cos(a) * 0.27, 0.06))
            nails.append(c)
            els.append(("ell", c, (0.8, 0.6, 0.8), 0.07, (0, 0, a)))
    # Bout de trompe : « doigts » supérieur et inférieur.
    tip = Vector(trunk[-1])
    els += [("ell", tip + Vector((0, -0.04, 0.03)), (0.7, 0.6, 0.6), 0.05, (0, 0, 0)),
            ("ell", tip + Vector((0, 0.03, -0.02)), (0.7, 0.6, 0.6), 0.045, (0, 0, 0))]
    for sx in (1, -1):
        els += [("neg", (0.50 * sx, -1.48, 2.48), (0.6, 0.9, 0.9), 0.16, (0, 0, 0))]   # tempes creusées
    body = meta_body("Elephant", els, resolution=0.03, voxel=0.022, faces=16000)
    # Oreilles arrondies et pendantes, cuites avec la peau.
    ears = []
    for side, sx in (("g", 1), ("d", -1)):
        ears.append(leaf_ear(f"Elephant_oreille_{side}", (0.50 * sx, -1.28, 2.80), (0.78 * sx, -0.95, 1.45), 0.78, cup=0.10, thickness=0.05, ragged=0.12))
    body = join([body] + ears, "Elephant")

    def skin(nt):
        nodes, links = nt.nodes, nt.links
        math_node, smooth, mix = shader_tools(nt)
        bsdf = nodes["Principled BSDF"]
        tc = nodes.new("ShaderNodeTexCoord")
        sep = nodes.new("ShaderNodeSeparateXYZ")
        links.new(tc.outputs["Object"], sep.inputs["Vector"])
        Y, Z = sep.outputs["Y"], sep.outputs["Z"]
        tint = nodes.new("ShaderNodeTexNoise")
        tint.inputs["Scale"].default_value = 1.2
        links.new(tc.outputs["Object"], tint.inputs["Vector"])
        # Gris-brun (d'après la photo), plus brun et plus sombre sur les pattes boueuses.
        base = mix(tint.outputs["Fac"], (0.105, 0.095, 0.085), (0.15, 0.13, 0.11))
        mud = smooth(math_node("SUBTRACT", 0.75, Z), 0.0, 0.35)
        mud_n = nodes.new("ShaderNodeTexNoise")
        mud_n.inputs["Scale"].default_value = 4.0
        links.new(tc.outputs["Object"], mud_n.inputs["Vector"])
        color = mix(math_node("MULTIPLY", mud, smooth(mud_n.outputs["Fac"], 0.3, 0.55)), base, (0.055, 0.04, 0.03))
        # Rides : réseau de craquelures (Voronoi) + anneaux de la trompe.
        warp = nodes.new("ShaderNodeTexNoise")
        warp.inputs["Scale"].default_value = 3.0
        links.new(tc.outputs["Object"], warp.inputs["Vector"])
        warped = nodes.new("ShaderNodeVectorMath")
        warped.operation = "MULTIPLY_ADD"
        links.new(warp.outputs["Color"], warped.inputs[0])
        warped.inputs[1].default_value = (0.12, 0.12, 0.12)
        links.new(tc.outputs["Object"], warped.inputs[2])
        vor = nodes.new("ShaderNodeTexVoronoi")
        vor.feature = "DISTANCE_TO_EDGE"
        vor.inputs["Scale"].default_value = 26.0
        vor.inputs["Randomness"].default_value = 1.0
        links.new(warped.outputs["Vector"], vor.inputs["Vector"])
        vor2 = nodes.new("ShaderNodeTexVoronoi")
        vor2.feature = "DISTANCE_TO_EDGE"
        vor2.inputs["Scale"].default_value = 80.0
        links.new(warped.outputs["Vector"], vor2.inputs["Vector"])
        cracks = math_node("MULTIPLY", smooth(vor.outputs["Distance"], 0.0, 0.1), math_node("ADD", 0.6, math_node("MULTIPLY", smooth(vor2.outputs["Distance"], 0.0, 0.12), 0.4)))
        trunk_zone = smooth(math_node("SUBTRACT", -1.78, Y), 0.0, 0.08)
        rings = math_node("MULTIPLY", trunk_zone, smooth(math_node("SINE", math_node("MULTIPLY", Z, 70.0)), 0.6, 1.0))
        height = math_node("SUBTRACT", cracks, math_node("MULTIPLY", rings, 0.8))
        # Les creux des rides sont un peu plus sombres.
        color = mix(math_node("MULTIPLY", math_node("SUBTRACT", 1.0, cracks), 0.35), color, (0.05, 0.045, 0.04))
        def spot(c, r):
            d = nodes.new("ShaderNodeVectorMath")
            d.operation = "DISTANCE"
            links.new(tc.outputs["Object"], d.inputs[0])
            d.inputs[1].default_value = tuple(c)
            return smooth(math_node("SUBTRACT", r, d.outputs["Value"]), 0.0, r * 0.5)
        nail = None
        for c in nails:
            sp = spot(c, 0.07)
            nail = sp if nail is None else math_node("MAXIMUM", nail, sp)
        color = mix(nail, color, (0.45, 0.41, 0.34))
        # Plaques de boue de latérite séchée (bains de boue), surtout sur le dos et les flancs.
        dry = nodes.new("ShaderNodeTexNoise")
        dry.inputs["Scale"].default_value = 2.2
        dry.inputs["Detail"].default_value = 8.0
        links.new(tc.outputs["Object"], dry.inputs["Vector"])
        patches = math_node("MULTIPLY", smooth(dry.outputs["Fac"], 0.52, 0.6), smooth(Z, 1.2, 1.8))
        color = mix(math_node("MULTIPLY", patches, 0.75), color, (0.17, 0.09, 0.05))
        tipc = Vector(trunk[-1])
        nostrils = math_node("MAXIMUM", spot(tipc + Vector((0.025, -0.02, -0.03)), 0.022), spot(tipc + Vector((-0.025, -0.02, -0.03)), 0.022))
        mouth = spot((0, -1.70, 1.80), 0.09)
        color = mix(math_node("MAXIMUM", nostrils, mouth), color, (0.02, 0.015, 0.012))
        links.new(color, bsdf.inputs["Base Color"])
        # Plis profonds aux genoux et aux coudes (anneaux horizontaux).
        X = sep.outputs["X"]
        on_leg = smooth(math_node("ABSOLUTE", X), 0.28, 0.36)
        knee = math_node("MAXIMUM", smooth(math_node("SUBTRACT", 0.12, math_node("ABSOLUTE", math_node("SUBTRACT", Z, 0.62))), 0.0, 0.05),
                         smooth(math_node("SUBTRACT", 0.12, math_node("ABSOLUTE", math_node("SUBTRACT", Z, 1.18))), 0.0, 0.05))
        folds = math_node("MULTIPLY", math_node("MULTIPLY", on_leg, knee), smooth(math_node("SINE", math_node("MULTIPLY", Z, 110.0)), 0.3, 1.0))
        # Rides concentriques autour des yeux.
        for ex in (0.37, -0.37):
            d = nodes.new("ShaderNodeVectorMath")
            d.operation = "DISTANCE"
            links.new(tc.outputs["Object"], d.inputs[0])
            d.inputs[1].default_value = (ex, -1.66, 2.36)
            ring = math_node("MULTIPLY", smooth(math_node("SUBTRACT", 0.16, d.outputs["Value"]), 0.0, 0.06),
                             smooth(math_node("SINE", math_node("MULTIPLY", d.outputs["Value"], 160.0)), 0.2, 1.0))
            folds = math_node("MAXIMUM", folds, ring)
        height = math_node("SUBTRACT", height, math_node("MULTIPLY", folds, 1.2))
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.5
        bump.inputs["Distance"].default_value = 0.012
        links.new(height, bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    smart_uv(body)
    skin_mat = bake_coat(body, skin, A.texture_size)
    skin_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.85
    if "Sheen Weight" in skin_mat.node_tree.nodes["Principled BSDF"].inputs:
        skin_mat.node_tree.nodes["Principled BSDF"].inputs["Sheen Weight"].default_value = 0.0
    ivory = bpy.data.materials.new("Ivoire")
    ib = ivory.node_tree.nodes["Principled BSDF"]
    ib.inputs["Base Color"].default_value = (0.42, 0.32, 0.19, 1)
    ib.inputs["Roughness"].default_value = 0.35
    parts = [body]
    for sx in (1, -1):
        # Défenses longues, presque droites, dirigées vers le bas et l'avant.
        parts.append(tusk(f"Elephant_defense_{sx}", [(0.20 * sx, -1.70, 1.92), (0.22 * sx, -1.86, 1.55), (0.22 * sx, -2.02, 1.15), (0.19 * sx, -2.16, 0.82)], 0.095, 0.022, ivory))
    parts += eyes("Elephant", [(0.37, -1.66, 2.36), (-0.37, -1.66, 2.36)], 0.024, body=body, lid_color=(0.07, 0.06, 0.055), show=0.4)
    hair = bpy.data.materials.new("Crins")
    hair.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.01, 0.009, 0.008, 1)
    end = Vector(tail[-1])
    for i in range(14):
        a = i / 14 * 2 * math.pi
        root = end + Vector((math.cos(a) * 0.025, math.sin(a) * 0.025, 0.05))
        tipv = end + Vector((math.cos(a) * 0.06, math.sin(a) * 0.06 + 0.02, -0.32 - 0.06 * math.sin(a * 3)))
        parts.append(tusk(f"Elephant_crin_{i}", [root, root.lerp(tipv, 0.5) + Vector((0, 0.01, 0)), tipv], 0.006, 0.002, hair, sides=4))
    body = join(parts, "Elephant")

    # Squelette.
    bones = [("racine", None, (0, 0.1, 1.9), (0, 0.1, 2.3)),
             ("dos", "racine", (0, 0.1, 1.9), (0, 1.45, 1.86)), ("poitrine", "racine", (0, 0.1, 1.9), (0, -0.92, 2.08)),
             ("cou", "poitrine", (0, -0.92, 2.08), (0, -1.35, 2.25)), ("tete", "cou", (0, -1.35, 2.25), trunk[0]),
             ("queue1", "dos", (0, 1.45, 1.86), tail[1]), ("queue2", "queue1", tail[1], tail[2])]
    for i in range(len(trunk) - 1):
        bones.append((f"trompe{i + 1}", "tete" if i == 0 else f"trompe{i}", trunk[i], trunk[i + 1]))
    for side, sx in (("g", 1), ("d", -1)):
        bones.append((f"oreille_{side}", "tete", (0.50 * sx, -1.28, 2.80), (0.78 * sx, -0.95, 1.45)))
        for label, attach in (("av", "poitrine"), ("ar", "dos")):
            j = legs[(label, side)]
            parent = attach
            for i in range(len(j) - 1):
                bname = f"patte_{label}_{side}_{i + 1}"
                bones.append((bname, parent, j[i], j[i + 1]))
                parent = bname
    arm = build_armature("Elephant_Squelette", bones)
    bind(body, arm)

    def legs_pose(t, amp, lift):
        rot = {}
        # Amble lent : les deux pattes d'un même côté bougent presque ensemble.
        for label, side, off in (("ar", "g", 0.0), ("av", "g", 0.12), ("ar", "d", 0.5), ("av", "d", 0.62)):
            ph = 2 * math.pi * (t + off)
            sgn = 1 if label == "av" else -1
            fold = max(0.0, math.cos(ph)) * lift
            rot[f"patte_{label}_{side}_1"] = (math.sin(ph) * amp, 0, 0)
            rot[f"patte_{label}_{side}_2"] = (-fold * 0.5 * sgn, 0, 0)
            rot[f"patte_{label}_{side}_3"] = (fold * 0.7 * sgn, 0, 0)
            rot[f"patte_{label}_{side}_4"] = (0, 0, 0)
        return rot

    def trunk_pose(t, amp):
        return {f"trompe{i + 1}": (amp * 0.5 * math.sin(2 * math.pi * t + i * 0.6), amp * math.sin(2 * math.pi * t + i * 0.9), 0) for i in range(5)}

    def walk(t):
        r = legs_pose(t, 0.2, 0.35)
        r.update(trunk_pose(t, 0.12))
        r.update({"oreille_g": (0, 0, 0.12 * math.sin(2 * math.pi * t)), "oreille_d": (0, 0, -0.12 * math.sin(2 * math.pi * t)),
                  "queue1": (0, 0.25 * math.sin(2 * math.pi * t), 0), "tete": (0.03 * math.sin(4 * math.pi * t), 0, 0)})
        return r

    def run(t):
        r = legs_pose(t, 0.38, 0.6)
        r.update(trunk_pose(t, 0.25))
        r.update({"oreille_g": (0, 0, 0.45), "oreille_d": (0, 0, -0.45), "tete": (-0.1, 0, 0)})  # oreilles écartées : alerte
        return r

    def idle(t):
        r = legs_pose(0.0, 0.0, 0.0)
        r.update(trunk_pose(t, 0.25))
        flap = math.sin(6 * math.pi * t)
        r.update({"oreille_g": (0, 0, 0.3 * max(0.0, flap)), "oreille_d": (0, 0, -0.3 * max(0.0, flap)),
                  "queue1": (0, 0.4 * math.sin(4 * math.pi * t), 0)})
        return r

    make_action(arm, "marche", 40, walk)
    make_action(arm, "course", 24, run)
    make_action(arm, "repos", 144, idle)
    return body, arm


def feather_atlas(size=1024, seed=3):
    """Planche 2 × 2 de plumes (transparence découpée) :
    0 contour arrondi, 1 couverture d'aile allongée, 2 rectrice de queue, 3 petite plume du cou.
    Rachis, barbes obliques, cœur sombre et liseré irisé bleu-vert ou violet."""
    import numpy as np
    rng_np = np.random.default_rng(seed)
    img = np.zeros((size, size, 4))
    half = size // 2
    y, x = np.mgrid[0:half, 0:half] / half
    shapes = [(0.86, 0.36, 0.5), (0.92, 0.26, 0.35), (0.94, 0.30, 0.25), (0.8, 0.40, 0.7)]
    irid = [np.array([0.06, 0.42, 0.40]), np.array([0.05, 0.45, 0.28]), np.array([0.08, 0.36, 0.48]), np.array([0.20, 0.18, 0.58])]
    for q, (L, W, round_tip) in enumerate(shapes):
        u = 1 - y                      # le long du rachis (0 base, 1 pointe)
        v = (x - 0.5) * 2              # en travers (-1 … 1)
        prof = np.clip(np.sin(np.pi * np.clip(u / L, 0, 1)), 0, 1) ** round_tip
        halfw = W * prof * (u < L)
        inside = np.abs(v) * 0.5 < halfw
        edge = np.clip(1 - (np.abs(v) * 0.5) / np.maximum(halfw, 1e-4), 0, 1)
        barbs = 0.75 + 0.25 * np.sin((np.abs(v) * 40 - u * 60) + rng_np.random() * 6)
        rachis = np.exp(-(v / 0.025) ** 2) * (u < L * 0.95)
        band = np.clip((u / L - 0.35) * 2.5, 0, 1) * np.clip(1.25 - edge * 1.3, 0, 1)
        core = np.array([0.012, 0.014, 0.03])
        rgb = core[None, None, :] * (1 - band[..., None]) + irid[q][None, None, :] * band[..., None]
        rgb = rgb * barbs[..., None] + rachis[..., None] * 0.05
        a = np.where(inside, np.clip(edge * 6, 0, 1), 0)
        oy, ox = (q // 2) * half, (q % 2) * half
        img[oy:oy + half, ox:ox + half, :3] = np.flipud(rgb)
        img[oy:oy + half, ox:ox + half, 3] = np.flipud(a)
    out = bpy.data.images.new("plumes", size, size, alpha=True)
    out.pixels.foreach_set(np.ascontiguousarray(np.flipud(img), dtype=np.float32).ravel())
    out.pack()
    return out


def feather_cards(name, body, regions, tail_fan, mat, seed=11):
    """Pose des cartes de plumes sur la surface du corps.

    regions : [(filtre(co, n) -> bool, quadrant, (lmin, lmax), espacement)]
    tail_fan : (base, nombre, longueur, largeur, ouverture) ou None."""
    import bmesh
    import random as _r
    from mathutils import kdtree
    rnd = _r.Random(seed)
    quads = {0: ((0, 0.5), (0.5, 1)), 1: ((0.5, 0.5), (1, 1)), 2: ((0, 0), (0.5, 0.5)), 3: ((0.5, 0), (1, 0.5))}
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    back = Vector((0, 1, -0.35)).normalized()

    def card(p, n, d, length, width, q):
        side = n.cross(d).normalized()
        base = p - d * length * 0.15 + n * 0.003
        tip = p + d * length * 0.85 + n * (0.004 + length * 0.12)
        cs = [base - side * width / 2, base + side * width / 2, tip + side * width / 2, tip - side * width / 2]
        f = bm.faces.new([bm.verts.new(c) for c in cs])
        (u0, v0), (u1, v1) = quads[q]
        for loop, uv in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
            loop[uvl].uv = uv

    verts = [(body.matrix_world @ v.co, (body.matrix_world.to_3x3() @ v.normal).normalized()) for v in body.data.vertices]
    rnd.shuffle(verts)
    for keep, q, (lmin, lmax), spacing in regions:
        tree = kdtree.KDTree(len(verts))
        placed = 0
        for co, n in verts:
            if not keep(co, n):
                continue
            if placed and tree.find(co)[2] < spacing:
                continue
            d = back - n * back.dot(n)
            if d.length < 1e-3:
                continue
            d = (d.normalized() + Vector((rnd.uniform(-0.15, 0.15), 0, rnd.uniform(-0.1, 0.1)))).normalized()
            length = rnd.uniform(lmin, lmax)
            card(co, n, d, length, length * 0.62, q)
            tree.insert(co, placed)
            tree.balance()
            placed += 1
    if tail_fan:
        base, count, length, width, spread = tail_fan
        base = Vector(base)
        for i in range(count):
            a = (i / (count - 1) - 0.5) * spread
            d = Vector((math.sin(a) * 0.9, math.cos(a), -0.35 - 0.1 * abs(a))).normalized()
            n = Vector((0, 0.35, 1)).normalized()
            card(base + Vector((0, 0, 0.004 * (i % 2))), n, d, length * (1 - 0.12 * abs(a)), width, 2)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


# ============================================================ paon du Congo
def paon():
    """Paon du Congo (Afropavo congensis), mâle : ~65 cm, plumage bleu-noir à
    reflets verts et violets, gorge nue rouge, aigrette de soies blanches et
    noires, queue courte et arrondie (pas de traîne, contrairement au paon bleu)."""
    legs = {}
    for side, sx in (("g", 1), ("d", -1)):
        legs[side] = [(0.06 * sx, 0.03, 0.22), (0.06 * sx, 0.06, 0.115), (0.06 * sx, 0.04, 0.025)]
    neck = [(0, -0.15, 0.40), (0, -0.20, 0.48), (0, -0.225, 0.535), (0, -0.25, 0.565)]
    # Silhouette trapue de gallinacé : gros corps rond, cou court, queue arrondie.
    els = [("ell", (0, 0.03, 0.33), (1.0, 1.45, 0.95), 0.19, (-0.2, 0, 0)),     # corps
           ("ell", (0, -0.10, 0.36), (0.95, 0.95, 1.0), 0.15, (0, 0, 0)),       # poitrine
           ("ell", (0, 0.25, 0.32), (1.25, 1.3, 0.5), 0.16, (0.25, 0, 0))]      # queue courte, en éventail fermé
    els += chain_capsules(neck, [0.085, 0.06, 0.048, 0.05], steps=3)
    els += [("ell", (0, -0.265, 0.575), (0.9, 1.15, 0.9), 0.052, (0, 0, 0))]  # tête
    els += chain_capsules([(0, -0.305, 0.57), (0, -0.345, 0.56)], [0.017, 0.008], steps=2)  # bec
    for side, j in legs.items():
        els += chain_capsules([j[0], j[1]], [0.045, 0.016], steps=2)        # cuisse emplumée
        els += chain_capsules([j[1], j[2]], [0.012, 0.011], steps=3)        # tarse
        foot = Vector(j[2])
        for ang in (-0.45, 0.0, 0.45):
            toe = foot + Vector((math.sin(ang) * 0.06, -math.cos(ang) * 0.06, -0.02))
            els += [("cap", foot, toe, 0.007)]
        els += [("cap", foot, foot + Vector((0, 0.04, -0.015)), 0.006)]
    body = meta_body("Paon", els, resolution=0.004, voxel=0.0045, faces=9000)

    def plumage(nt):
        nodes, links = nt.nodes, nt.links
        math_node, smooth, mix = shader_tools(nt)
        bsdf = nodes["Principled BSDF"]
        tc = nodes.new("ShaderNodeTexCoord")
        sep = nodes.new("ShaderNodeSeparateXYZ")
        links.new(tc.outputs["Object"], sep.inputs["Vector"])
        X, Y, Z = sep.outputs["X"], sep.outputs["Y"], sep.outputs["Z"]
        # Plumes en écailles : chaque plume, sombre au centre, liserée d'un reflet.
        scale = nodes.new("ShaderNodeTexVoronoi")
        scale.inputs["Scale"].default_value = 220.0
        links.new(tc.outputs["Object"], scale.inputs["Vector"])
        edge = smooth(scale.outputs["Distance"], 0.15, 0.45)
        sheen = nodes.new("ShaderNodeTexNoise")
        sheen.inputs["Scale"].default_value = 6.0
        links.new(tc.outputs["Object"], sheen.inputs["Vector"])
        # Reflets : vert sur le dos et les ailes, violet-bleu sur la poitrine et la queue.
        back = smooth(Z, 0.33, 0.45)
        irid = mix(back, (0.025, 0.02, 0.09), (0.0, 0.07, 0.045))
        irid = mix(smooth(sheen.outputs["Fac"], 0.35, 0.65), irid, (0.03, 0.05, 0.11))
        color = mix(math_node("ADD", 0.35, math_node("MULTIPLY", edge, 0.5)), (0.006, 0.007, 0.012), irid)
        # Gorge nue rouge (avant du cou, sous la tête).
        throat = math_node("MULTIPLY", smooth(math_node("SUBTRACT", -0.19, Y), 0.0, 0.03),
                           math_node("MULTIPLY", smooth(Z, 0.46, 0.49), smooth(math_node("SUBTRACT", 0.56, Z), 0.0, 0.02)))
        throat = math_node("MULTIPLY", throat, smooth(math_node("SUBTRACT", 0.03, math_node("ABSOLUTE", X)), 0.0, 0.01), clamp=True)
        color = mix(throat, color, (0.42, 0.03, 0.02))
        # Pattes et bec gris ardoise.
        legs_zone = smooth(math_node("SUBTRACT", 0.15, Z), 0.0, 0.02)
        beak = smooth(math_node("SUBTRACT", -0.30, Y), 0.0, 0.01)
        color = mix(math_node("MAXIMUM", legs_zone, beak), color, (0.06, 0.06, 0.065))
        links.new(color, bsdf.inputs["Base Color"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.4
        bump.inputs["Distance"].default_value = 0.002
        links.new(edge, bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])

    smart_uv(body)
    def down_mask(nt):
        # Duvet velouté de la tête et du cou ; gorge nue et bec sans plumes.
        math_node, smooth, mix = shader_tools(nt)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Object"], sep.inputs["Vector"])
        X, Y, Z = sep.outputs["X"], sep.outputs["Y"], sep.outputs["Z"]
        head_neck = math_node("MULTIPLY", smooth(math_node("SUBTRACT", -0.11, Y), 0.0, 0.03), smooth(Z, 0.40, 0.44))
        throat = math_node("MULTIPLY", smooth(math_node("SUBTRACT", -0.19, Y), 0.0, 0.02),
                           math_node("MULTIPLY", smooth(Z, 0.46, 0.49), smooth(math_node("SUBTRACT", 0.03, math_node("ABSOLUTE", X)), 0.0, 0.01)))
        beak = smooth(math_node("SUBTRACT", -0.30, Y), 0.0, 0.01)
        return math_node("SUBTRACT", head_neck, math_node("MAXIMUM", throat, beak), clamp=True)

    mat = bake_coat(body, plumage, A.texture_size, fur=(down_mask, 0.004, 10))
    b = mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.35  # plumes lustrées
    if "Sheen Weight" in b.inputs:
        b.inputs["Sheen Weight"].default_value = 0.0
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.5  # valeur neutre (pas d'extension glTF)
    # Aigrette : soies blanches devant, noires derrière.
    white = bpy.data.materials.new("Aigrette_blanche")
    white.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.75, 0.73, 0.68, 1)
    black = bpy.data.materials.new("Aigrette_noire")
    black.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.01, 0.01, 0.012, 1)
    parts = [body]
    for i in range(18):
        a = (i / 17 - 0.5) * 1.0
        base = Vector((math.sin(a) * 0.01, -0.266 + 0.0028 * i, 0.616))
        tip = base + Vector((math.sin(a) * 0.016, 0.01 + 0.004 * (i / 17), 0.05 - abs(a) * 0.012))
        parts.append(tusk(f"Paon_soie_{i}", [base, base.lerp(tip, 0.5) + Vector((0, 0.003, 0)), tip], 0.0016, 0.0005, white if i < 10 else black, sides=4))
    parts += eyes("Paon", [(0.035, -0.278, 0.585), (-0.035, -0.278, 0.585)], 0.0075, body=body, lid_color=(0.05, 0.05, 0.06))
    # Plumage en cartes : couvertures du dos et des ailes, contour des flancs
    # et de la poitrine, petites plumes du cou, éventail de la queue.
    fmat = bpy.data.materials.new("Paon_plumes")
    nt = fmat.node_tree
    fb = nt.nodes["Principled BSDF"]
    ft = nt.nodes.new("ShaderNodeTexImage")
    ft.image = feather_atlas()
    nt.links.new(ft.outputs["Color"], fb.inputs["Base Color"])
    rnd_alpha = nt.nodes.new("ShaderNodeMath")
    rnd_alpha.operation = "ROUND"
    nt.links.new(ft.outputs["Alpha"], rnd_alpha.inputs[0])
    nt.links.new(rnd_alpha.outputs[0], fb.inputs["Alpha"])
    fb.inputs["Roughness"].default_value = 0.35
    fmat.surface_render_method = "DITHERED"
    fmat.use_backface_culling = False
    regions = [
        (lambda c, n: c.z > 0.36 and -0.12 < c.y < 0.30 and n.z > 0.0, 1, (0.05, 0.075), 0.013),   # dos, ailes
        (lambda c, n: 0.27 < c.z <= 0.40 and -0.14 < c.y < 0.25 and abs(n.x) > 0.3, 0, (0.035, 0.05), 0.012),  # flancs
        (lambda c, n: c.z > 0.26 and c.y <= -0.12 and c.y > -0.24 and c.z < 0.56 and not (abs(c.x) < 0.035 and c.z > 0.46 and c.y < -0.19), 3, (0.025, 0.035), 0.011),  # cou (hors gorge nue)
    ]
    parts.append(feather_cards("Paon_plumage", body, regions, ((0, 0.22, 0.36), 14, 0.24, 0.07, 1.6), fmat))
    body = join(parts, "Paon")

    bones = [("racine", None, (0, 0.03, 0.33), (0, 0.03, 0.42)),
             ("queue", "racine", (0, 0.15, 0.33), (0, 0.42, 0.30)),
             ("cou1", "racine", neck[0], neck[1]), ("cou2", "cou1", neck[1], neck[2]), ("tete", "cou2", neck[2], (0, -0.345, 0.56))]
    for side, j in legs.items():
        bones += [(f"patte_{side}_1", "racine", j[0], j[1]), (f"patte_{side}_2", f"patte_{side}_1", j[1], j[2])]
    arm = build_armature("Paon_Squelette", bones)
    bind(body, arm)

    def walk(t):
        ph = 2 * math.pi * t
        # Tête qui « pompe » : avance puis se fige à chaque pas (typique des gallinacés).
        bob = math.sin(2 * ph) * 0.18
        return {"patte_g_1": (math.sin(ph) * 0.5, 0, 0), "patte_d_1": (-math.sin(ph) * 0.5, 0, 0),
                "patte_g_2": (-max(0.0, math.cos(ph)) * 0.7, 0, 0), "patte_d_2": (-max(0.0, -math.cos(ph)) * 0.7, 0, 0),
                "cou1": (bob, 0, 0), "cou2": (-bob * 0.6, 0, 0), "tete": (-bob * 0.4, 0, 0),
                "queue": (0.05 * math.sin(2 * ph), 0, 0), "racine": (0, 0, 0.04 * math.sin(ph))}

    def run(t):
        r = walk(t)
        for k in ("patte_g_1", "patte_d_1", "patte_g_2", "patte_d_2"):
            r[k] = tuple(v * 1.5 for v in r[k])
        r["cou1"] = (-0.3, 0, 0)  # cou tendu vers l'avant
        r["queue"] = (-0.2, 0, 0)
        return r

    def idle(t):
        # Picore deux fois, puis observe en tournant la tête.
        ph = 2 * math.pi * t
        peck = max(0.0, math.sin(2 * ph)) if t < 0.5 else 0.0
        look = math.sin(ph * 2) * 0.5 if t >= 0.5 else 0.0
        return {"patte_g_1": (0, 0, 0), "patte_d_1": (0, 0, 0), "patte_g_2": (0, 0, 0), "patte_d_2": (0, 0, 0),
                "cou1": (0.9 * peck, 0, 0), "cou2": (0.6 * peck, 0, 0), "tete": (0.3 * peck, 0, look), "queue": (0, 0, 0), "racine": (0.15 * peck, 0, 0)}

    make_action(arm, "marche", 20, walk)
    make_action(arm, "course", 12, run)
    make_action(arm, "repos", 96, idle)
    return body, arm


BUILDERS = {"okapi": okapi, "elephant": elephant, "paon": paon}


def preview(path, subject):
    """Rendu rapide : l'animal de trois quarts, sur fond de forêt (HDRI)."""
    import glob
    scene = bpy.context.scene
    world = bpy.data.worlds.new("Ciel")
    scene.world = world
    hdri = glob.glob(os.path.join(ROOT, "sources", "polyhaven", "rainforest_trail", "*.hdr"))
    if hdri:
        env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
        env.image = bpy.data.images.load(hdri[0])
        world.node_tree.links.new(env.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
    sun = bpy.data.lights.new("Soleil", "SUN")
    sun.energy = 3.5
    so = bpy.data.objects.new("Soleil", sun)
    so.rotation_euler = (math.radians(50), 0, math.radians(-30))
    scene.collection.objects.link(so)
    bpy.ops.mesh.primitive_plane_add(size=30)
    ground = bpy.context.active_object
    gm = bpy.data.materials.new("Sol")
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.08, 0.06, 0.04, 1)
    leaves = glob.glob(os.path.join(ROOT, "sources", "polyhaven", "leaves_forest_ground", "*_diff_*.jpg"))
    if leaves:
        t = gm.node_tree.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(leaves[0])
        m = gm.node_tree.nodes.new("ShaderNodeMapping")
        m.inputs["Scale"].default_value = (8, 8, 8)
        uv = gm.node_tree.nodes.new("ShaderNodeTexCoord")
        gm.node_tree.links.new(uv.outputs["UV"], m.inputs["Vector"])
        gm.node_tree.links.new(m.outputs["Vector"], t.inputs["Vector"])
        gm.node_tree.links.new(t.outputs["Color"], gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"])
    ground.data.materials.append(gm)
    cam = bpy.data.cameras.new("Camera")
    cam.lens = 50
    co = bpy.data.objects.new("Camera", cam)
    size = max(o.dimensions.z for o in scene.objects if o.type == "MESH")
    k = max(0.25, size / 2.2)
    co.location = (3.9 * k, -5.0 * k, 1.5 * k)
    target = Vector((0, -0.3, 1.05 * k))
    co.rotation_euler = (target - co.location).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(co)
    scene.camera = co
    gpu_cycles(64)
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 1280, 900
    scene.view_settings.view_transform = "AgX"
    scene.render.filepath = os.path.abspath(path)
    # Pose de marche (image 7 de l'action « marche ») pour juger la silhouette.
    arm = subject[1]
    arm.animation_data.action = bpy.data.actions["marche"]
    scene.frame_set(7)
    bpy.ops.render.render(write_still=True)
    print("APERCU", path)


def portrait(path, subject):
    """Gros plan de trois quarts sur la tête, au repos."""
    scene = bpy.context.scene
    arm = subject[1]
    arm.animation_data.action = None
    for track in arm.animation_data.nla_tracks:
        track.mute = True
    for pb in arm.pose.bones:
        pb.rotation_euler = (0, 0, 0)
    head = arm.matrix_world @ arm.data.bones["tete"].head_local
    tail = arm.matrix_world @ arm.data.bones["tete"].tail_local
    size = (tail - head).length
    target = head.lerp(tail, 0.45)
    cam = scene.camera
    scene.frame_set(0)
    bpy.context.view_layer.update()
    size = max(size, 0.06)
    cam.location = target + Vector((size * 2.2, -size * 2.6, size * 0.5))
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
    cam.data.lens = 60
    scene.render.resolution_x, scene.render.resolution_y = 1000, 800
    scene.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    print("PORTRAIT", path)


os.makedirs(A.out_dir, exist_ok=True)
for name in A.only.split(","):
    reset()
    subject = BUILDERS[name]()
    out = os.path.join(os.path.abspath(A.out_dir), f"{name}.glb")
    export(out)
    fur = subject[0].get("fourrure")
    if fur and (A.preview or A.portrait):
        density = 520.0 if name == "okapi" else 1400.0
        fur_shells(subject[0], fur["materiau"], fur["longueur"], fur["couches"], density)
    if A.preview or A.portrait:
        preview(A.preview or os.path.join(A.out_dir, f"{name}.png"), subject)
    if A.portrait:
        portrait(A.portrait.replace("{nom}", name), subject)
