"""Cycles reference materials. Each mirrors the inputs of the matching Unity shader (Assets/Shaders/
Character), so the path-traced look-dev and the real-time asset use the same textures and parameters."""
from __future__ import annotations

import bpy

import bl


class G:
    """Tiny node-graph builder."""

    def __init__(self, mat):
        self.mat = mat
        self.nt = mat.node_tree
        self.nt.nodes.clear()
        self.out = self.node("ShaderNodeOutputMaterial")

    def node(self, kind, **inputs):
        n = self.nt.nodes.new(kind)
        for k, v in inputs.items():
            if hasattr(n, k) and not k[0].isupper():
                setattr(n, k, v)
            else:
                n.inputs[k].default_value = v
        return n

    def link(self, a, b):
        self.nt.links.new(a, b)

    def tex(self, image, uv="UV0", colorspace=None, interp="Cubic"):
        t = self.node("ShaderNodeTexImage")
        t.image = image
        t.interpolation = interp
        if colorspace:
            image.colorspace_settings.name = colorspace
        m = self.node("ShaderNodeUVMap")
        m.uv_map = uv
        self.link(m.outputs[0], t.inputs[0])
        return t

    def principled(self, **inputs):
        return self.node("ShaderNodeBsdfPrincipled", **inputs)

    def normal_map(self, image, strength=1.0, uv="UV0"):
        t = self.tex(image, uv, "Non-Color")
        nm = self.node("ShaderNodeNormalMap", uv_map=uv)
        nm.inputs["Strength"].default_value = strength
        self.link(t.outputs[0], nm.inputs["Color"])
        return nm


def _shadow_transparent(g, shader_out):
    """Camera/reflection rays see `shader_out`; shadow rays pass (no caustics needed for wet layers)."""
    lp = g.node("ShaderNodeLightPath")
    tr = g.node("ShaderNodeBsdfTransparent")
    mix = g.node("ShaderNodeMixShader")
    g.link(lp.outputs["Is Shadow Ray"], mix.inputs[0])
    g.link(shader_out, mix.inputs[1])
    g.link(tr.outputs[0], mix.inputs[2])
    return mix.outputs[0]


def sclera(img_albedo):
    mat = bl.material("M_Human_Sclera")
    g = G(mat)
    t = g.tex(img_albedo)
    p = g.principled(Roughness=0.35)
    p.inputs["Subsurface Weight"].default_value = 0.6
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.5, 0.35)
    p.inputs["Subsurface Scale"].default_value = 0.0015
    g.link(t.outputs[0], p.inputs["Base Color"])
    g.link(p.outputs[0], g.out.inputs[0])
    return mat


def iris(img_albedo, img_normal):
    mat = bl.material("M_Human_Iris")
    g = G(mat)
    t = g.tex(img_albedo)
    p = g.principled(Roughness=0.55)
    p.inputs["Subsurface Weight"].default_value = 0.25
    p.inputs["Subsurface Radius"].default_value = (0.6, 0.4, 0.2)
    p.inputs["Subsurface Scale"].default_value = 0.0006
    g.link(t.outputs[0], p.inputs["Base Color"])
    nm = g.normal_map(img_normal, 0.6)
    g.link(nm.outputs[0], p.inputs["Normal"])
    g.link(p.outputs[0], g.out.inputs[0])
    return mat


def cornea():
    """Clear, wet: IOR 1.376 for camera rays (real refraction of the iris), transparent to shadows."""
    mat = bl.material("M_Human_Cornea")
    g = G(mat)
    p = g.principled(Roughness=0.0, IOR=1.376)
    p.inputs["Base Color"].default_value = (1, 1, 1, 1)
    p.inputs["Transmission Weight"].default_value = 1.0
    g.link(_shadow_transparent(g, p.outputs[0]), g.out.inputs[0])
    mat.blend_method = "BLEND" if hasattr(mat, "blend_method") else None
    return mat


def wet():
    """Tear meniscus: a reflective water film. Reflection only (no refraction): a thin film doesn't bend
    what's behind it noticeably, and refraction through the strip's geometry reads as a glass tube."""
    mat = bl.material("M_Human_EyeWet")
    g = G(mat)
    fr = g.node("ShaderNodeFresnel")
    fr.inputs["IOR"].default_value = 1.333
    gl = g.node("ShaderNodeBsdfGlossy")
    gl.inputs["Roughness"].default_value = 0.03
    tr = g.node("ShaderNodeBsdfTransparent")
    add = g.node("ShaderNodeAddShader")
    mix = g.node("ShaderNodeMixShader")
    g.link(fr.outputs[0], mix.inputs[0])
    g.link(tr.outputs[0], mix.inputs[1])
    g.link(gl.outputs[0], mix.inputs[2])
    g.link(_shadow_transparent(g, mix.outputs[0]), g.out.inputs[0])
    _ = add
    return mat


