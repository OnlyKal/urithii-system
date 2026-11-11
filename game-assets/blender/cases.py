"""Habitations du village : case ronde, maison rectangulaire, grenier.

  /Applications/Blender.app/Contents/MacOS/Blender -b --python game-assets/blender/cases.py -- \
      --out-dir game-assets/build [--seed 5]

Produit case_ronde.glb, maison.glb et grenier.glb, aux mêmes dimensions que
les modèles stylisés actuels du jeu (web-app/src/games/models/buildings.jsx)
pour pouvoir les remplacer sans toucher au plan du village. La porte fait
face à -Y dans Blender, c'est-à-dire à +Z dans Three.js.

Matériaux : murs en terre (latérite, Poly Haven CC0), chaume photo teinté
paille, bois ; nattes tressées et franges de paille dessinées ici (numpy).
Décor générique : formes et matériaux répandus dans la région, pas la
reproduction de l'architecture d'une communauté précise.
"""

import argparse
import glob
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector, noise

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "sources", "polyhaven")


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out-dir", default=os.path.join(ROOT, "build"))
    p.add_argument("--seed", type=int, default=5)
    p.add_argument("--texture-size", type=int, default=1024)
    return p.parse_args(argv)


A = args()
rng = random.Random(A.seed)
np_rng = np.random.default_rng(A.seed)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


# ================================================================ textures
def image_from_array(name, rgba, alpha=False, non_color=False):
    h, w, _ = rgba.shape
    img = bpy.data.images.new(name, w, h, alpha=alpha)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.ascontiguousarray(np.flipud(rgba), dtype=np.float32).ravel())
    img.pack()
    return img


def load(folder, key, non_color=False, tint=None):
    """Charge une texture Poly Haven ; « tint » multiplie ses couleurs.

    La teinte est cuite dans l'image (et non mise en facteur du matériau) :
    le glTF limite baseColorFactor à 1, or le chaume doit être réchauffé."""
    hits = glob.glob(os.path.join(SRC, folder, f"*_{key}_*.jpg"))
    if not hits:
        return None
    img = bpy.data.images.load(hits[0])
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    if img.size[0] > A.texture_size:
        img.scale(A.texture_size, A.texture_size)
    if tint:
        w, h = img.size
        px = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(px)
        px = px.reshape(h, w, 4)
        px[..., :3] = np.clip(px[..., :3] * np.array(tint, dtype=np.float32), 0, 1)
        out = bpy.data.images.new(f"{folder}_{key}_teinte_{len(bpy.data.images)}", w, h)
        out.pixels.foreach_set(px.ravel())
        img = out
    img.pack()
    return img


def fbm(shape, scale, octaves=4, stretch=(1.0, 1.0)):
    """Bruit fractal tuilable (somme de sinus aux fréquences entières)."""
    h, w = shape
    y, x = np.mgrid[0:h, 0:w]
    u, v = x / w, y / h
    out = np.zeros(shape)
    amp = 1.0
    for o in range(octaves):
        f = scale * 2 ** o
        for _ in range(6):
            kx = round(np_rng.integers(-f, f + 1) * stretch[0])
            ky = round(np_rng.integers(-f, f + 1) * stretch[1])
            out += amp * np.sin(2 * math.pi * (kx * u + ky * v) + np_rng.random() * 2 * math.pi)
        amp *= 0.5
    out -= out.min()
    return out / max(out.max(), 1e-6)


