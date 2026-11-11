"""Personnages du jeu, créés avec MPFB (MakeHuman pour Blender) et ses
ressources CC0 : l'écogarde, Amani (guide du village) et le joueur.

  /Applications/Blender.app/Contents/MacOS/Blender -b --python game-assets/blender/personnages.py -- \
      --only ecogarde,guide,joueur --out-dir game-assets/build [--preview] [--portrait]

Prérequis : extension MPFB installée et pack « makehuman_system_assets » (CC0)
chargé (voir game-assets/sources/mpfb/).

Principes (docs/MODULE_JEUX.md) : personnages fictifs, qui ne représentent
aucune communauté. Tenues contemporaines et génériques (aucune tenue
traditionnelle, parure ou scarification) ; aucun logo.

Chaîne : corps paramétré → squelette « game_engine » (53 os) → yeux, sourcils,
cils, cheveux, vêtements → géométrie d'aide supprimée, morphologie appliquée →
matériaux convertis en matériaux glTF simples (vêtements reteints dans la
texture) → animations générées (repos, marche, course, parole) → .glb.
Le personnage regarde vers -Y dans Blender, soit +Z dans Three.js.
"""

import argparse
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

from bl_ext.user_default.mpfb.services.exportservice import ExportService
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA = LocationService.get_user_data()


def args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--only", default="ecogarde,guide,joueur,joueuse")
    p.add_argument("--out-dir", default=os.path.join(ROOT, "build"))
    p.add_argument("--preview", action="store_true")
    p.add_argument("--portrait", action="store_true")
    p.add_argument("--poses", action="store_true", help="planche de contrôle des poses (repos, marche, parole)")
    p.add_argument("--mains", action="store_true", help="gros plan de la main gauche au repos")
    p.add_argument("--cheveux", default="", help="coupe imposée (comparaison)")
    p.add_argument("--expression", default="", help="ex. sourire=1,clignement=0.5 pour le portrait")
    p.add_argument("--suffixe", default="")
    p.add_argument("--texture-size", type=int, default=1024)
    return p.parse_args(argv)


A = args()


def asset(kind, name, ext=".mhclo"):
    return os.path.join(DATA, kind, name, name + ext)


# Fiches des personnages. « tint » : couleur (sRGB) appliquée au vêtement en
# conservant ses plis et coutures (luminance de la texture × couleur).
CHARACTERS = {
    "ecogarde": {
        "macro": {"gender": 1.0, "age": 0.55, "muscle": 0.65, "weight": 0.5, "height": 0.55, "proportions": 0.6,
                  "race": {"african": 1.0, "asian": 0.0, "caucasian": 0.0}},
        "face": {"head/head-square": 0.4, "chin/chin-width-incr": 0.3, "nose/nose-scale-horiz-incr": 0.2,
                 "mouth/mouth-scale-horiz-incr": 0.15, "cheek/l-cheek-bones-incr": 0.3, "cheek/r-cheek-bones-incr": 0.3,
                 "eyebrows/eyebrows-trans-down": 0.2, "head/head-fat-incr": 0.15},
        "skin": "middleage_african_male", "eyes": "brown", "eyebrows": "eyebrow002", "eyelashes": "eyelashes01",
        "hair": None,
        "accessoires": ["jumelles"],
        "clothes": [("male_casualsuit01", (0.33, 0.37, 0.22)),   # chemise et pantalon vert olive
                    ("shoes03", None),                           # rangers noires
                    ("fedora01", (0.62, 0.53, 0.36))],           # chapeau de brousse kaki
    },
    "guide": {  # Amani
        "macro": {"gender": 1.0, "age": 0.4, "muscle": 0.5, "weight": 0.45, "height": 0.5, "proportions": 0.6,
                  "race": {"african": 1.0, "asian": 0.0, "caucasian": 0.0}},
        "face": {"head/head-oval": 0.5, "chin/chin-prominent-incr": 0.2, "nose/nose-point-width-decr": 0.15,
                 "mouth/mouth-lowerlip-volume-incr": 0.2, "cheek/l-cheek-bones-incr": 0.2, "cheek/r-cheek-bones-incr": 0.2,
                 "forehead/forehead-scale-vert-incr": 0.2},
        "skin": "young_african_male", "eyes": "brown", "eyebrows": "eyebrow004", "eyelashes": "eyelashes02",
        "hair": None, "scalp_hair": {"color": (0.012, 0.010, 0.009), "length": 0.014, "layers": 14},
        "clothes": [("male_casualsuit03", None), ("shoes02", None)],  # chemise à carreaux, jean, chaussures de marche
    },
    "joueur": {
        "macro": {"gender": 1.0, "age": 0.45, "muscle": 0.55, "weight": 0.48, "height": 0.52, "proportions": 0.6,
                  "race": {"african": 1.0, "asian": 0.0, "caucasian": 0.0}},
        "face": {"head/head-round": 0.3, "nose/nose-scale-vert-incr": 0.15, "mouth/mouth-angles-up": 0.25,
                 "chin/chin-height-incr": 0.2, "eyebrows/eyebrows-angle-up": 0.15},
        "skin": "young_african_male", "eyes": "brown", "eyebrows": "eyebrow001", "eyelashes": "eyelashes01",
        "hair": None,
        "accessoires": ["sac"],
        "clothes": [("male_casualsuit05", None), ("shoes02", None), ("fedora01", (0.55, 0.47, 0.32))],
    },
    "joueuse": {  # second avatar jouable
        "macro": {"gender": 0.0, "age": 0.42, "muscle": 0.55, "weight": 0.45, "height": 0.5, "proportions": 0.65,
                  "cupsize": 0.45, "firmness": 0.6,
                  "race": {"african": 1.0, "asian": 0.0, "caucasian": 0.0}},
        "face": {"head/head-oval": 0.4, "nose/nose-point-width-decr": 0.1, "mouth/mouth-angles-up": 0.2,
                 "cheek/l-cheek-bones-incr": 0.25, "cheek/r-cheek-bones-incr": 0.25, "chin/chin-prominent-incr": 0.1},
        "skin": "young_african_female", "eyes": "brown", "eyebrows": "eyebrow010", "eyelashes": "eyelashes03",
        "hair": None, "scalp_hair": {"color": (0.012, 0.010, 0.009), "length": 0.024, "layers": 16},
        "accessoires": ["sac"],
        "clothes": [("male_casualsuit05", None), ("shoes02", None)],  # veste d'exploratrice, chemise, jean
    },
}


# ================================================================ textures
def load_image(path, non_color=False):
    img = bpy.data.images.load(path, check_existing=True)
    if non_color:
        img.colorspace_settings.name = "Non-Color"
    return img


