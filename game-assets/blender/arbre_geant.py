"""Arbre géant de la forêt de l'Ituri (type limbali), généré par script.

Lancement (sans interface) :
  /Applications/Blender.app/Contents/MacOS/Blender -b --python game-assets/blender/arbre_geant.py -- \
      --out game-assets/build/arbre_geant.glb --seed 7 \
      --bark game-assets/sources/polyhaven/tree_bark_03

Produit un modèle glTF (.glb) prêt pour Three.js :
  - tronc massif à contreforts (racines-planches en ailes) ;
  - charpente de branches sur trois niveaux ;
  - houppier en rameaux de feuilles composées (cartes à transparence découpée) ;
  - lianes : boucles pendantes entre les branches et lianes qui s'enroulent
    autour du tronc.
Écorce : textures photo Poly Haven (CC0) si --bark est fourni, sinon une
écorce générée. Le feuillage est dessiné ici (numpy).
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
from mathutils import Matrix, Vector, noise


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default="game-assets/build/arbre_geant.glb")
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--height", type=float, default=38.0)
    p.add_argument("--bark", default="", help="dossier d'une texture d'écorce Poly Haven")
    p.add_argument("--texture-size", type=int, default=1024)
    p.add_argument("--epiphyte", default="", help="modèle glTF de fougère (Poly Haven) posé sur les branches")
    return p.parse_args(argv)


A = args()
rng = random.Random(A.seed)
np_rng = np.random.default_rng(A.seed)
noise.seed_set(A.seed) if hasattr(noise, "seed_set") else None

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def link(obj):
    scene.collection.objects.link(obj)
    return obj


# =============================================================== textures
def image_from_array(name, rgba, alpha=False, non_color=False):
    h, w, _ = rgba.shape
    img = bpy.data.images.new(name, w, h, alpha=alpha)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.ascontiguousarray(np.flipud(rgba), dtype=np.float32).ravel())
    img.pack()
    return img


def load_image(path, non_color=False, size=None):
    img = bpy.data.images.load(path)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    if size and img.size[0] > size:
        img.scale(size, size)
    img.pack()
    return img


def fbm(shape, scale, octaves=5, stretch=(1.0, 1.0)):
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
    return out / out.max()


def generated_bark(size=1024):
    fib = fbm((size, size), 2, 6, stretch=(5.0, 0.5))
    big = fbm((size, size), 1, 3)
    crev = np.clip((fib - 0.3) * 2.0, 0, 1) ** 1.3
    base = np.array([0.24, 0.19, 0.14]) * (0.45 + 0.55 * crev[..., None]) * (0.85 + 0.3 * big[..., None])
    color = np.concatenate([base, np.ones((size, size, 1))], axis=2)
    gy, gx = np.gradient(crev)
    n = np.stack([-gx * 5, -gy * 5, np.ones_like(crev)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    normal = np.concatenate([n * 0.5 + 0.5, np.ones((size, size, 1))], axis=2)
    return image_from_array("ecorce_couleur", color), image_from_array("ecorce_normale", normal, non_color=True), None


def bark_images():
    if A.bark and os.path.isdir(A.bark):
        pick = lambda key: (glob.glob(os.path.join(A.bark, f"*_{key}_*.jpg")) or [None])[0]
        diff, nor, rough = pick("diff"), pick("nor_gl"), pick("rough")
        if diff and nor:
            s = A.texture_size
            return load_image(diff, size=s), load_image(nor, True, s), load_image(rough, True, s) if rough else None
    print("Écorce photo absente : écorce générée.")
    return generated_bark(A.texture_size)


def draw_leaflet(img, cx, cy, ang, L, W, tint):
    """Foliole elliptique pointue, avec nervure centrale et bord adouci."""
    size = img.shape[0]
    r = int((L + W) * size) + 2
    x0, x1 = max(0, int(cx * size) - r), min(size, int(cx * size) + r)
    y0, y1 = max(0, int(cy * size) - r), min(size, int(cy * size) + r)
    if x0 >= x1 or y0 >= y1:
        return
    y, x = np.mgrid[y0:y1, x0:x1] / size
    dx, dy = x - cx, y - cy
    u = dx * math.cos(ang) + dy * math.sin(ang)
    v = -dx * math.sin(ang) + dy * math.cos(ang)
    t = np.clip(u / L, -1, 1)
    half = W * np.sqrt(np.clip(1 - t ** 2, 0, 1)) * (1 - 0.35 * t)  # plus large côté pétiole
    d = np.abs(v) - half
    inside = (d < 0) & (np.abs(u) < L)
    edge = np.clip(-d * size / 1.5, 0, 1)
    vein = 1 - 0.35 * np.exp(-(v / (W * 0.08)) ** 2)
    light = 0.82 + 0.18 * (v / max(W, 1e-6))  # face éclairée / ombrée
    rgb = tint[None, None, :] * (vein * light)[..., None]
    a = np.where(inside, edge, 0)
    sub = img[y0:y1, x0:x1]
    sub[..., :3] = sub[..., :3] * (1 - a[..., None]) + rgb * a[..., None]
    sub[..., 3] = np.maximum(sub[..., 3], a)


def draw_stem(img, p0, p1, width, color):
    size = img.shape[0]
    n = int(np.hypot(*(np.subtract(p1, p0))) * size * 2) + 2
    for k in range(n):
        t = k / (n - 1)
        x, y = (p0[0] + (p1[0] - p0[0]) * t) * size, (p0[1] + (p1[1] - p0[1]) * t) * size
        w = max(1, int(width * size * (1 - 0.6 * t)))
        img[max(0, int(y) - w):int(y) + w, max(0, int(x) - w):int(x) + w, :3] = color
        img[max(0, int(y) - w):int(y) + w, max(0, int(x) - w):int(x) + w, 3] = 1


def foliage_atlas(size=1024):
    """Planche 2 × 2 de rameaux : feuilles composées pennées (folioles opposées)."""
    img = np.zeros((size, size, 4))
    # Valeurs sRGB calées sur les feuilles photographiées des plantes Poly Haven
    # (une feuille éclairée de forêt humide est rarement en dessous de 0,35 en vert).
    greens = [np.array(c) for c in ([0.18, 0.36, 0.08], [0.22, 0.42, 0.10], [0.27, 0.46, 0.12], [0.32, 0.50, 0.14])]
    # Une teinte dominante par quadrant : rameaux adultes, ombragés, au soleil
    # et jeunes pousses (le limbali a des jeunes feuilles pendantes rosées).
    shades = [1.0, 0.8, 1.15, None]
    for q in range(4):
        ox, oy = (q % 2) * 0.5, (q // 2) * 0.5
        base = (ox + 0.25, oy + 0.48)
        palette = [np.clip(g * shades[q], 0, 1) for g in greens] if shades[q] else [np.array([0.58, 0.36, 0.28]), np.array([0.52, 0.44, 0.26])]
        for leaf in range(rng.randint(6, 8)):
            ang = -math.pi / 2 + rng.uniform(-1.0, 1.0)
            length = rng.uniform(0.16, 0.22)
            end = (base[0] + math.cos(ang) * length, base[1] + math.sin(ang) * length)
            draw_stem(img, base, end, 0.0018, np.array([0.12, 0.10, 0.05]))
            pairs = rng.randint(4, 6)
            for k in range(pairs):
                t = 0.25 + 0.75 * k / pairs
                px, py = base[0] + (end[0] - base[0]) * t, base[1] + (end[1] - base[1]) * t
                L, W = rng.uniform(0.022, 0.032), rng.uniform(0.007, 0.011)
                for side in (-1, 1):
                    a = ang + side * rng.uniform(0.7, 1.0)
                    cx, cy = px + math.cos(a) * L * 0.95, py + math.sin(a) * L * 0.95
                    tint = rng.choice(palette) * rng.uniform(0.8, 1.2)
                    draw_leaflet(img, cx, cy, a, L, W, tint)
            draw_leaflet(img, end[0], end[1], ang, 0.026, 0.009, rng.choice(palette))
    return image_from_array("feuillage", img, alpha=True)


bark_col, bark_nor, bark_rough = bark_images()
leaf_img = foliage_atlas(max(2048, A.texture_size))  # folioles fines : il faut de la définition


def make_material(name, color_img, normal_img=None, rough_img=None, roughness=0.9, alpha_clip=False, tint=None):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = color_img
    if tint:
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        # Les entrées du nœud Mix existent en plusieurs types : on prend celles
        # de type couleur (A = 6, B = 7, sortie = 2).
        mix.inputs[0].default_value = 1.0
        nt.links.new(tex.outputs["Color"], mix.inputs[6])
        mix.inputs[7].default_value = (*tint, 1)
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    else:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if normal_img:
        nor = nt.nodes.new("ShaderNodeTexImage")
        nor.image = normal_img
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nor.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    if rough_img:
        r = nt.nodes.new("ShaderNodeTexImage")
        r.image = rough_img
        nt.links.new(r.outputs["Color"], bsdf.inputs["Roughness"])
    else:
        bsdf.inputs["Roughness"].default_value = roughness
    if alpha_clip:
        # Arrondi de l'alpha : exporté en alphaMode MASK (découpe nette).
        rnd = nt.nodes.new("ShaderNodeMath")
        rnd.operation = "ROUND"
        nt.links.new(tex.outputs["Alpha"], rnd.inputs[0])
        nt.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
        m.surface_render_method = "DITHERED"
        m.use_backface_culling = False
    return m


BARK = make_material("Ecorce", bark_col, bark_nor, bark_rough, tint=(0.8, 0.72, 0.62))
LIANA = make_material("Liane", bark_col, bark_nor, bark_rough, tint=(0.75, 0.62, 0.45))
LEAVES = make_material("Feuillage", leaf_img, roughness=0.5, alpha_clip=True)

# ================================================================== tronc
H = A.height
CROWN = H * 0.62  # hauteur de la fourche principale
RINGS, SIDES = 90, 96
FINS = []
for i in range(6):
    FINS.append({
        "phi": i * 2 * math.pi / 6 + rng.uniform(-0.3, 0.3),
        "reach": rng.uniform(2.6, 4.2),     # avancée de l'aile au sol (m)
        "height": rng.uniform(0.13, 0.2),   # hauteur relative où l'aile disparaît
        "width": rng.uniform(0.07, 0.11),   # épaisseur angulaire
        "twist": rng.uniform(-0.25, 0.25),  # l'aile serpente avec la hauteur
    })


def radius_at(t, theta):
    r = 1.55 * (1 - 0.5 * t) ** 1.2 + 0.25
    extra = 0.0
    for f in FINS:
        k = max(0.0, 1 - t / f["height"])
        if k <= 0:
            continue
        phi = f["phi"] + f["twist"] * (1 - k)
        d = math.atan2(math.sin(theta - phi), math.cos(theta - phi))
        # Aile mince : profil concave (courbe en planche) vers le sol.
        extra = max(extra, f["reach"] * k ** 2.4 * math.exp(-(d / (f["width"] * (0.6 + 0.8 * k))) ** 2))
    return r + extra


def trunk_offset(t):
    return Vector((math.sin(t * 2.3 + 0.5) * 0.9 * t, math.cos(t * 1.9) * 0.6 * t, 0))


bm = bmesh.new()
uvl = bm.loops.layers.uv.new("UVMap")
grid, heights = [], []
for i in range(RINGS + 1):
    t = (i / RINGS) ** 1.7  # anneaux resserrés vers le sol, où la forme est complexe
    z = t * CROWN - 0.6
    row = []
    for j in range(SIDES):
        th = j / SIDES * 2 * math.pi
        r = radius_at(t, th)
        p = Vector((math.cos(th) * r, math.sin(th) * r, z)) + trunk_offset(t)
        p += noise.noise_vector(Vector((p.x * 0.35, p.y * 0.35, z * 0.12))) * (0.18 + 0.25 * (1 - t))
        row.append(bm.verts.new(p))
    grid.append(row)
    heights.append(z)
for i in range(RINGS):
    for j in range(SIDES):
        a, b = grid[i][j], grid[i][(j + 1) % SIDES]
        c, d = grid[i + 1][(j + 1) % SIDES], grid[i + 1][j]
        f = bm.faces.new((a, b, c, d))
        # UV : environ 1 répétition de texture pour 2 m, en largeur comme en hauteur.
        for loop, (u, v) in zip(f.loops, [(j, i), (j + 1, i), (j + 1, i + 1), (j, i + 1)]):
            loop[uvl].uv = (u / SIDES * 5.0, (heights[v] + 0.6) / 2.0)
mesh = bpy.data.meshes.new("Tronc")
bm.to_mesh(mesh)
bm.free()
mesh.materials.append(BARK)
mesh.shade_smooth()
trunk = link(bpy.data.objects.new("Tronc", mesh))
crown_base = sum((v.co for v in mesh.vertices[-SIDES:]), Vector()) / SIDES

# ================================================================ branches
branch_paths = []  # (points, rayon de départ, niveau)
tips = []


def grow(start, direction, length, radius, depth):
    n = 10 if depth == 0 else 7
    d = direction.normalized()
    p = start.copy()
    pts = [p.copy()]
    for k in range(1, n + 1):
        wobble = noise.noise_vector(p * 0.15 + Vector((depth * 3.1, k * 0.7, 0)))
        d = (d + wobble * 0.35 + Vector((0, 0, 0.06 if depth else 0.02))).normalized()
        p = p + d * (length / n)
        pts.append(p.copy())
    branch_paths.append((pts, radius, depth))
    if depth < 3:
        children = {0: rng.randint(3, 4), 1: rng.randint(2, 3), 2: rng.randint(2, 3)}[depth]
        for c in range(children):
            k = rng.randint(n // 2, n)
            side = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), rng.uniform(0.0, 0.6)))
            nd = (d * 0.6 + side).normalized()
            grow(pts[k], nd, length * rng.uniform(0.5, 0.68), radius * rng.uniform(0.45, 0.6), depth + 1)
    else:
        tips.append((p, d))


def trunk_surface(t, theta):
    """Point à la surface du tronc (hauteur relative t, angle theta)."""
    r = radius_at(t, theta) * 0.85
    return Vector((math.cos(theta) * r, math.sin(theta) * r, t * CROWN - 0.6)) + trunk_offset(t)


# Couronne irrégulière : maîtresses branches à des hauteurs différentes
# (certaines partent bas sur le fût), plus longues du côté de la lumière,
# inclinaisons variées. Pas de symétrie : c'est elle qui donnait l'effet
# « parasol ».
light = rng.uniform(0, 2 * math.pi)  # direction de la trouée de lumière
limbs = rng.randint(7, 9)
for i in range(limbs):
    ang = i / limbs * 2 * math.pi + rng.uniform(-0.35, 0.35)
    toward_light = 0.5 + 0.5 * math.cos(ang - light)
    low = i < 2  # deux branches basses, plus horizontales
    t = rng.uniform(0.62, 0.75) if low else rng.uniform(0.85, 1.0)
    rise = rng.uniform(0.15, 0.4) if low else rng.uniform(0.35, 1.2)
    d = Vector((math.cos(ang), math.sin(ang), rise))
    length = (rng.uniform(7, 10) if low else rng.uniform(9, 13)) * (0.8 + 0.5 * toward_light)
    radius = rng.uniform(0.35, 0.5) if low else rng.uniform(0.5, 0.75)
    grow(trunk_surface(t, ang), d, length, radius, 0)

# Deux moignons de branches mortes : détail qui casse la régularité.
for _ in range(2):
    ang = rng.uniform(0, 2 * math.pi)
    p0 = trunk_surface(rng.uniform(0.35, 0.6), ang)
    d = Vector((math.cos(ang), math.sin(ang), rng.uniform(-0.1, 0.3))).normalized()
    branch_paths.append(([p0, p0 + d * 0.8, p0 + d * 1.6 + Vector((0, 0, 0.1))], rng.uniform(0.18, 0.25), 3))


def tube_curve(name, paths, material, sides_res=2):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = 1.0
    cu.bevel_resolution = sides_res
    cu.resolution_u = 3
    cu.use_fill_caps = True
    for pts, r0, taper in paths:
        sp = cu.splines.new("NURBS")
        sp.points.add(len(pts) - 1)
        for k, p in enumerate(pts):
            sp.points[k].co = (*p, 1)
            sp.points[k].radius = r0 * (1 - taper * k / (len(pts) - 1))
        sp.use_endpoint_u = True
        sp.order_u = 3
    cu.materials.append(material)
    return link(bpy.data.objects.new(name, cu))


branches = tube_curve("Branches", [(p, r, 0.65) for p, r, _ in branch_paths], BARK)

# ================================================================ houppier
bm = bmesh.new()
uvl = bm.loops.layers.uv.new("UVMap")
quads = [((0, 0.5), (0.5, 1)), ((0.5, 0.5), (1, 1)), ((0, 0), (0.5, 0.5)), ((0.5, 0), (1, 0.5))]
def random_unit():
    v = Vector((rng.gauss(0, 1), rng.gauss(0, 1), rng.gauss(0, 1)))
    return v.normalized() if v.length > 1e-6 else Vector((0, 0, 1))


# Chaque extrémité porte une touffe : rameaux répartis dans un ellipsoïde
# aplati, chacun orienté au hasard. Les normales de chaque carte pointent
# vers l'extérieur de la touffe : l'ombrage devient doux et volumineux au
# lieu de révéler des plans plats (technique courante pour le feuillage).
foliage_normals = []
# Touffes aux extrémités, plus des touffes secondaires le long des branches
# fines : la couronne devient bosselée et ajourée, avec des trouées de ciel.
clumps = [(tip + Vector((d.x, d.y, 0)) * 0.8 + Vector((0, 0, 0.9)), rng.uniform(1.8, 3.2), rng.randint(40, 55)) for tip, d in tips]
for pts, _r, depth in branch_paths:
    if depth == 2 and len(pts) > 4 and rng.random() < 0.6:
        clumps.append((pts[rng.randint(2, len(pts) - 2)] + Vector((0, 0, 0.6)), rng.uniform(1.2, 2.0), rng.randint(18, 26)))
for center, radius, count in clumps:
    for _ in range(count):
        off = random_unit()
        off = Vector((off.x * radius, off.y * radius, off.z * radius * 0.6)) * (rng.random() ** 0.5)
        c = center + off
        n = random_unit()
        x = n.cross(random_unit()).normalized()
        y = n.cross(x)
        s = rng.uniform(0.6, 1.0)
        corners = [c + (-x - y) * s, c + (x - y) * s, c + (x + y) * s, c + (-x + y) * s]
        f = bm.faces.new([bm.verts.new(p) for p in corners])
        (u0, v0), (u1, v1) = quads[rng.choices(range(4), weights=[5, 4, 4, 1])[0]]
        for loop, uv in zip(f.loops, ((u0, v0), (u1, v0), (u1, v1), (u0, v1))):
            loop[uvl].uv = uv
        card_n = n if n.dot(c - center) >= 0 else -n
        for p in corners:
            # Normales orientées vers l'extérieur et nettement vers le ciel :
            # le dessous des touffes reçoit la lumière du ciel au lieu de
            # virer au noir (la vraie canopée est translucide).
            out = ((p - center).normalized() + Vector((0, 0, 0.9))).normalized()
            foliage_normals.append((out * 0.7 + card_n * 0.3).normalized())
mesh = bpy.data.meshes.new("Houppier")
bm.to_mesh(mesh)
bm.free()
mesh.materials.append(LEAVES)
mesh.shade_smooth()
mesh.normals_split_custom_set_from_vertices([tuple(v) for v in foliage_normals])
canopy = link(bpy.data.objects.new("Houppier", mesh))

# ================================================================== lianes
liana_paths = []
# 1. Lianes qui montent en spirale autour du tronc jusqu'à la fourche.
for _ in range(3):
    turns, phase = rng.uniform(1.2, 2.2), rng.uniform(0, 2 * math.pi)
    pts = []
    for k in range(40):
        t = k / 39
        th = phase + turns * 2 * math.pi * t
        tt = t * 0.98
        r = radius_at(tt, th) + 0.12
        pts.append(Vector((math.cos(th) * r, math.sin(th) * r, tt * CROWN - 0.4)) + trunk_offset(tt))
    liana_paths.append((pts, rng.uniform(0.07, 0.12), 0.3))
# 2. Lianes suspendues. Inspirées des lianes réelles : elles ne tombent pas
#    à la verticale, elles font des boucles entre les branches, descendent en
#    diagonale en ondulant, pendent en se terminant par une crosse, parfois
#    s'enroulent l'une autour de l'autre ou forment un nœud.
mains = [p for p, r, dep in branch_paths if dep <= 1 and len(p) > 6]


def frame(pts, k):
    t = (pts[min(k + 1, len(pts) - 1)] - pts[max(k - 1, 0)]).normalized()
    n = t.cross(Vector((0, 0, 1)))
    n = n.normalized() if n.length > 1e-3 else Vector((1, 0, 0))
    return t, n, t.cross(n)


def sway_path(a, b, sag, sway, waves, n=40):
    side = (b - a).cross(Vector((0, 0, 1)))
    side = side.normalized() if side.length > 1e-3 else Vector((1, 0, 0))
    ph = rng.uniform(0, 6.3)
    pts = []
    for k in range(n):
        t = k / (n - 1)
        p = a.lerp(b, t) - Vector((0, 0, math.sin(t * math.pi) * sag))
        p += side * math.sin(t * math.pi * waves + ph) * sway * math.sin(t * math.pi)
        pts.append(p)
    return pts


def with_knot(pts, radius=0.35):
    """Insère une boucle complète (nœud) au milieu du tracé."""
    k = len(pts) // 2
    t, n, b = frame(pts, k)
    loop = [pts[k] + (n * math.sin(u) + b * (1 - math.cos(u))) * radius + t * (u / (2 * math.pi)) * radius
            for u in (i / 9 * 2 * math.pi for i in range(10))]
    return pts[:k] + loop + pts[k + 1:]


def twisted(pts, radius, turns):
    """Deux brins enroulés l'un autour de l'autre le long d'un tracé."""
    out = ([], [])
    for k, p in enumerate(pts):
        _t, n, b = frame(pts, k)
        a = turns * 2 * math.pi * k / (len(pts) - 1)
        out[0].append(p + (n * math.cos(a) + b * math.sin(a)) * radius)
        out[1].append(p - (n * math.cos(a) + b * math.sin(a)) * radius)
    return out