def eye_occlusion():
    """Path-traced equivalent of the real-time occlusion shell: a tinted transparent film (a multiply)
    darkening the eyeball along the lid margin, strongest under the upper lid. Shadow rays pass."""
    mat = bl.material("M_Human_EyeOcclusion")
    g = G(mat)
    uv = g.node("ShaderNodeUVMap", uv_map="UV0")
    sep = g.node("ShaderNodeSeparateXYZ")
    g.link(uv.outputs[0], sep.inputs[0])
    col = g.node("ShaderNodeVertexColor", layer_name="Col")
    width = g.node("ShaderNodeMath", operation="MULTIPLY_ADD")     # 0.45 * (1 + 0.6 * upper)
    width.inputs[1].default_value = 0.27
    width.inputs[2].default_value = 0.45
    g.link(col.outputs["Color"], width.inputs[0])
    t = g.node("ShaderNodeMath", operation="DIVIDE")
    g.link(sep.outputs[1], t.inputs[0])
    g.link(width.outputs[0], t.inputs[1])
    edge = g.node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")
    edge.inputs["To Min"].default_value = 1.0
    edge.inputs["To Max"].default_value = 0.0
    g.link(t.outputs[0], edge.inputs["Value"])
    sq = g.node("ShaderNodeMath", operation="MULTIPLY")
    g.link(edge.outputs[0], sq.inputs[0])
    g.link(edge.outputs[0], sq.inputs[1])
    boost = g.node("ShaderNodeMath", operation="MULTIPLY_ADD")    # 1 + 0.9 * upper
    boost.inputs[1].default_value = 0.9
    boost.inputs[2].default_value = 1.0
    g.link(col.outputs["Color"], boost.inputs[0])
    occ = g.node("ShaderNodeMath", operation="MULTIPLY", use_clamp=True)
    g.link(sq.outputs[0], occ.inputs[0])
    g.link(boost.outputs[0], occ.inputs[1])
    occ2 = g.node("ShaderNodeMath", operation="MULTIPLY", use_clamp=True)
    occ2.inputs[1].default_value = 0.75
    g.link(occ.outputs[0], occ2.inputs[0])
    tint = g.node("ShaderNodeMix", data_type="RGBA")
    tint.inputs[6].default_value = (1, 1, 1, 1)
    tint.inputs[7].default_value = (0.32, 0.22, 0.20, 1)
    g.link(occ2.outputs[0], tint.inputs["Factor"])
    tr = g.node("ShaderNodeBsdfTransparent")
    g.link(tint.outputs[2], tr.inputs["Color"])
    g.link(_shadow_transparent(g, tr.outputs[0]), g.out.inputs[0])
    return mat


def holdout_transparent(name):
    """Fully transparent (unused helpers)."""
    mat = bl.material(name)
    g = G(mat)
    tr = g.node("ShaderNodeBsdfTransparent")
    g.link(tr.outputs[0], g.out.inputs[0])
    return mat


def teeth(img_albedo):
    mat = bl.material("M_Human_Teeth")
    g = G(mat)
    t = g.tex(img_albedo)
    p = g.principled(Roughness=0.22)
    p.inputs["Subsurface Weight"].default_value = 0.35
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.8, 0.6)
    p.inputs["Subsurface Scale"].default_value = 0.001
    p.inputs["Coat Weight"].default_value = 0.4
    p.inputs["Coat Roughness"].default_value = 0.08
    g.link(t.outputs[0], p.inputs["Base Color"])
    g.link(p.outputs[0], g.out.inputs[0])
    return mat


def tongue(img_albedo):
    mat = bl.material("M_Human_Tongue")
    g = G(mat)
    t = g.tex(img_albedo)
    p = g.principled(Roughness=0.3)
    p.inputs["Subsurface Weight"].default_value = 0.8
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.3, 0.2)
    p.inputs["Subsurface Scale"].default_value = 0.003
    p.inputs["Coat Weight"].default_value = 0.6
    p.inputs["Coat Roughness"].default_value = 0.12
    g.link(t.outputs[0], p.inputs["Base Color"])
    g.link(p.outputs[0], g.out.inputs[0])
    return mat