def tinted(path, rgb, min_lum=0.0):
    """Reteint une texture : luminance (plis, coutures, trame) × couleur.
    « min_lum » éclaircit les zones très sombres (ruban, décor imprimé)."""
    src = bpy.data.images.load(path)
    w, h = src.size
    px = np.empty(w * h * 4, dtype=np.float32)
    src.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    lum = px[:, :3] @ np.array([0.299, 0.587, 0.114], dtype=np.float32)
    lum = lum / max(float(np.percentile(lum[px[:, 3] > 0.5], 70)) if (px[:, 3] > 0.5).any() else 1.0, 1e-3)
    lum = np.maximum(lum, min_lum)
    px[:, :3] = np.clip(lum[:, None] * np.array(rgb, dtype=np.float32), 0, 1)
    out = bpy.data.images.new(os.path.basename(path).replace(".png", "_teinte"), w, h, alpha=True)
    out.pixels.foreach_set(px.ravel())
    out.pack()
    return out


def eye_texture(path):
    """Iris foncé en brun profond (la texture CC0 « brown » a un iris rouge-brun) ;
    le blanc de l'œil et la pupille restent intacts."""
    src = bpy.data.images.load(path)
    w, h = src.size
    px = np.empty(w * h * 4, dtype=np.float32)
    src.pixels.foreach_get(px)
    px = px.reshape(-1, 4)
    r, g, b = px[:, 0], px[:, 1], px[:, 2]
    iris = (r > g * 1.5) & (r > b * 1.5)
    lum = (r + g + b)[iris] / 3
    px[iris, :3] = np.clip(lum[:, None] * np.array([1.25, 0.72, 0.42]), 0, 1)
    out = bpy.data.images.new("oeil_brun_fonce", w, h)
    out.pixels.foreach_set(px.ravel())
    out.pack()
    return out


def find_texture(folder, *keys):
    for f in sorted(os.listdir(folder)):
        low = f.lower()
        if low.endswith(".png") and all(k in low for k in keys):
            return os.path.join(folder, f)
    return None