def on_branch():
    pts = rng.choice(mains)
    return pts[rng.randint(3, len(pts) - 1)]


for i in range(14):
    a = on_branch()
    kind = rng.choices(["boucle", "diagonale", "pendante"], weights=[5, 4, 3])[0]
    if kind == "boucle":
        b = on_branch()
        pts = sway_path(a, b, rng.uniform(5, 12), rng.uniform(0.6, 1.6), rng.uniform(1.5, 3))
    elif kind == "diagonale":
        out = Vector((a.x, a.y, 0)).normalized() if Vector((a.x, a.y, 0)).length > 0.1 else Vector((1, 0, 0))
        b = Vector((a.x, a.y, -0.3)) + out * rng.uniform(4, 9) + Vector((rng.uniform(-3, 3), rng.uniform(-3, 3), 0))
        pts = sway_path(a, b, rng.uniform(1, 3), rng.uniform(0.8, 1.8), rng.uniform(2, 3.5))
    else:
        # Pend jusqu'à mi-hauteur puis s'enroule en crosse.
        end = a + Vector((rng.uniform(-2, 2), rng.uniform(-2, 2), -rng.uniform(0.45, 0.7) * a.z))
        pts = sway_path(a, end, 0.5, rng.uniform(0.4, 1.0), rng.uniform(1, 2), n=30)
        t, n, b = frame(pts, len(pts) - 1)
        c0 = pts[-1]
        for j in range(1, 14):
            u = j / 13 * 1.6 * math.pi
            r = 0.5 * (1 - j / 16)
            pts.append(c0 + (n * math.sin(u) + Vector((0, 0, 1)) * (1 - math.cos(u))) * r)
    if rng.random() < 0.25:
        pts = with_knot(pts)
    radius = rng.uniform(0.045, 0.1)
    if rng.random() < 0.3 and kind != "pendante":
        for strand in twisted(pts, radius * 1.1, rng.uniform(4, 8)):
            liana_paths.append((strand, radius * 0.7, 0.15))
    else:
        liana_paths.append((pts, radius, 0.25))