def plaster(img, ochre=(0.66, 0.47, 0.30)):
    """Transforme la latérite en enduit de terre séché : teinte ocre,
    reprises d'enduit, coulures de pluie et fissures fines."""
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    px = px.reshape(h, w, 4)
    rgb = px[..., :3]
    lum = rgb.mean(axis=2, keepdims=True)
    detail = lum / max(float(lum.mean()), 1e-6)          # grain de la photo
    rgb = np.array(ochre) * (0.75 + 0.25 * detail)
    patches = fbm((h, w), 1, 3)[..., None]                # reprises d'enduit
    rgb *= 0.88 + 0.24 * patches
    # Coulures : quelques traînées verticales courtes et irrégulières (pas des
    # bandes régulières, qui feraient penser à des planches).
    streak = np.zeros((h, w))
    for _ in range(26):
        x0, y0 = int(np_rng.random() * w), int(np_rng.random() * h)
        length, width = int(h * (0.08 + 0.2 * np_rng.random())), 2 + int(np_rng.random() * 5)
        for k in range(length):
            x = (x0 + int(3 * math.sin(k * 0.05 + x0))) % w
            streak[(y0 + k) % h, max(0, x - width):x + width] = max(0.0, 1 - k / length)
    rgb *= 1 - 0.12 * streak[..., None]
    blotch = fbm((h, w), 4, 3)[..., None]                 # taches d'humidité
    rgb *= 1 - 0.10 * np.clip((blotch - 0.6) * 4, 0, 1)
    for _ in range(14):                                   # fissures
        x, y = np_rng.random() * w, np_rng.random() * h
        ang = np_rng.random() * math.pi
        for _ in range(int(40 + np_rng.random() * 120)):
            ang += (np_rng.random() - 0.5) * 0.6
            x, y = (x + math.cos(ang) * 1.5) % w, (y + math.sin(ang) * 1.5) % h
            rgb[int(y), int(x)] *= 0.45
    px[..., :3] = np.clip(rgb, 0, 1)
    out = bpy.data.images.new(f"enduit_{len(bpy.data.images)}", w, h)
    out.pixels.foreach_set(px.ravel())
    out.pack()
    return out


def weave_texture(size=512, strips=16):
    """Natte tressée (dessus-dessous) en fibres végétales."""
    y, x = np.mgrid[0:size, 0:size] / size
    u, v = x * strips, y * strips
    iu, iv = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - iu, v - iv
    over = (iu + iv) % 2 == 0  # brin horizontal au-dessus
    shade_h = 0.75 + 0.25 * np.sin(fv * math.pi)
    shade_v = 0.75 + 0.25 * np.sin(fu * math.pi)
    shade = np.where(over, shade_h * (0.85 + 0.15 * np.sin(fu * math.pi)), shade_v * (0.85 + 0.15 * np.sin(fv * math.pi)))
    gap = np.minimum(np.minimum(fu, 1 - fu), np.minimum(fv, 1 - fv))
    shade *= np.clip(gap * 12, 0.35, 1)
    fiber = 0.92 + 0.08 * np.sin((np.where(over, u, v)) * 40 + np_rng.random())
    base = np.array([0.78, 0.62, 0.40])
    var = 0.9 + 0.2 * np_rng.random((strips + 1, strips + 1))[iv % (strips + 1), iu % (strips + 1)]
    rgb = base * (shade * fiber * var)[..., None]
    return image_from_array("natte", np.concatenate([rgb, np.ones((size, size, 1))], axis=2))


def fringe_texture(size=512):
    """Frange de paille : brins verticaux, bas déchiqueté, alpha découpé."""
    img = np.zeros((size, size, 4))
    for _ in range(900):
        x = np_rng.random()
        length = 0.55 + 0.45 * np_rng.random()
        w = 1 + int(np_rng.random() * 2)
        tone = np.array([0.66, 0.52, 0.30]) * (0.65 + 0.5 * np_rng.random())
        x0 = int(x * size)
        y1 = int(length * size)
        drift = (np_rng.random() - 0.5) * 0.06
        for yy in range(0, y1):
            xx = int((x + drift * yy / size) * size) % size
            img[yy, max(0, xx - w):xx + w, :3] = tone * (0.85 + 0.15 * (yy / size))
            img[yy, max(0, xx - w):xx + w, 3] = 1
    return image_from_array("frange_paille", img, alpha=True)