def simple_material(name, diffuse, normal=None, alpha=False, roughness=0.8):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = diffuse
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    if normal:
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = normal
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(n.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    if alpha:
        r = nt.nodes.new("ShaderNodeMath")
        r.operation = "ROUND"
        nt.links.new(t.outputs["Alpha"], r.inputs[0])
        nt.links.new(r.outputs[0], bsdf.inputs["Alpha"])
        m.surface_render_method = "DITHERED"
        m.use_backface_culling = False
    bsdf.inputs["Roughness"].default_value = roughness
    return m


def set_material(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


# Unités d'expression MPFB (visages africains, CC0) et cibles combinées
# exportées comme cibles de morphose glTF. Le jeu les pilote : clignement
# aléatoire, bouche pendant les dialogues, sourire.
EXPRESSION_UNITS = ["eye-left-closure", "eye-right-closure", "mouth-open", "mouth-corner-puller", "mouth-elevation",
                    "mouth-upward-retraction"]
EXPRESSIONS = {
    "clignement": {"eye-left-closure": 1.0, "eye-right-closure": 1.0},
    "parole": {"mouth-open": 0.35},                      # le jeu module de 0 à 1 pendant les dialogues
    "sourire": {"mouth-corner-puller": 0.65, "mouth-upward-retraction": 0.3},  # coins étirés, lèvres presque closes
}


def bake_keep_expressions(obj):
    """Applique la morphologie (mélange courant des formes) comme nouvelle base,
    en conservant les expressions : E' = base' + (E - base)."""
    keys = obj.data.shape_keys
    if not keys:
        return
    n = len(obj.data.vertices)
    co = lambda kb: (lambda a: (kb.data.foreach_get("co", a), a.reshape(-1, 3))[1])(np.empty(n * 3, dtype=np.float32))
    for kb in keys.key_blocks:
        if kb.name.startswith("x_"):
            kb.value = 0.0
    basis = co(keys.key_blocks[0])
    mix = obj.shape_key_add(name="__mix", from_mix=True)
    mixc = co(mix)
    deltas = {kb.name[2:]: co(kb) - basis for kb in keys.key_blocks if kb.name.startswith("x_")}
    obj.shape_key_clear()
    obj.data.vertices.foreach_set("co", mixc.ravel())
    obj.shape_key_add(name="Basis")
    for name, recipe in EXPRESSIONS.items():
        d = sum(deltas[u] * w for u, w in recipe.items() if u in deltas)
        kb = obj.shape_key_add(name=name, from_mix=False)
        kb.data.foreach_set("co", (mixc + d).ravel())
    obj.data.update()


def transfer_morphs(src, dst, names):
    """Reporte des cibles de morphose du corps sur un accessoire (cils, sourcils) :
    chaque sommet suit les sommets du corps les plus proches."""
    from mathutils import kdtree
    sk = src.data.shape_keys
    if not sk:
        return
    base = [src.matrix_world @ v.co for v in src.data.vertices]
    tree = kdtree.KDTree(len(base))
    for i, c in enumerate(base):
        tree.insert(c, i)
    tree.balance()
    inv = dst.matrix_world.inverted()
    if not dst.data.shape_keys:
        dst.shape_key_add(name="Basis")
    near = []
    for v in dst.data.vertices:
        found = tree.find_n(dst.matrix_world @ v.co, 3)
        ws = [1 / max(d, 1e-5) for _, _, d in found]
        near.append([(i, w / sum(ws)) for (_, i, _), w in zip(found, ws)])
    for name in names:
        kb_src = sk.key_blocks.get(name)
        if not kb_src:
            continue
        kb = dst.shape_key_add(name=name, from_mix=False)
        for v, nb in zip(dst.data.vertices, near):
            delta = sum((((src.matrix_world @ kb_src.data[i].co) - base[i]) * w for i, w in nb), Vector())
            kb.data[v.index].co = inv @ ((dst.matrix_world @ v.co) + delta)


def pore_normal(size=512, seed=4):
    """Carte de normales tuilable : pores et micro-relief de la peau."""
    rng_np = np.random.default_rng(seed)
    h = np.zeros((size, size))
    y, x = np.mgrid[0:size, 0:size] / size
    for _ in range(1400):  # pores : petites cuvettes
        cx, cy, r = rng_np.random(), rng_np.random(), 0.004 + rng_np.random() * 0.004
        dx = (x - cx + 0.5) % 1 - 0.5
        dy = (y - cy + 0.5) % 1 - 0.5
        h -= np.exp(-(dx * dx + dy * dy) / (r * r)) * 0.6
    for k in range(1, 6):  # micro-relief
        h += np.sin(2 * np.pi * (rng_np.integers(3, 30) * x + rng_np.integers(3, 30) * y) + rng_np.random() * 6) * 0.04 / k
    gy, gx = np.gradient(h)
    n = np.stack([-gx * 18, -gy * 18, np.ones_like(h)], axis=2)
    n /= np.linalg.norm(n, axis=2, keepdims=True)
    img = bpy.data.images.new("peau_pores", size, size)
    img.colorspace_settings.name = "Non-Color"
    img.pixels.foreach_set(np.concatenate([n * 0.5 + 0.5, np.ones((size, size, 1))], axis=2).astype(np.float32).ravel())
    img.pack()
    return img


def skin_material(name, diffuse):
    """Peau : texture photo CC0 + pores (normales tuilées, répétées ×40 via
    KHR_texture_transform) + brillance légère."""
    m = simple_material(name, diffuse, roughness=0.5)
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    uv = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (40, 40, 1)
    n = nt.nodes.new("ShaderNodeTexImage")
    n.image = pore_normal()
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = 0.35
    nt.links.new(uv.outputs["UV"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
    nt.links.new(n.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def scalp_hair(body, skin_path, color, size=2048):
    """Cheveux courts et crépus peints sur le cuir chevelu, avec une lisière
    progressive (front, tempes, au-dessus des oreilles, nuque).

    Renvoie une texture : couleur peau + cheveux ; alpha = longueur relative
    des cheveux (pour les coques, comme le pelage des animaux)."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 4
    vs = [body.matrix_world @ v.co for v in body.data.vertices]
    z_top = max(v.z for v in vs)
    head = [v for v in vs if v.z > z_top - 0.2]
    y_front, y_back = min(v.y for v in head), max(v.y for v in head)
    half = max(abs(v.x) for v in head)
    m = bpy.data.materials.new("cuir_chevelu_tmp")
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    bsdf = nodes["Principled BSDF"]
    def mnode(op, a, b=None, clamp=False):
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
        r = nodes.new("ShaderNodeMapRange")
        r.interpolation_type = "SMOOTHSTEP"
        r.inputs["From Min"].default_value, r.inputs["From Max"].default_value = lo, hi
        links.new(v, r.inputs["Value"])
        return r.outputs["Result"]
    # Coordonnées du MONDE : le maillage MPFB est à l'échelle MakeHuman, axe Y
    # vers le haut et tourné de 90° ; son repère local ne donne pas la hauteur.
    geo = nodes.new("ShaderNodeNewGeometry")
    pos = geo.outputs["Position"]
    sep = nodes.new("ShaderNodeSeparateXYZ")
    links.new(pos, sep.inputs["Vector"])
    X, Y, Z = sep.outputs["X"], sep.outputs["Y"], sep.outputs["Z"]
    t = smooth(Y, y_front, y_back)  # 0 au front, 1 à la nuque
    # Lisière : 7,5 cm sous le sommet au front, 16 cm à la nuque, relevée au-dessus des oreilles.
    line = mnode("SUBTRACT", z_top - 0.075, mnode("MULTIPLY", t, 0.085))
    sides = mnode("MULTIPLY", smooth(mnode("ABSOLUTE", X), half * 0.72, half * 0.9),
                  mnode("MULTIPLY", smooth(t, 0.25, 0.4), smooth(mnode("SUBTRACT", 1.0, t), 0.25, 0.45)))
    line = mnode("ADD", line, mnode("MULTIPLY", sides, 0.03))
    temples = mnode("MULTIPLY", smooth(mnode("ABSOLUTE", X), half * 0.18, half * 0.62), smooth(mnode("SUBTRACT", 0.45, t), 0.0, 0.2))
    line = mnode("ADD", line, mnode("MULTIPLY", temples, 0.016))  # tempes dégagées
    jag = nodes.new("ShaderNodeTexNoise")
    jag.inputs["Scale"].default_value = 28.0
    links.new(pos, jag.inputs["Vector"])
    line = mnode("ADD", line, mnode("MULTIPLY", mnode("SUBTRACT", jag.outputs["Fac"], 0.5), 0.016))
    mask = smooth(mnode("SUBTRACT", Z, line), -0.006, 0.014)  # lisière progressive
    skin = nodes.new("ShaderNodeTexImage")
    skin.image = bpy.data.images.load(skin_path, check_existing=True)
    # L'alpha de la texture de peau MakeHuman (zones des yeux, de la bouche)
    # n'est pas une transparence utile ici : sans ce réglage, la cuisson
    # noircit ces zones.
    skin.image.alpha_mode = "NONE"
    curls = nodes.new("ShaderNodeTexVoronoi")
    curls.inputs["Scale"].default_value = 900.0
    links.new(pos, curls.inputs["Vector"])
    hair_col = nodes.new("ShaderNodeMix")
    hair_col.data_type = "RGBA"
    links.new(smooth(curls.outputs["Distance"], 0.1, 0.6), hair_col.inputs[0])
    hair_col.inputs[6].default_value = (*[c * 0.6 for c in color], 1)
    hair_col.inputs[7].default_value = (*color, 1)
    final = nodes.new("ShaderNodeMix")
    final.data_type = "RGBA"
    links.new(mask, final.inputs[0])
    links.new(skin.outputs["Color"], final.inputs[6])
    links.new(hair_col.outputs[2], final.inputs[7])
    links.new(final.outputs[2], bsdf.inputs["Base Color"])
    links.new(mask, bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    saved = list(body.data.materials)
    body.data.materials.clear()
    body.data.materials.append(m)
    col = bpy.data.images.new(f"{body.name}_peau_cheveux", size, size, alpha=True)
    lng = bpy.data.images.new(f"{body.name}_longueur_cheveux", size, size)
    lng.colorspace_settings.name = "Non-Color"
    target = nodes.new("ShaderNodeTexImage")
    nodes.active = target
    bpy.ops.object.select_all(action="DESELECT")
    body.select_set(True)
    bpy.context.view_layer.objects.active = body
    scene.render.bake.margin = 8
    target.image = col
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"COLOR"})
    target.image = lng
    bpy.ops.object.bake(type="EMIT")
    n = size * size
    px = np.empty(n * 4, dtype=np.float32)
    col.pixels.foreach_get(px)
    lp = np.empty(n * 4, dtype=np.float32)
    lng.pixels.foreach_get(lp)
    px = px.reshape(-1, 4)
    px[:, 3] = np.clip(lp.reshape(-1, 4)[:, 0], 2 / 255, 1)
    col.pixels.foreach_set(px.ravel())
    col.alpha_mode = "CHANNEL_PACKED"  # alpha = longueur des cheveux, pas une transparence
    print("Cheveux : part de la texture couverte", round(float((px[:, 3] > 0.5).mean()), 3))
    if os.environ.get("URITHI_DEBUG_BAKE"):
        rgb = px.copy()
        rgb[:, 3] = 1.0
        dbg = bpy.data.images.new("debug_cuisson", size, size)
        dbg.pixels.foreach_set(rgb.ravel())
        dbg.filepath_raw = os.environ["URITHI_DEBUG_BAKE"]
        dbg.file_format = "PNG"
        dbg.save()
        src = bpy.data.images.load(skin_path, check_existing=False)
        sp = np.empty(src.size[0] * src.size[1] * 4, dtype=np.float32)
        src.pixels.foreach_get(sp)
        sp = sp.reshape(-1, 4)
        print("Peau d'origine : alpha < 0.5 sur", round(float((sp[:, 3] < 0.5).mean()), 3), "de la texture ; taille", tuple(src.size))
    col.pack()
    body.data.materials.clear()
    for mat in saved:
        body.data.materials.append(mat)
    return col


def trim_hair_front(hair, strip_v=0.33, margin=0.045):
    """Retire les cartes de bordure du front (bande de boucles du bas de la
    planche, v < strip_v) : posées à plat, elles dessinent un bandeau
    artificiel. Les côtés et la nuque gardent leurs cartes."""
    import bmesh
    me = hair.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uvl = bm.loops.layers.uv.active
    ys = [v.co.y for v in bm.verts]
    front = min(ys) + margin  # le front est du côté -Y
    doomed = [f for f in bm.faces
              if all(l[uvl].uv[1] < strip_v for l in f.loops) and f.calc_center_median().y < front]
    bmesh.ops.delete(bm, geom=doomed, context="FACES")
    bm.to_mesh(me)
    bm.free()
    print("Cartes de bordure retirées au front :", len(doomed))


# ================================================================ création
def build(key, spec):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    macro = TargetService.get_default_macro_info_dict()
    macro.update({k: v for k, v in spec["macro"].items() if k != "race"})
    macro["race"] = dict(spec["macro"]["race"])
    body = HumanService.create_human(macro_detail_dict=macro)
    body.name = f"{key}_corps"
    # Traits du visage : cibles morphologiques, avant d'ajuster yeux, cheveux et vêtements.
    tdir = os.path.join(os.path.dirname(HumanService.__module__ and sys.modules[HumanService.__module__].__file__), "..", "data", "targets")
    for target, w in spec.get("face", {}).items():
        path = os.path.abspath(os.path.join(tdir, target + ".target.gz"))
        if os.path.exists(path):
            TargetService.load_target(body, path, weight=w)
        else:
            print("Cible absente :", target)
    units = os.path.abspath(os.path.join(tdir, "expression", "units", "african"))
    for unit in EXPRESSION_UNITS:
        TargetService.load_target(body, os.path.join(units, unit + ".target.gz"), weight=0.0, name="x_" + unit)
    HumanService.add_builtin_rig(body, "game_engine")
    rig = body.parent
    rig.name = f"{key}_squelette"

    # Accessoires du visage, cheveux, vêtements.
    parts = {}
    parts["yeux"] = HumanService.add_mhclo_asset(asset("eyes", "low-poly"), body, asset_type="Eyes", subdiv_levels=0)
    parts["sourcils"] = HumanService.add_mhclo_asset(asset("eyebrows", spec["eyebrows"]), body, asset_type="Eyebrows", subdiv_levels=0)
    parts["cils"] = HumanService.add_mhclo_asset(asset("eyelashes", spec["eyelashes"]), body, asset_type="Eyelashes", subdiv_levels=0)
    parts["dents"] = HumanService.add_mhclo_asset(os.path.join(DATA, "teeth", "teeth_base", "teeth_base.mhclo"), body, asset_type="Teeth", subdiv_levels=0)
    parts["langue"] = HumanService.add_mhclo_asset(os.path.join(DATA, "tongue", "tongue01", "tongue01.mhclo"), body, asset_type="Tongue", subdiv_levels=0)
    # Sous un chapeau, pas de carte de cheveux : elle dépasserait derrière les oreilles.
    parts["cheveux"] = HumanService.add_mhclo_asset(asset("hair", spec["hair"]), body, asset_type="Hair", subdiv_levels=0) if spec.get("hair") else None
    if parts["cheveux"] and spec.get("hair_trim_front"):
        trim_hair_front(parts["cheveux"])
    clothes = []
    for name, tint in spec["clothes"]:
        o = HumanService.add_mhclo_asset(asset("clothes", name), body, asset_type="Clothes", subdiv_levels=0)
        clothes.append((name, tint, o))

    # Morphologie appliquée, géométrie d'aide et zones cachées par les vêtements supprimées.
    ExportService.bake_modifiers_remove_helpers(body, bake_masks=True, bake_subdiv=False, remove_helpers=True)
    bake_keep_expressions(body)
    for o in [p for p in parts.values() if p] + [c[2] for c in clothes if c[2]]:
        if o.data.shape_keys:
            bpy.context.view_layer.objects.active = o
            o.shape_key_add(name="final", from_mix=True)
            keys = o.data.shape_keys.key_blocks
            for kb in list(keys)[:-1]:
                o.shape_key_remove(kb)
            o.shape_key_remove(o.data.shape_keys.key_blocks[0])
    for o in [body] + [p for p in parts.values() if p] + [c[2] for c in clothes if c[2]]:
        for mod in list(o.modifiers):
            if mod.type in ("SUBSURF", "MASK"):
                bpy.context.view_layer.objects.active = o
                try:
                    bpy.ops.object.modifier_apply(modifier=mod.name)
                except RuntimeError:
                    o.modifiers.remove(mod)

    # Les cils (et sourcils) suivent les paupières et le front.
    for label in ("cils", "sourcils", "dents", "langue"):
        if parts.get(label):
            transfer_morphs(body, parts[label], ["clignement", "sourire", "parole"])
    body["urithi_expressions"] = list(EXPRESSIONS)
    # Poids par défaut exportés dans le glTF : toutes les expressions à 0
    # (sinon le personnage aurait les yeux fermés dans le jeu).
    for o in bpy.context.scene.objects:
        if o.type == "MESH" and o.data.shape_keys:
            for kb in o.data.shape_keys.key_blocks[1:]:
                kb.value = 0.0

    # Matériaux glTF simples.
    skin_dir = os.path.join(DATA, "skins", spec["skin"])
    skin_path = find_texture(skin_dir, "diffuse") or find_texture(skin_dir, "")
    if spec.get("scalp_hair"):
        sh = spec["scalp_hair"]
        mat = skin_material(f"{key}_peau", scalp_hair(body, skin_path, sh["color"]))
        mat["urithi_fourrure"] = {"longueur": sh["length"], "couches": sh["layers"], "masque": "alpha de la texture couleur",
                                  "motif": "boucles serrées"}
        body["fourrure"] = {"materiau": mat.name, "longueur": sh["length"], "couches": sh["layers"]}
        set_material(body, mat)
    else:
        set_material(body, skin_material(f"{key}_peau", load_image(skin_path)))
    eye_tex = os.path.join(DATA, "eyes", "materials", f"{spec['eyes']}_eye.png")
    if parts["yeux"]:
        set_material(parts["yeux"], simple_material(f"{key}_yeux", eye_texture(eye_tex), roughness=0.08))
    for label in ("sourcils", "cils"):
        o = parts[label]
        if o:
            folder = os.path.join(DATA, "eyebrows" if label == "sourcils" else "eyelashes", spec["eyebrows" if label == "sourcils" else "eyelashes"])
            set_material(o, simple_material(f"{key}_{label}", load_image(find_texture(folder, "")), alpha=True, roughness=0.9))
    if parts.get("dents"):
        set_material(parts["dents"], simple_material(f"{key}_dents", load_image(os.path.join(DATA, "teeth", "teeth_base", "teeth.png")), roughness=0.3))
    if parts.get("langue"):
        set_material(parts["langue"], simple_material(f"{key}_langue", load_image(os.path.join(DATA, "tongue", "tongue01", "tongue01_diffuse.png")), roughness=0.4))
    if parts["cheveux"]:
        folder = os.path.join(DATA, "hair", spec["hair"])  # noqa
        nrm = find_texture(folder, "normal")
        set_material(parts["cheveux"], simple_material(f"{key}_cheveux", tinted(find_texture(folder, "diffuse"), (0.07, 0.055, 0.045)),
                                                       load_image(nrm, True) if nrm else None, alpha=True, roughness=0.7))
    for name, tint, o in clothes:
        if not o:
            continue
        folder = os.path.join(DATA, "clothes", name)
        dif = find_texture(folder, "diffuse")
        nrm = find_texture(folder, "normal")
        img = tinted(dif, tint, min_lum=0.75 if name.startswith("fedora") else 0.0) if tint else load_image(dif)
        set_material(o, simple_material(f"{key}_{name}", img, load_image(nrm, True) if nrm else None, roughness=0.85))
    return body, rig


# ================================================================ accessoires
def _bevel_box(name, size, loc, bevel=0.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    mod = o.modifiers.new("Arrondi", "BEVEL")
    mod.width = bevel
    mod.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.shade_smooth()
    return o


def _tube(name, points, radius, sides=8, flat=1.0):
    """Sangle ou tube le long d'une polyligne (flat < 1 : sangle aplatie)."""
    import bmesh
    pts = [Vector(p) for p in points]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    rings = []
    for i, c in enumerate(pts):
        d = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        side = d.cross(Vector((0, 0, 1)))
        side = side.normalized() if side.length > 1e-3 else Vector((1, 0, 0))
        up = d.cross(side)
        rings.append([bm.verts.new(c + (side * math.cos(k / sides * 2 * math.pi) * radius
                                         + up * math.sin(k / sides * 2 * math.pi) * radius * flat)) for k in range(sides)])
    for i in range(len(rings) - 1):
        for k in range(sides):
            f = bm.faces.new((rings[i][k], rings[i][(k + 1) % sides], rings[i + 1][(k + 1) % sides], rings[i + 1][k]))
            for loop, (u, v) in zip(f.loops, ((k, i), (k + 1, i), (k + 1, i + 1), (k, i + 1))):
                loop[uvl].uv = (u / sides, v * 0.25)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    return o


def _cube_uv(o, size=0.3):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.cube_project(cube_size=size)
    bpy.ops.object.mode_set(mode="OBJECT")


def canvas_texture(rgb, size=512, seed=8):
    """Toile tissée (sergé) : fils fins, légères variations, usure."""
    r = np.random.default_rng(seed)
    y, x = np.mgrid[0:size, 0:size] / size
    weave = 0.78 + 0.14 * np.sin(2 * np.pi * (x * 60 + y * 60)) + 0.08 * np.sin(2 * np.pi * x * 120)
    wear = 0.88 + 0.12 * r.random((size, size))
    seam = 1 - 0.35 * (np.minimum(np.minimum(x, 1 - x), np.minimum(y, 1 - y)) < 0.012)  # coutures en bordure
    dirt = 0.85 + 0.15 * np.sin(2 * np.pi * (x * 2 + r.random())) * np.sin(2 * np.pi * (y * 3 + r.random()))
    weave = weave * seam * dirt
    col = np.array(rgb)[None, None, :] * (weave * wear)[..., None]
    img = bpy.data.images.new("toile", size, size)
    img.pixels.foreach_set(np.concatenate([np.clip(col, 0, 1), np.ones((size, size, 1))], axis=2).astype(np.float32).ravel())
    img.pack()
    return img


def attach_to_bone(objs, rig, bone):
    """Rattache des objets à un os : ils suivent ses mouvements (nœud enfant dans le glTF)."""
    for o in objs:
        mw = o.matrix_world.copy()
        o.parent = rig
        o.parent_type = "BONE"
        o.parent_bone = bone
        bpy.context.view_layer.update()
        o.matrix_world = mw


def chest_frame(rig):
    """Repères du torse (monde) : poitrine, cou, largeur des épaules."""
    bpy.context.view_layer.update()
    s3 = rig.matrix_world @ rig.data.bones["spine_03"].head_local
    neck = rig.matrix_world @ rig.data.bones["neck_01"].head_local
    sh_l = rig.matrix_world @ rig.data.bones["upperarm_l"].head_local
    return s3, neck, abs(sh_l.x)


def onto_surface(points, center, skip, gap=0.012):
    """Pose chaque point sur la surface la plus extérieure (corps et
    vêtements), le long du rayon issu de l'axe du torse, puis le décolle de
    « gap ». Les sangles épousent ainsi la veste, quelle que soit sa carrure."""
    dg = bpy.context.evaluated_depsgraph_get()
    scene = bpy.context.scene
    out = []
    for p in points:
        p = Vector(p)
        axis = Vector((center.x, center.y, p.z))
        d = p - axis
        if d.length < 1e-4:
            out.append(p)
            continue
        d.normalize()
        origin = axis + d * 1.0  # depuis l'extérieur, vers l'axe
        hit, loc = False, None
        o2 = origin
        for _ in range(8):  # ignore les objets à exclure (le sac lui-même)
            h, l, n, i, obj, m = scene.ray_cast(dg, o2, -d)
            if not h:
                break
            if obj.name.split(".")[0] in skip or obj.name.startswith(("Sac_", "Jumelles_")):
                o2 = l - d * 1e-4
                continue
            hit, loc = True, l
            break
        if hit and (loc + d * gap - axis).length > (p - axis).length:
            out.append(loc + d * gap)  # vêtement plus large : on pousse la sangle dehors
        else:
            out.append(p)              # jamais vers l'intérieur
    return out


def add_backpack(rig, rgb):
    """Sac à dos d'explorateur en toile : corps, rabat, poche, bretelles, boucles."""
    s3, neck, shoulder = chest_frame(rig)
    canvas = simple_material("Sac_toile", canvas_texture(rgb), roughness=0.9)
    webbing = simple_material("Sac_sangles", canvas_texture(tuple(c * 0.45 for c in rgb), seed=9), roughness=0.85)
    metal = bpy.data.materials.new("Sac_boucles")
    metal.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.05, 0.05, 0.05, 1)
    metal.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.5
    back_y = s3.y + 0.125         # le dos est du côté +Y (contre la veste)
    zc = s3.z - 0.02
    parts = []
    body_ = _bevel_box("Sac_corps", (0.30, 0.15, 0.42), (s3.x, back_y + 0.06, zc), bevel=0.035)
    flap = _bevel_box("Sac_rabat", (0.31, 0.16, 0.12), (s3.x, back_y + 0.065, zc + 0.19), bevel=0.03)
    pocket = _bevel_box("Sac_poche", (0.22, 0.06, 0.16), (s3.x, back_y + 0.155, zc - 0.08), bevel=0.02)
    for o in (body_, flap, pocket):
        bpy.context.view_layer.objects.active = o
        sub = o.modifiers.new("Souple", "SUBSURF")
        sub.levels = 1
        bpy.ops.object.modifier_apply(modifier=sub.name)
        tex = bpy.data.textures.new(o.name + "_plis", "CLOUDS")
        tex.noise_scale = 0.08
        disp = o.modifiers.new("Plis", "DISPLACE")
        disp.texture = tex
        disp.strength = 0.012
        bpy.ops.object.modifier_apply(modifier=disp.name)
        o.data.shade_smooth()
        _cube_uv(o, 0.25)
        o.data.materials.append(canvas)
        parts.append(o)
    for sx in (1, -1):
        x = s3.x + sx * shoulder * 0.55
        # Tracé grossier, puis calage sur la surface des vêtements (épaule,
        # poitrine, aisselle) ; les extrémités restent ancrées dans le sac.
        rough = [(x, back_y + 0.02, zc + 0.17), (x, back_y - 0.05, neck.z + 0.05),
                 (x * 1.05, s3.y - 0.10, neck.z + 0.0), (x * 1.1, s3.y - 0.17, s3.z - 0.05),
                 (x * 1.15, s3.y - 0.13, s3.z - 0.2), (x * 1.25, back_y - 0.02, zc - 0.17)]
        # Tracé rééchantillonné (environ tous les 3 cm) : avec peu de points,
        # le tube coupait à travers les bosses de la veste entre deux points.
        dense = []
        for i in range(len(rough) - 1):
            a_, b_ = Vector(rough[i]), Vector(rough[i + 1])
            n = max(1, int((b_ - a_).length / 0.03))
            dense += [a_.lerp(b_, k / n) for k in range(n)]
        dense.append(Vector(rough[-1]))
        fitted = [dense[0]] + onto_surface(dense[1:-1], s3, skip=set(), gap=0.02) + [dense[-1]]
        # Lissage : une sangle tendue ne suit pas chaque relief du revers.
        # On lisse, puis on garde le point le plus éloigné de l'axe du torse
        # (la sangle ne doit pas rentrer dans la veste).
        axis_xy = Vector((s3.x, s3.y, 0))
        for _ in range(6):
            sm = [fitted[0]] + [(fitted[i - 1] + fitted[i] * 2 + fitted[i + 1]) / 4 for i in range(1, len(fitted) - 1)] + [fitted[-1]]
            fitted = [sm[i] if (Vector((sm[i].x, sm[i].y, 0)) - axis_xy).length >= (Vector((fitted[i].x, fitted[i].y, 0)) - axis_xy).length - 0.006
                      else fitted[i].lerp(sm[i], 0.3) for i in range(len(sm))]
        strap = _tube("Sac_bretelle", fitted, 0.03, sides=8, flat=0.3)
        strap.data.materials.append(webbing)
        bpos = onto_surface([(x * 1.1, s3.y - 0.178, s3.z - 0.06)], s3, skip=set(), gap=0.02)[0]
        buckle = _bevel_box("Sac_boucle", (0.045, 0.014, 0.032), tuple(bpos), bevel=0.004)
        buckle.data.materials.append(metal)
        parts += [strap, buckle]
    attach_to_bone(parts, rig, "spine_03")
    return parts


def add_binoculars(rig):
    """Jumelles en bandoulière (outil de terrain des écogardes)."""
    s3, neck, shoulder = chest_frame(rig)
    body_mat = bpy.data.materials.new("Jumelles_corps")
    b = body_mat.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.03, 0.035, 0.03, 1)
    b.inputs["Roughness"].default_value = 0.55
    glass = bpy.data.materials.new("Jumelles_verre")
    g = glass.node_tree.nodes["Principled BSDF"]
    g.inputs["Base Color"].default_value = (0.02, 0.03, 0.05, 1)
    g.inputs["Roughness"].default_value = 0.05
    front_y = s3.y - 0.16
    zc = s3.z + 0.13  # haut de la poitrine, sous le col
    parts = []
    for sx in (1, -1):
        bpy.ops.mesh.primitive_cylinder_add(radius=0.026, depth=0.13, vertices=20,
                                            location=(s3.x + sx * 0.035, front_y - 0.03, zc - 0.04))
        tube = bpy.context.active_object
        tube.data.shade_smooth()
        tube.data.materials.append(body_mat)
        bpy.ops.mesh.primitive_circle_add(radius=0.022, vertices=20, fill_type="NGON",
                                          location=(s3.x + sx * 0.035, front_y - 0.03, zc - 0.105))
        lens = bpy.context.active_object
        lens.data.materials.append(glass)
        parts += [tube, lens]
    bridge = _bevel_box("Jumelles_pont", (0.05, 0.03, 0.05), (s3.x, front_y - 0.03, zc - 0.02), bevel=0.008)
    bridge.data.materials.append(body_mat)
    # Courroie autour du cou, par-dessus le col de la chemise.
    strap = _tube("Jumelles_courroie", [(s3.x - 0.06, front_y - 0.03, zc + 0.02), (s3.x - 0.09, s3.y - 0.13, neck.z - 0.02),
                                       (s3.x - 0.08, s3.y - 0.02, neck.z + 0.07), (s3.x, s3.y + 0.07, neck.z + 0.08),
                                       (s3.x + 0.08, s3.y - 0.02, neck.z + 0.07), (s3.x + 0.09, s3.y - 0.13, neck.z - 0.02),
                                       (s3.x + 0.06, front_y - 0.03, zc + 0.02)], 0.011, sides=6, flat=0.35)
    strap.data.materials.append(body_mat)
    parts += [bridge, strap]
    attach_to_bone(parts, rig, "spine_03")
    return parts


# ================================================================ animations
def key_pose(rig, frame, pose):
    # « bassin_bas » : abaissement vertical du bassin (m), converti dans le
    # repère local de l'os « pelvis » (axes mesurés : Y = (0, .44, .9),
    # Z = (0, -.9, .44)) pour que les deux pieds restent au sol.
    drop = pose.pop("bassin_bas", None)
    if drop is not None and rig.pose.bones.get("pelvis"):
        pb = rig.pose.bones["pelvis"]
        pb.location = (0, -0.9 * drop, -0.44 * drop)
        pb.keyframe_insert("location", frame=frame)
    for bname, rot in pose.items():
        pb = rig.pose.bones.get(bname)
        if not pb:
            continue
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = rot
        pb.keyframe_insert("rotation_euler", frame=frame)


def make_action(rig, name, frames, pose_at):
    action = bpy.data.actions.new(name)
    rig.animation_data_create()
    rig.animation_data.action = action
    for f in range(frames + 1):
        key_pose(rig, f, pose_at(f / frames))
    action.use_fake_user = True
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, action)
    rig.animation_data.action = None


# Axes locaux mesurés sur le squelette « game_engine » de MPFB :
# - jambes : flexion avant/arrière autour de X (négatif = pied vers l'avant ;
#   genou : positif = pied vers l'arrière) ;
# - bras : le squelette est en pose A (bras abaissés d'environ 48°) ;
#   l'axe local Z du bras pointe vers l'avant, une rotation de 0,6 rad
#   autour de Z ramène le bras le long du flanc.
REPOS_BRAS = 0.6


# Flexion des doigts autour de leur axe X local (signe vérifié sur gros plan).
DOIGT = 1.0


def finger_curl(amount, side="lr"):
    """Doigts fléchis vers la paume : plus la phalange est distale, plus elle plie."""
    pose = {}
    for sd in side:
        for f, spread in (("index", 0.0), ("middle", 0.05), ("ring", 0.1), ("pinky", 0.18)):
            for i, k in ((1, 0.55), (2, 0.9), (3, 0.7)):
                pose[f"{f}_0{i}_{sd}"] = (DOIGT * amount * (k + spread), 0, 0)
        pose[f"thumb_02_{sd}"] = (DOIGT * amount * 0.3, 0, 0)
        pose[f"thumb_03_{sd}"] = (DOIGT * amount * 0.4, 0, 0)
    return pose


def base_pose(curl=0.35):
    p = {"upperarm_l": (0, 0, -REPOS_BRAS), "upperarm_r": (0, 0, REPOS_BRAS),
         "lowerarm_l": (-0.15, 0, 0), "lowerarm_r": (-0.15, 0, 0)}
    p.update(finger_curl(curl))  # main au repos : doigts légèrement repliés
    return p


def walk_pose(t, amp=0.36, arm=0.32, run=False):
    """Marche (ou course) : bassin qui descend et pivote, épaules en
    contre-rotation, coudes qui suivent avec un léger retard, déroulé du pied
    (talon à l'attaque, pointe à la poussée), tête stabilisée."""
    ph = 2 * math.pi * t
    s = math.sin(ph)
    c = math.cos(ph)
    p = base_pose(curl=0.5 if run else 0.4)
    p["bassin_bas"] = 0.87 * (1 - math.cos(amp * abs(s))) + (0.03 * abs(c) if run else 0.0)
    knee = 1.7 if run else 1.25
    # Pied : relevé (talon) quand la jambe arrive devant, pointe tendue à la poussée.
    roll = lambda phase: 0.28 * math.sin(phase - 0.9)
    lag = math.sin(ph - 0.5)  # bras légèrement en retard sur les jambes
    p.update({
        "thigh_l": (-s * amp, 0, 0), "thigh_r": (s * amp, 0, 0),
        "calf_l": (max(0.0, c) * amp * knee + 0.05, 0, 0),
        "calf_r": (max(0.0, -c) * amp * knee + 0.05, 0, 0),
        "foot_l": (roll(ph), 0, 0), "foot_r": (roll(ph + math.pi), 0, 0),
        "upperarm_l": (lag * arm, 0, -REPOS_BRAS), "upperarm_r": (-lag * arm, 0, REPOS_BRAS),
        "lowerarm_l": (-0.2 - (0.9 if run else 0.25) * max(0.0, lag), 0, 0),
        "lowerarm_r": (-0.2 - (0.9 if run else 0.25) * max(0.0, -lag), 0, 0),
        "pelvis": (0, 0.07 * s, 0.03 * s),                   # pivote et bascule
        "spine_01": (0.14 if run else 0.04, 0, 0),
        "spine_03": (0, -0.09 * s, 0),                      # épaules en contre-rotation
        "neck_01": (0, 0.05 * s, 0), "head": (-0.02, 0.03 * s, 0),  # regard stable
        "clavicle_l": (0, 0, 0.04 * lag), "clavicle_r": (0, 0, 0.04 * lag),
    })
    return p


def idle_pose(t):
    """Repos : respiration, poids qui passe d'une jambe à l'autre, regard qui balaie."""
    ph = 2 * math.pi * t
    p = base_pose()
    breathe = 0.02 * math.sin(4 * ph)
    shift = math.sin(ph)
    p["bassin_bas"] = 0.006 * (1 - abs(shift))
    p.update({"spine_02": (breathe, 0, 0), "spine_03": (breathe, 0, -0.02 * shift),
              "pelvis": (0, 0, 0.035 * shift),                 # transfert du poids
              "calf_l": (0.08 * max(0.0, -shift), 0, 0), "calf_r": (0.08 * max(0.0, shift), 0, 0),
              "neck_01": (0, 0.12 * math.sin(ph * 0.5 + 1), 0), "head": (0.04 * math.sin(ph * 2), 0.1 * math.sin(ph), 0),
              "thigh_l": (0, 0, 0), "thigh_r": (0, 0, 0)})
    return p


def talk_pose(t):
    ph = 2 * math.pi * t
    p = idle_pose(t)
    # Gestes de la main droite en parlant (main qui s'ouvre), hochements de tête.
    p.update({"upperarm_r": (-0.35 - 0.15 * math.sin(ph * 2), 0, REPOS_BRAS - 0.25), "lowerarm_r": (-1.1 - 0.25 * math.sin(ph * 3), 0, 0),
              "head": (0.08 * math.sin(ph * 4), 0.08 * math.sin(ph), 0)})
    p.update(finger_curl(0.15 + 0.15 * math.sin(ph * 3), side="r"))
    return p


def animate(rig):
    make_action(rig, "repos", 120, idle_pose)
    make_action(rig, "marche", 32, lambda t: walk_pose(t))
    make_action(rig, "course", 20, lambda t: walk_pose(t, amp=0.6, arm=0.7, run=True))
    make_action(rig, "parole", 96, talk_pose)


# ================================================================ export, aperçu
def export(path):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", export_image_format="WEBP",
                              export_animations=True, export_animation_mode="NLA_TRACKS", export_skins=True,
                              export_apply=False, export_extras=True)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type == "MESH")
    print("EXPORT", os.path.basename(path), "triangles", tris)