lianas = tube_curve("Lianes", liana_paths, LIANA, sides_res=1)

# ================================================ maillages, UV, assemblage
for obj in (branches, lianas):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=2.0)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.data.shade_smooth()

bpy.ops.object.select_all(action="DESELECT")
for o in (trunk, branches, lianas):
    o.select_set(True)
bpy.context.view_layer.objects.active = trunk
bpy.ops.object.join()
trunk.name = "ArbreGeant_Bois"
canopy.name = "ArbreGeant_Feuillage"

# =============================================================== épiphytes
# Fougères accrochées sur le dessus des maîtresses branches et dans la
# fourche, comme dans les forêts humides de l'Ituri. Copies liées : un seul
# maillage dans le glTF, réutilisé par chaque nœud.
if A.epiphyte and os.path.exists(A.epiphyte):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=os.path.abspath(A.epiphyte))
    imported = [o for o in bpy.data.objects if o not in before]
    meshes = [o for o in imported if o.type == "MESH"]
    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    fern = bpy.context.view_layer.objects.active
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # Les objets fusionnés par join() n'existent plus : on ne garde que les
    # références encore valides (nœuds vides du glTF importé).
    for o in list(bpy.data.objects):
        if o not in before and o != fern:
            bpy.data.objects.remove(o)
    fern.name = "Epiphyte_Fougere"
    holder = link(bpy.data.objects.new("ArbreGeant_Epiphytes", None))
    spots = []
    for pts, r, depth in branch_paths:
        if depth > 1:
            continue
        for k in range(2, len(pts) - 1):
            seg = (pts[k + 1] - pts[k]).normalized()
            if abs(seg.z) < 0.55 and rng.random() < 0.35:  # dessus d'une branche peu inclinée
                spots.append((pts[k] + Vector((0, 0, r * 0.8)), rng.uniform(0.8, 1.4)))
    for _ in range(4):  # touffes dans la fourche
        th = rng.uniform(0, 2 * math.pi)
        spots.append((trunk_surface(0.98, th) + Vector((0, 0, 0.3)), rng.uniform(1.2, 1.7)))
    rng.shuffle(spots)
    for i, (loc, sc) in enumerate(spots[:22]):
        o = fern if i == 0 else link(bpy.data.objects.new(f"Epiphyte_{i}", fern.data))
        o.location = loc
        o.rotation_euler = (rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), rng.uniform(0, 2 * math.pi))
        o.scale = (sc, sc, sc)
        o.parent = holder
    print("EPIPHYTES", min(len(spots), 22))

stats = {o.name: len(o.data.polygons) for o in scene.objects if o.type == "MESH"}
print("POLYGONES", stats, "total", sum(stats.values()))

os.makedirs(os.path.dirname(os.path.abspath(A.out)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(A.out), export_format="GLB", export_image_format="WEBP", export_apply=True)
print("EXPORT", A.out)