# ================================================================ matériaux
def material(name, color, normal=None, rough=None, roughness=0.9, tint=None, alpha=False):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = color
    out = tex.outputs["Color"]
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        nt.links.new(out, mix.inputs[6])
        mix.inputs[7].default_value = (*tint, 1)
        out = mix.outputs[2]
    nt.links.new(out, bsdf.inputs["Base Color"])
    if normal:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = normal
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if rough:
        r = nt.nodes.new("ShaderNodeTexImage")
        r.image = rough
        nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
    else:
        bsdf.inputs["Roughness"].default_value = roughness
    if alpha:
        rnd = nt.nodes.new("ShaderNodeMath")
        rnd.operation = "ROUND"
        nt.links.new(tex.outputs["Alpha"], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
        m.surface_render_method = "DITHERED"
        m.use_backface_culling = False
    return m


def materials():
    nor = lambda f: load(f, "nor_gl", True)
    rough = lambda f: load(f, "rough", True)
    lat, th, wood = "red_laterite_soil_stones", "thatch_roof_angled", "palm_bark"
    return {
        # Terre de latérite un peu brunie : enduit séché.
        "mur": material("MurTerre", plaster(load(lat, "diff")), nor(lat), rough(lat)),
        # Soubassement : éclaboussures de pluie, plus sombre.
        "socle": material("Soubassement", plaster(load(lat, "diff"), ochre=(0.40, 0.27, 0.18)), nor(lat), rough(lat)),
        # Chaume photo (gris, vieilli) réchauffé vers la paille dorée.
        "chaume": material("Chaume", load(th, "diff", tint=(1.45, 1.05, 0.55)), nor(th), rough(th)),
        "bois": material("Bois", load(wood, "diff", tint=(0.9, 0.75, 0.6)), nor(wood), rough(wood)),
        "natte": material("Natte", weave_texture(), roughness=0.85),
        "frange": material("FrangePaille", fringe_texture(), roughness=0.95, alpha=True),
        "ombre": material("Interieur", load(lat, "diff", tint=(0.12, 0.09, 0.07)), roughness=1.0),
    }


# ================================================================ outils
def mesh_object(name, bm, mat):
    # Normales cohérentes, tournées vers l'extérieur : sinon Three.js
    # (faces arrière masquées) rendrait certaines surfaces invisibles.
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    me.shade_smooth()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def pole(name, a, b, r, mat, sides=8):
    """Perche (cylindre) de a vers b, avec un léger défaut de rectitude."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    a, b = Vector(a), Vector(b)
    axis = (b - a)
    length = axis.length
    d = axis.normalized()
    side = d.cross(Vector((0, 0, 1)))
    side = side.normalized() if side.length > 1e-3 else Vector((1, 0, 0))
    up = d.cross(side)
    rings = max(2, int(length / 0.4) + 1)
    bend = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)) * 0.03 * length
    grid = []
    for i in range(rings):
        t = i / (rings - 1)
        c = a + axis * t + bend * math.sin(t * math.pi)
        rr = r * (1 - 0.15 * t)
        grid.append([bm.verts.new(c + (side * math.cos(k / sides * 2 * math.pi) + up * math.sin(k / sides * 2 * math.pi)) * rr) for k in range(sides)])
    for i in range(rings - 1):
        for k in range(sides):
            f = bm.faces.new((grid[i][k], grid[i][(k + 1) % sides], grid[i + 1][(k + 1) % sides], grid[i + 1][k]))
            for loop, (u, v) in zip(f.loops, ((k, i), (k + 1, i), (k + 1, i + 1), (k, i + 1))):
                loop[uvl].uv = (u / sides * 0.5, v / (rings - 1) * length / 2)
    return mesh_object(name, bm, mat)


def fringe(name, points, height, mat, width=0.42):
    """Franges de paille le long d'un bord de toit (liste de points, fermée ou non)."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    for i in range(len(points) - 1):
        a, b = Vector(points[i]), Vector(points[i + 1])
        steps = max(1, int((b - a).length / width))
        for k in range(steps):
            p0 = a.lerp(b, k / steps)
            p1 = a.lerp(b, (k + 1) / steps)
            out = (p1 - p0).cross(Vector((0, 0, 1))).normalized() * 0.04
            h = height * rng.uniform(0.75, 1.15)
            q = [p0 + out, p1 + out, p1 + out - Vector((0, 0, h)), p0 + out - Vector((0, 0, h))]
            q[2] += Vector((0, 0, rng.uniform(-0.05, 0.05)))
            f = bm.faces.new([bm.verts.new(p) for p in q])
            u0 = rng.random() * 0.5
            for loop, uv in zip(f.loops, ((u0, 1), (u0 + 0.5, 1), (u0 + 0.5, 0), (u0, 0))):
                loop[uvl].uv = uv
    return mesh_object(name, bm, mat)


def export(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_image_format="WEBP", export_apply=True)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print("EXPORT", os.path.basename(path), "triangles", tris)


def roof_cone(name, apex, eave_r, eave_z, mat, segs=48, tiers=3, thickness=0.28, wobble=0.12):
    """Toit conique de chaume en couches : épaisseur, rangs étagés, bord irrégulier."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rows = 14
    eave_noise = [rng.uniform(-wobble, wobble) for _ in range(segs)]
    outer, inner = [], []
    for i in range(rows + 1):
        t = i / rows  # 0 au sommet, 1 au bord
        r = eave_r * t
        z = apex.z + (eave_z - apex.z) * t
        # Rangs étagés : chaque rang de bottes déborde un peu sur le suivant.
        step = 0.09 * ((t * tiers) % 1.0) * (t > 0.08)
        row_o, row_i = [], []
        for k in range(segs):
            th = k / segs * 2 * math.pi
            lump = 0.06 * noise.noise(Vector((math.cos(th) * 3, math.sin(th) * 3, t * 6)))
            rr = r + step + lump * t + (eave_noise[k] * t ** 6)
            zz = z + (eave_noise[(k + 3) % segs] * 0.6 * t ** 6)
            row_o.append(bm.verts.new((apex.x + math.cos(th) * rr, apex.y + math.sin(th) * rr, zz)))
            ri = max(0.0, rr - thickness * 0.4)
            row_i.append(bm.verts.new((apex.x + math.cos(th) * ri, apex.y + math.sin(th) * ri, zz - thickness)))
        outer.append(row_o)
        inner.append(row_i)
    slant = math.hypot(eave_r, apex.z - eave_z)
    for i in range(rows):
        for k in range(segs):
            k1 = (k + 1) % segs
            for grid, flip in ((outer, False), (inner, True)):
                vs = [grid[i][k], grid[i][k1], grid[i + 1][k1], grid[i + 1][k]]
                f = bm.faces.new(vs[::-1] if not flip else vs)
                uvs = [(k / segs * 8, (1 - i / rows) * slant / 2), ((k + 1) / segs * 8, (1 - i / rows) * slant / 2),
                       ((k + 1) / segs * 8, (1 - (i + 1) / rows) * slant / 2), (k / segs * 8, (1 - (i + 1) / rows) * slant / 2)]
                for loop, uv in zip(f.loops, uvs[::-1] if not flip else uvs):
                    loop[uvl].uv = uv
    # Tranche du bord (épaisseur visible).
    for k in range(segs):
        k1 = (k + 1) % segs
        f = bm.faces.new((outer[rows][k], outer[rows][k1], inner[rows][k1], inner[rows][k]))
        for loop, uv in zip(f.loops, ((k / segs * 8, 0), ((k + 1) / segs * 8, 0), ((k + 1) / segs * 8, 0.15), (k / segs * 8, 0.15))):
            loop[uvl].uv = uv
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    obj = mesh_object(name, bm, mat)
    rim = []
    for k in range(segs + 1):
        th = (k % segs) / segs * 2 * math.pi
        rr = eave_r + eave_noise[k % segs] + 0.05
        rim.append((apex.x + math.cos(th) * rr, apex.y + math.sin(th) * rr, eave_z + eave_noise[(k + 3) % segs] * 0.6 - 0.02))
    return obj, rim


def wall_ring(name, radius, height, mat, door_half_angle, door_h, thickness=0.25, segs=72, base=0.0):
    """Mur circulaire en terre avec une ouverture de porte face à -Y."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    door_c = -math.pi / 2
    zs = sorted({base, door_h, height} | {base + (height - base) * i / 6 for i in range(7)})
    def in_door(th, z0, z1):
        d = math.atan2(math.sin(th - door_c), math.cos(th - door_c))
        return abs(d) < door_half_angle - 1e-6 and z1 <= door_h + 1e-6
    rad = []
    for k in range(segs):
        th = k / segs * 2 * math.pi
        rad.append(radius + 0.05 * noise.noise(Vector((math.cos(th) * 2, math.sin(th) * 2, 0.5))))
    def vert(k, z, inner):
        th = k / segs * 2 * math.pi
        lean = -0.05 * (z / height)  # mur légèrement fruité
        r = rad[k % segs] + lean - (thickness if inner else 0)
        bulge = 0.03 * math.sin(z / height * math.pi)
        return Vector((math.cos(th) * (r + bulge), math.sin(th) * (r + bulge), z))
    cache = {}
    def V(k, j, inner):
        key = (k % segs, j, inner)
        if key not in cache:
            cache[key] = bm.verts.new(vert(k, zs[j], inner))
        return cache[key]
    for j in range(len(zs) - 1):
        for k in range(segs):
            th_mid = (k + 0.5) / segs * 2 * math.pi
            if in_door(th_mid, zs[j], zs[j + 1]):
                continue
            for inner in (False, True):
                vs = [V(k, j, inner), V(k + 1, j, inner), V(k + 1, j + 1, inner), V(k, j + 1, inner)]
                f = bm.faces.new(vs[::-1] if inner else vs)
                uvs = [(k * radius * 2 * math.pi / segs / 2, zs[j] / 2), ((k + 1) * radius * 2 * math.pi / segs / 2, zs[j] / 2),
                       ((k + 1) * radius * 2 * math.pi / segs / 2, zs[j + 1] / 2), (k * radius * 2 * math.pi / segs / 2, zs[j + 1] / 2)]
                for loop, uv in zip(f.loops, uvs[::-1] if inner else uvs):
                    loop[uvl].uv = uv
    # Dessus du mur.
    top = len(zs) - 1
    full = door_h >= height - 1e-6  # ouverture sur toute la hauteur (socle)
    for k in range(segs):
        if full and in_door((k + 0.5) / segs * 2 * math.pi, 0, door_h):
            continue
        f = bm.faces.new((V(k, top, False), V(k + 1, top, False), V(k + 1, top, True), V(k, top, True)))
        for loop in f.loops:
            loop[uvl].uv = (loop.vert.co.x / 2, loop.vert.co.y / 2)
    # Tableaux de la porte (épaisseur du mur).
    jd = [k for k in range(segs) if in_door((k + 0.5) / segs * 2 * math.pi, 0, door_h)]
    left, right = min(jd), max(jd) + 1
    jtop = zs.index(door_h)
    for j in range(jtop):
        for k in (left, right):
            vs = [V(k, j, False), V(k, j, True), V(k, j + 1, True), V(k, j + 1, False)]
            bm.faces.new(vs if k == left else vs[::-1])
    if not full:
        for k in range(left, right):
            bm.faces.new((V(k, jtop, False), V(k + 1, jtop, False), V(k + 1, jtop, True), V(k, jtop, True)))
    obj = mesh_object(name, bm, mat)
    th_l, th_r = left / segs * 2 * math.pi, right / segs * 2 * math.pi
    return obj, (th_l, th_r)


# ============================================================ case ronde
def case_ronde(M):
    R, H = 3.0, 2.4
    door_w, door_h = 1.0, 1.9
    wall, (th_l, th_r) = wall_ring("Case_Mur", R, H, M["mur"], door_w / 2 / R, door_h)
    socle, _ = wall_ring("Case_Socle", R + 0.035, 0.42, M["socle"], door_w / 2 / R, 0.42, thickness=0.30)
    # Sol intérieur sombre (l'intérieur reste dans la pénombre).
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=24, radius=R - 0.2)
    mesh_object("Case_SolInterieur", bm, M["ombre"]).location.z = 0.02
    # Encadrement de porte en perches.
    for th in (th_l, th_r):
        x, y = math.cos(th) * (R + 0.02), math.sin(th) * (R + 0.02)
        pole("Case_Montant", (x, y, -0.05), (x, y, door_h + 0.15), 0.06, M["bois"])
    xl, yl = math.cos(th_l) * (R + 0.04), math.sin(th_l) * (R + 0.04)
    xr, yr = math.cos(th_r) * (R + 0.04), math.sin(th_r) * (R + 0.04)
    pole("Case_Linteau", (xl - 0.15, yl, door_h + 0.05), (xr + 0.15, yr, door_h + 0.05), 0.065, M["bois"])
    # Porte : natte tressée sur cadre, accrochée au montant droit et
    # entrouverte vers l'extérieur (bien visible, intérieur dans la pénombre).
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    w, h = door_w * 0.95, door_h * 0.97
    open_a = math.radians(35)
    hinge = Vector((xr, yr - 0.06, 0.03))
    dirv = Vector((math.cos(math.pi + open_a), math.sin(math.pi + open_a), 0))
    q = [hinge, hinge + dirv * w, hinge + dirv * w + Vector((0, 0, h)), hinge + Vector((0, 0, h))]
    f = bm.faces.new([bm.verts.new(p) for p in q])
    for loop, uv in zip(f.loops, ((0, 0), (1.5, 0), (1.5, 3), (0, 3))):
        loop[uvl].uv = uv
    door = mesh_object("Case_Porte", bm, M["natte"])
    door.data.materials[0].use_backface_culling = False
    # Cadre de la natte : deux traverses.
    for z in (0.25, h - 0.2):
        pole("Case_PorteTraverse", tuple(hinge + Vector((0, 0, z)) - dirv * 0.02), tuple(hinge + dirv * w + Vector((0, 0, z))), 0.03, M["bois"], sides=5)
    # Seuil : dalle de pierre plate devant la porte.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -R - 0.45, 0.04))
    step = bpy.context.active_object
    step.name = "Case_Seuil"
    step.scale = (1.3, 0.6, 0.12)
    step.rotation_euler.z = math.radians(rng.uniform(-6, 6))
    step.data.materials.append(M["socle"])
    cube_uv(step, 1.0)
    # Toit : chevrons apparents sous l'avancée, chaume étagé, frange, faîte.
    apex = Vector((0, 0, 5.45))
    eave_r, eave_z = 3.95, 2.12
    for k in range(18):
        th = k / 18 * 2 * math.pi
        pole("Case_Chevron", (math.cos(th) * (eave_r - 0.15), math.sin(th) * (eave_r - 0.15), eave_z - 0.18),
             (math.cos(th) * 0.3, math.sin(th) * 0.3, apex.z - 0.55), 0.045, M["bois"], sides=6)
    roof, rim = roof_cone("Case_Toit", apex, eave_r, eave_z, M["chaume"])
    fringe("Case_Frange", rim, 0.42, M["frange"])
    # Couronnement : botte liée et pointe.
    roof2, _ = roof_cone("Case_Faite", Vector((0, 0, 5.85)), 0.55, 5.15, M["chaume"], segs=16, tiers=1, thickness=0.12, wobble=0.04)
    pole("Case_Pointe", (0, 0, 5.6), (0, 0, 6.25), 0.05, M["bois"], sides=6)
    return R


