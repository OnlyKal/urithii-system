"""Coques de fourrure / cheveux très courts, pour l'aperçu Blender.

Même principe que pour l'okapi (voir animaux.py) : la longueur des poils est
stockée dans l'alpha de la texture couleur ; le jeu (Three.js) génère les
coques. Ici, on construit de vraies coques pour juger le rendu dans Blender.
Elles ne sont jamais exportées.
"""

import bmesh
import bpy


def shells(body, material, image, length, layers, density=1400.0, curl=True):
    """Copies du maillage gonflées le long des normales, percées d'un motif de
    brins (qui s'affinent vers la pointe) ; la longueur suit l'alpha de
    « image ». « curl » : motif de boucles serrées (cheveux crépus)."""
    idx = [i for i, m in enumerate(body.data.materials) if m == material][0]
    base = body.copy()
    base.data = body.data.copy()
    bpy.context.scene.collection.objects.link(base)
    # Coques seulement là où il y a des poils (alpha de la texture > 0) : sur
    # tout le corps, les creux (paupières, lèvres, oreilles) empilent trop de
    # couches transparentes et Cycles les rend noires.
    import numpy as np
    w, hgt = image.size
    a = np.empty(w * hgt * 4, dtype=np.float32)
    image.pixels.foreach_get(a)
    alpha = a.reshape(hgt, w, 4)[:, :, 3]
    bm = bmesh.new()
    bm.from_mesh(base.data)
    uvl = bm.loops.layers.uv.active

    def hairy(f):
        for l in f.loops:
            u, v = l[uvl].uv
            if alpha[min(hgt - 1, max(0, int(v * hgt))), min(w - 1, max(0, int(u * w)))] > 0.05:
                return True
        return False

    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index != idx or not hairy(f)], context="FACES")
    bm.to_mesh(base.data)
    bm.free()
    if base.data.shape_keys:
        base.shape_key_clear()
    out = []
    for i in range(1, layers + 1):
        h = i / layers
        o = base.copy()
        o.data = base.data.copy()
        bpy.context.scene.collection.objects.link(o)
        o.name = f"{body.name}_coque_{i}"
        d = o.modifiers.new("Gonflement", "DISPLACE")
        d.direction = "NORMAL"
        d.mid_level = 0.0
        d.strength = h * length
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_move_to_index(modifier=d.name, index=0)
        m = bpy.data.materials.new(f"Coque_{body.name}_{i}")
        nt = m.node_tree
        nodes, links = nt.nodes, nt.links
        bsdf = nodes["Principled BSDF"]
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        # Coordonnées du monde (le repère local d'un maillage MPFB est à
        # l'échelle MakeHuman, ×10, et tourné).
        geo = nodes.new("ShaderNodeNewGeometry")
        vec = geo.outputs["Position"]
        if curl:  # boucles : coordonnées déformées par un bruit à petite échelle
            warp = nodes.new("ShaderNodeTexNoise")
            warp.inputs["Scale"].default_value = density * 0.25
            links.new(geo.outputs["Position"], warp.inputs["Vector"])
            mad = nodes.new("ShaderNodeVectorMath")
            mad.operation = "MULTIPLY_ADD"
            links.new(warp.outputs["Color"], mad.inputs[0])
            mad.inputs[1].default_value = (0.004 * h, 0.004 * h, 0.004 * h)
            links.new(geo.outputs["Position"], mad.inputs[2])
            vec = mad.outputs["Vector"]
        vor = nodes.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = density
        links.new(vec, vor.inputs["Vector"])
        strand = nodes.new("ShaderNodeMath")
        strand.operation = "LESS_THAN"
        links.new(vor.outputs["Distance"], strand.inputs[0])
        strand.inputs[1].default_value = 0.45 * (1 - h) + 0.08
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
        k = 0.6 + 0.5 * h
        shade.inputs[7].default_value = (k, k, k, 1)
        links.new(shade.outputs[2], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = 0.6
        transp = nodes.new("ShaderNodeBsdfTransparent")
        mix = nodes.new("ShaderNodeMixShader")
        links.new(alpha.outputs[0], mix.inputs["Fac"])
        links.new(transp.outputs["BSDF"], mix.inputs[1])
        links.new(bsdf.outputs["BSDF"], mix.inputs[2])
        links.new(mix.outputs["Shader"], nodes["Material Output"].inputs["Surface"])
        o.data.materials.clear()
        o.data.materials.append(m)
        out.append(o)
    bpy.data.objects.remove(base)
    bpy.context.scene.cycles.transparent_max_bounces = max(64, layers * 3)
    return out