def render(path, rig, action, frame, cam_loc, target, lens=50, size=(900, 1200)):
    import glob
    scene = bpy.context.scene
    if not scene.world:
        world = bpy.data.worlds.new("Ciel")
        scene.world = world
        hdri = glob.glob(os.path.join(ROOT, "sources", "polyhaven", "rainforest_trail", "*.hdr"))
        if hdri:
            env = world.node_tree.nodes.new("ShaderNodeTexEnvironment")
            env.image = bpy.data.images.load(hdri[0])
            world.node_tree.links.new(env.outputs["Color"], world.node_tree.nodes["Background"].inputs["Color"])
        sun = bpy.data.lights.new("Soleil", "SUN")
        sun.energy = 3.0
        so = bpy.data.objects.new("Soleil", sun)
        so.rotation_euler = (math.radians(50), 0, math.radians(-35))
        scene.collection.objects.link(so)
        bpy.ops.mesh.primitive_plane_add(size=20)
        g = bpy.context.active_object
        gm = bpy.data.materials.new("Sol")
        gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.1, 0.07, 0.045, 1)
        g.data.materials.append(gm)
        cam = bpy.data.cameras.new("Camera")
        co = bpy.data.objects.new("Camera", cam)
        scene.collection.objects.link(co)
        scene.camera = co
        scene.render.engine = "CYCLES"
        scene.cycles.samples = 64
        scene.cycles.use_denoising = True
        try:
            prefs = bpy.context.preferences.addons["cycles"].preferences
            prefs.compute_device_type = "METAL"
            prefs.get_devices()
            for d in prefs.devices:
                d.use = True
            scene.cycles.device = "GPU"
        except Exception:
            pass
        scene.view_settings.view_transform = "AgX"
    for tr in rig.animation_data.nla_tracks:
        tr.mute = tr.name != action
    scene.frame_set(frame)
    co = scene.camera
    co.data.lens = lens
    co.location = cam_loc
    co.rotation_euler = (Vector(target) - Vector(cam_loc)).to_track_quat("-Z", "Y").to_euler()
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.render.filepath = os.path.abspath(path)
    bpy.ops.render.render(write_still=True)
    print("RENDU", path)