# ======================================================= maison rectangulaire
def box_shell(name, sx, sy, h, t, mat):
    bpy.ops.mesh.primitive_cube_add(size=1)
    o = bpy.context.active_object
    o.name = name
    o.scale = (sx, sy, h)
    o.location.z = h / 2
    bpy.ops.object.transform_apply(scale=True, location=False)
    bm = bmesh.new()
    bm.from_mesh(o.data)
    for f in [f for f in bm.faces if abs(f.normal.z) > 0.9]:
        bm.faces.remove(f)
    bm.to_mesh(o.data)
    bm.free()
    mod = o.modifiers.new("Epaisseur", "SOLIDIFY")
    mod.thickness = t
    mod.offset = -1
    o.data.materials.append(mat)
    return o


def cut(obj, loc, size):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    c = bpy.context.active_object
    c.scale = size
    mod = obj.modifiers.new("Ouverture", "BOOLEAN")
    mod.object = c
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    bpy.context.view_layer.objects.active = obj
    for m in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.data.objects.remove(c)


def cube_uv(obj, size=2.0):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")


def roof_plane(name, a, b, c, d, mat, thickness=0.28, nu=24, nv=8, ragged=0.1):
    """Pan de toit de chaume : a-b faîtage, d-c égout (bord bas déchiqueté)."""
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    a, b, c, d = map(Vector, (a, b, c, d))
    normal = (b - a).cross(d - a).normalized()
    if normal.z < 0:
        normal = -normal
    eave_off = [rng.uniform(-ragged, ragged) for _ in range(nu + 1)]
    top, bot = [], []
    for j in range(nv + 1):
        t = j / nv
        rt, rb = [], []
        for i in range(nu + 1):
            s = i / nu
            p = a.lerp(b, s).lerp(d.lerp(c, s), t)
            step = 0.08 * ((t * 4) % 1.0)
            lump = 0.05 * noise.noise(p * 1.3)
            down = (d - a).normalized()
            p = p + normal * (step + lump) + down * (eave_off[i] * t ** 6)
            rt.append(bm.verts.new(p))
            rb.append(bm.verts.new(p - normal * thickness))
        top.append(rt)
        bot.append(rb)
    slope = (d - a).length
    span = (b - a).length
    for j in range(nv):
        for i in range(nu):
            for grid, flip in ((top, False), (bot, True)):
                vs = [grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]]
                f = bm.faces.new(vs[::-1] if flip else vs)
                for loop in f.loops:
                    for jj, row in enumerate(grid):
                        if loop.vert in row:
                            ii = row.index(loop.vert)
                            loop[uvl].uv = (ii / nu * span / 2, (1 - jj / nv) * slope / 2)
                            break
    for i in range(nu):
        bm.faces.new((top[nv][i], top[nv][i + 1], bot[nv][i + 1], bot[nv][i]))
    obj = mesh_object(name, bm, mat)
    edge = [a.lerp(b, i / nu).lerp(d.lerp(c, i / nu), 1.0) + (d - a).normalized() * eave_off[i] for i in range(nu + 1)]
    return obj, [tuple(p) for p in edge]