def skin(name, tex, detail_normal=None, sss_scale=0.0045):
    """tex: dict of bpy images: albedo, normal, mask (R AO, G roughness, B cavity, A translucency)."""
    mat = bl.material(name)
    g = G(mat)
    alb = g.tex(tex["albedo"])
    tex["mask"].alpha_mode = "CHANNEL_PACKED"      # A is translucency, not coverage: keep RGB intact
    rough = g.tex(tex["mask"], colorspace="Non-Color")
    sep = g.node("ShaderNodeSeparateColor")
    g.link(rough.outputs[0], sep.inputs[0])
    p = g.principled(IOR=1.40)
    p.inputs["Subsurface Weight"].default_value = 1.0
    p.inputs["Subsurface Radius"].default_value = (1.0, 0.37, 0.18)
    p.inputs["Subsurface Scale"].default_value = sss_scale
    p.inputs["Subsurface Anisotropy"].default_value = 0.0
    try:
        p.subsurface_method = "RANDOM_WALK_SKIN"
    except TypeError:
        p.subsurface_method = "RANDOM_WALK"
    # dual-lobe skin specular: primary lobe from the roughness map, a sharper oily coat on top
    p.inputs["Specular IOR Level"].default_value = 0.5
    p.inputs["Coat Weight"].default_value = 0.0
    p.inputs["Sheen Weight"].default_value = 0.12        # vellus hair "peach fuzz" rim
    p.inputs["Sheen Roughness"].default_value = 0.35
    p.inputs["Sheen Tint"].default_value = (0.9, 0.75, 0.65, 1)
    # albedo * cavity (micro-occlusion of pores/wrinkles darkens the diffuse slightly)
    mul = g.node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    mul.inputs["Factor"].default_value = 1.0
    g.link(alb.outputs[0], mul.inputs[6])
    cav = g.node("ShaderNodeMapRange")
    cav.inputs["To Min"].default_value = 0.82
    g.link(sep.outputs[2], cav.inputs["Value"])
    comb = g.node("ShaderNodeCombineColor")
    for i in range(3):
        g.link(cav.outputs[0], comb.inputs[i])
    g.link(comb.outputs[0], mul.inputs[7])
    g.link(mul.outputs[2], p.inputs["Base Color"])
    g.link(sep.outputs[1], p.inputs["Roughness"])
    # specular occlusion from cavity
    spec = g.node("ShaderNodeMath", operation="MULTIPLY")
    spec.inputs[1].default_value = 0.45
    g.link(sep.outputs[2], spec.inputs[0])
    g.link(spec.outputs[0], p.inputs["Specular IOR Level"])
    # oily coat only where the roughness map says the skin is shiny (T-zone, lips)
    coat = g.node("ShaderNodeMapRange")
    coat.inputs["From Min"].default_value = 0.45
    coat.inputs["From Max"].default_value = 0.25
    coat.inputs["To Min"].default_value = 0.0
    coat.inputs["To Max"].default_value = 0.25
    g.link(sep.outputs[1], coat.inputs["Value"])
    g.link(coat.outputs[0], p.inputs["Coat Weight"])
    p.inputs["Coat Roughness"].default_value = 0.18
    p.inputs["Coat IOR"].default_value = 1.45
    nm = g.normal_map(tex["normal"], 1.0)
    if detail_normal is not None:
        # tiling micro-detail (skin cross-hatching), blended with the baked normal
        tc = g.node("ShaderNodeUVMap", uv_map="UV0")
        mp = g.node("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (tex.get("detail_tiling", 24.0),) * 3
        g.link(tc.outputs[0], mp.inputs[0])
        dt = g.node("ShaderNodeTexImage")
        dt.image = detail_normal
        detail_normal.colorspace_settings.name = "Non-Color"
        g.link(mp.outputs[0], dt.inputs[0])
        dn = g.node("ShaderNodeNormalMap", uv_map="UV0")
        dn.inputs["Strength"].default_value = 0.5
        g.link(dt.outputs[0], dn.inputs["Color"])
        avg = g.node("ShaderNodeVectorMath", operation="ADD")
        g.link(nm.outputs[0], avg.inputs[0])
        g.link(dn.outputs[0], avg.inputs[1])
        nrm = g.node("ShaderNodeVectorMath", operation="NORMALIZE")
        g.link(avg.outputs[0], nrm.inputs[0])
        g.link(nrm.outputs[0], p.inputs["Normal"])
        g.link(nm.outputs[0], p.inputs["Coat Normal"])
    else:
        g.link(nm.outputs[0], p.inputs["Normal"])
        g.link(nm.outputs[0], p.inputs["Coat Normal"])
    g.link(p.outputs[0], g.out.inputs[0])
    return mat


def _hair_principled(g, color_lin, roughness):
    p = g.principled(Roughness=roughness, IOR=1.55)
    p.inputs["Base Color"].default_value = (*color_lin, 1)
    p.inputs["Anisotropic"].default_value = 0.6
    p.inputs["Specular IOR Level"].default_value = 0.32
    p.inputs["Specular Tint"].default_value = (1.0, 0.92, 0.85, 1)
    tg = g.node("ShaderNodeTangent", direction_type="UV_MAP", uv_map="UV0")
    g.link(tg.outputs[0], p.inputs["Tangent"])
    p.inputs["Subsurface Weight"].default_value = 0.0
    p.inputs["Sheen Weight"].default_value = 0.0
    return p


def hair_card(name, img_card, color_lin, roughness=0.42):
    """Hair cards: card texture R = root->tip, G = per-strand brightness, A = coverage. U runs across the
    strands, V from root (0) to tip (1)."""
    mat = bl.material(name)
    g = G(mat)
    img_card.alpha_mode = "CHANNEL_PACKED"
    t = g.tex(img_card, colorspace="Non-Color", interp="Linear")
    sep = g.node("ShaderNodeSeparateColor")
    g.link(t.outputs[0], sep.inputs[0])
    p = _hair_principled(g, color_lin, roughness)
    # darker roots, lighter sun-bleached tips, per-strand variation
    tint = g.node("ShaderNodeMapRange")
    tint.inputs["To Min"].default_value = 0.65
    tint.inputs["To Max"].default_value = 1.2
    g.link(sep.outputs[0], tint.inputs["Value"])
    strand = g.node("ShaderNodeMapRange")
    strand.inputs["To Min"].default_value = 0.6
    strand.inputs["To Max"].default_value = 1.3
    g.link(sep.outputs[1], strand.inputs["Value"])
    var = g.node("ShaderNodeMath", operation="MULTIPLY")
    g.link(tint.outputs[0], var.inputs[0])
    g.link(strand.outputs[0], var.inputs[1])
    mul = g.node("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
    mul.inputs["Factor"].default_value = 1.0
    mul.inputs[6].default_value = (*color_lin, 1)
    comb = g.node("ShaderNodeCombineColor")
    for i in range(3):
        g.link(var.outputs[0], comb.inputs[i])
    g.link(comb.outputs[0], mul.inputs[7])
    g.link(mul.outputs[2], p.inputs["Base Color"])
    g.link(t.outputs["Alpha"], p.inputs["Alpha"])
    g.link(p.outputs[0], g.out.inputs[0])
    return mat


def strand_ribbon(name, color_lin, roughness=0.35, tip_fade=True):
    """Individual hair ribbons (eyelashes, eyebrows). Alpha fades across the width and toward the tip
    using the ribbon UV (U across, V root->tip)."""
    mat = bl.material(name)
    g = G(mat)
    p = _hair_principled(g, color_lin, roughness)
    uvn = g.node("ShaderNodeUVMap", uv_map="UV0")
    sep = g.node("ShaderNodeSeparateXYZ")
    g.link(uvn.outputs[0], sep.inputs[0])
    m1 = g.node("ShaderNodeMath", operation="MULTIPLY_ADD")
    m1.inputs[1].default_value = 2.0
    m1.inputs[2].default_value = -1.0
    g.link(sep.outputs[0], m1.inputs[0])
    ab = g.node("ShaderNodeMath", operation="ABSOLUTE")
    g.link(m1.outputs[0], ab.inputs[0])
    pw = g.node("ShaderNodeMath", operation="POWER")
    pw.inputs[1].default_value = 4.0
    g.link(ab.outputs[0], pw.inputs[0])
    inv = g.node("ShaderNodeMath", operation="SUBTRACT")
    inv.inputs[0].default_value = 1.0
    g.link(pw.outputs[0], inv.inputs[1])
    tip = g.node("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP")
    tip.inputs["From Min"].default_value = 0.65
    tip.inputs["From Max"].default_value = 1.0
    tip.inputs["To Min"].default_value = 1.0
    tip.inputs["To Max"].default_value = 0.0 if tip_fade else 1.0
    g.link(sep.outputs[1], tip.inputs["Value"])
    al = g.node("ShaderNodeMath", operation="MULTIPLY")
    g.link(inv.outputs[0], al.inputs[0])
    g.link(tip.outputs[0], al.inputs[1])
    g.link(al.outputs[0], p.inputs["Alpha"])
    g.link(p.outputs[0], g.out.inputs[0])
    return mat