os.makedirs(A.out_dir, exist_ok=True)
for key in A.only.split(","):
    spec = dict(CHARACTERS[key])
    if A.cheveux:
        spec["hair"] = A.cheveux
    body, rig = build(key, spec)
    for item in spec.get("accessoires", []):
        if item == "sac":
            add_backpack(rig, (0.36, 0.33, 0.22))
        elif item == "jumelles":
            add_binoculars(rig)
    animate(rig)
    export(os.path.join(os.path.abspath(A.out_dir), f"{key}.glb"))
    fur = body.get("fourrure")
    if fur and (A.preview or A.portrait or A.expression or A.poses):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import fourrure
        mat = bpy.data.materials[fur["materiau"]]
        img = next(n.image for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image and "peau_cheveux" in n.image.name)
        fourrure.shells(body, mat, img, fur["longueur"], fur["couches"], density=850.0, curl=True)
    if A.preview:
        render(os.path.join(A.out_dir, f"{key}.png"), rig, "marche", 8, (2.2, -3.6, 1.3), (0, 0, 0.95))
    if A.preview and "sac" in spec.get("accessoires", []):
        render(os.path.join(A.out_dir, f"{key}_dos.png"), rig, "marche", 8, (-2.0, 3.2, 1.5), (0, 0, 1.1))
    if A.mains:
        rig.animation_data.nla_tracks["repos"].mute = False
        bpy.context.scene.frame_set(0)
        hand = rig.matrix_world @ rig.pose.bones["hand_l"].head
        render(os.path.join(A.out_dir, f"{key}_main.png"), rig, "repos", 0, hand + Vector((0.35, -0.35, 0.05)), hand + Vector((0, 0, -0.06)), lens=70, size=(700, 700))
    if A.poses:
        for action, frame in (("repos", 0), ("marche", 8), ("marche", 24), ("parole", 30)):
            render(os.path.join(A.out_dir, f"{key}_pose_{action}_{frame}.png"), rig, action, frame, (2.6, -2.6, 1.1), (0, 0, 0.9), lens=40, size=(500, 700))
    if A.expression:
        # Une image par expression : « neutre;sourire=1;clignement=1 ».
        for variant in A.expression.split(";"):
            values = dict(item.split("=") for item in variant.split(",") if "=" in item)
            for o in bpy.context.scene.objects:
                if o.type == "MESH" and o.data.shape_keys:
                    for kb in o.data.shape_keys.key_blocks[1:]:
                        kb.value = float(values.get(kb.name, 0.0))
            tag = variant.replace("=", "").replace(",", "_").replace(".", "")
            rig.animation_data.nla_tracks["repos"].mute = False
            bpy.context.scene.frame_set(0)
            face = rig.matrix_world @ rig.pose.bones["head"].head + Vector((0, -0.04, 0.03))  # caméra calée sur la tête
            render(os.path.join(A.out_dir, f"{key}_expr_{tag}{A.suffixe}.png"), rig, "repos", 0,
                   face + Vector((0.22, -0.58, 0.0)), face, lens=70, size=(500, 500))
    if A.portrait:
        rig.animation_data.nla_tracks["repos"].mute = False
        bpy.context.scene.frame_set(0)
        top = rig.matrix_world @ rig.pose.bones["head"].head + Vector((0, 0, 0.1))  # caméra calée sur la tête
        render(os.path.join(A.out_dir, f"{key}_tete{A.suffixe}.png"), rig, "repos", 0, top + Vector((0.35, -0.75, 0.05)), top, lens=60, size=(900, 900))