def maison(M):
    L, W, H = 6.0, 4.4, 2.6
    walls = box_shell("Maison_Murs", L, W, H, 0.25, M["mur"])
    bpy.context.view_layer.objects.active = walls
    bpy.ops.object.modifier_apply(modifier="Epaisseur")
    cut(walls, (0, -W / 2, 1.0), (1.1, 0.8, 2.0))           # porte
    for x in (-1.9, 1.9):
        cut(walls, (x, -W / 2, 1.5), (0.8, 0.8, 0.7))       # fenêtres
    cube_uv(walls)
    walls.data.shade_flat()
    # Pignons triangulaires aux extrémités (faîtage le long de X).
    ridge_z = H + 2.1
    for sx in (-1, 1):
        bm = bmesh.new()
        uvl = bm.loops.layers.uv.new("UVMap")
        x = sx * L / 2
        pts = [(x, -W / 2, H), (x, W / 2, H), (x, 0, ridge_z)]
        for off in (0, -sx * 0.25):
            f = bm.faces.new([bm.verts.new((p[0] + off, p[1], p[2])) for p in (pts if (off == 0) == (sx > 0) else pts[::-1])])
            for loop in f.loops:
                loop[uvl].uv = (loop.vert.co.y / 2, loop.vert.co.z / 2)
        mesh_object("Maison_Pignon", bm, M["mur"])
    # Socle sombre.
    s = box_shell("Maison_Socle", L + 0.07, W + 0.07, 0.42, 0.3, M["socle"])
    bpy.context.view_layer.objects.active = s
    bpy.ops.object.modifier_apply(modifier="Epaisseur")
    cut(s, (0, -W / 2, 0.3), (1.1, 0.9, 1.0))
    cube_uv(s)
    # Porte en planches et volets entrouverts.
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.42, -W / 2 - 0.35, 1.0))
    door = bpy.context.active_object
    door.name = "Maison_Porte"
    door.scale = (0.06, 1.0, 1.95)
    door.rotation_euler.z = math.radians(-35)
    door.data.materials.append(M["bois"])
    cube_uv(door, 1.0)
    for x in (-1.9, 1.9):
        for side in (-1, 1):
            bpy.ops.mesh.primitive_cube_add(size=1, location=(x + side * 0.6, -W / 2 - 0.12, 1.5))
            v = bpy.context.active_object
            v.name = "Maison_Volet"
            v.scale = (0.4, 0.05, 0.7)
            v.rotation_euler.z = side * math.radians(rng.uniform(10, 25))
            v.data.materials.append(M["bois"])
            cube_uv(v, 1.0)
    # Poteaux d'angle apparents.
    for x in (-L / 2, L / 2):
        for y in (-W / 2, W / 2):
            pole("Maison_Poteau", (x, y, -0.05), (x, y, H + 0.1), 0.08, M["bois"])
    # Toit à deux pans avec débord, faîtage en botte, franges.
    over = 0.8
    rims = []
    for sy in (-1, 1):
        a = (-L / 2 - over, 0, ridge_z + 0.25)
        b = (L / 2 + over, 0, ridge_z + 0.25)
        drop = (W / 2 + over) / (W / 2) * (ridge_z - H)
        c = (L / 2 + over, sy * (W / 2 + over), ridge_z + 0.25 - drop - 0.05)
        d = (-L / 2 - over, sy * (W / 2 + over), ridge_z + 0.25 - drop - 0.05)
        _, rim = roof_plane(f"Maison_Pan", a, b, c, d, M["chaume"])
        rims.append(rim)
    for rim in rims:
        fringe("Maison_Frange", rim, 0.38, M["frange"])
    pole("Maison_Faitage", (-L / 2 - over - 0.1, 0, ridge_z + 0.42), (L / 2 + over + 0.1, 0, ridge_z + 0.42), 0.22, M["chaume"], sides=10)
    # Sol intérieur sombre.
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, 0, 0.03))
    fl = bpy.context.active_object
    fl.scale = (L - 0.5, W - 0.5, 1)
    fl.data.materials.append(M["ombre"])


# ================================================================ grenier
def grenier(M):
    for x, y in ((-0.7, -0.7), (0.7, -0.7), (-0.7, 0.7), (0.7, 0.7)):
        pole("Grenier_Pilotis", (x, y, -0.1), (x + rng.uniform(-0.05, 0.05), y, 1.25), 0.1, M["bois"])
    for i in range(11):  # plancher de rondins
        y = -1.15 + i * 0.23
        half = math.sqrt(max(0.0, 1.3 ** 2 - y ** 2))
        pole("Grenier_Rondin", (-half, y, 1.28), (half, y, 1.28), 0.075, M["bois"], sides=6)
    # Corps en vannerie, légèrement renflé.
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    segs, rows = 32, 8
    grid = []
    for j in range(rows + 1):
        t = j / rows
        z = 1.35 + 1.5 * t
        r = 0.95 + 0.1 * math.sin(t * math.pi) + 0.02 * (1 - t)
        grid.append([bm.verts.new((math.cos(k / segs * 2 * math.pi) * r, math.sin(k / segs * 2 * math.pi) * r, z)) for k in range(segs)])
    for j in range(rows):
        for k in range(segs):
            f = bm.faces.new((grid[j][k], grid[j][(k + 1) % segs], grid[j + 1][(k + 1) % segs], grid[j + 1][k]))
            for loop, (u, v) in zip(f.loops, ((k, j), (k + 1, j), (k + 1, j + 1), (k, j + 1))):
                loop[uvl].uv = (u / segs * 4, v / rows * 1.0)
    mesh_object("Grenier_Corps", bm, M["natte"])
    _, rim = roof_cone("Grenier_Toit", Vector((0, 0, 4.25)), 1.65, 2.75, M["chaume"], segs=32, tiers=2, thickness=0.2, wobble=0.08)
    fringe("Grenier_Frange", rim, 0.32, M["frange"], width=0.32)
    pole("Grenier_Pointe", (0, 0, 4.1), (0, 0, 4.6), 0.04, M["bois"], sides=6)


# ================================================================ génération
os.makedirs(A.out_dir, exist_ok=True)
for name, build in (("case_ronde", case_ronde), ("maison", maison), ("grenier", grenier)):
    reset()
    M = materials()
    build(M)
    export(os.path.join(os.path.abspath(A.out_dir), f"{name}.glb"))
