"""Look-dev scenes for the human quality gate: studio portrait, full body, outdoor sun.

Cycles path tracing (random-walk SSS, principled hair) gives the reference look the Unity shaders are
matched against.
"""
from __future__ import annotations

import math
import os

import bpy
from mathutils import Vector


def setup_render(width=1024, height=1024, samples=128, exposure=0.0, look="AgX - Medium High Contrast"):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    cy = sc.cycles
    cy.device = "CPU"
    cy.samples = samples
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = 0.02
    cy.use_denoising = True
    try:
        cy.denoiser = "OPENIMAGEDENOISE"
    except TypeError:
        pass
    cy.max_bounces = 12
    cy.diffuse_bounces = 4
    cy.glossy_bounces = 4
    cy.transmission_bounces = 12
    cy.transparent_max_bounces = 64
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.blur_glossy = 0.5
    sc.render.resolution_x = width
    sc.render.resolution_y = height
    sc.render.resolution_percentage = 100
    sc.render.film_transparent = False
    sc.render.image_settings.file_format = "PNG"
    sc.render.threads_mode = "AUTO"
    vs = sc.view_settings
    vs.view_transform = "AgX"
    try:
        vs.look = look
    except TypeError:
        vs.look = "None"
    vs.exposure = exposure
    sc.render.use_persistent_data = True


def world_color(color=(0.05, 0.05, 0.055), strength=1.0):
    w = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    bg = nt.nodes.new("ShaderNodeBackground")
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg.inputs["Color"].default_value = (*color, 1)
    bg.inputs["Strength"].default_value = strength
    nt.links.new(bg.outputs[0], out.inputs[0])
    return w


HDRI_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "SourceArt", "Characters",
                        "Human", "_download")


def hdri(name, res="2k"):
    """Path to a CC0 Poly Haven HDRI, downloaded on first use into the git-ignored _download folder."""
    path = os.path.join(HDRI_DIR, f"{name}.hdr")
    if not os.path.exists(path):
        import json
        import urllib.request
        os.makedirs(HDRI_DIR, exist_ok=True)
        with urllib.request.urlopen(f"https://api.polyhaven.com/files/{name}") as r:
            url = json.load(r)["hdri"][res]["hdr"]["url"]
        urllib.request.urlretrieve(url, path)
    return path


def world_hdri(path, strength=1.0, rotation_deg=0.0):
    w = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value[2] = math.radians(rotation_deg)
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(path, check_existing=True)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs[0], env.inputs[0])
    nt.links.new(env.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    return w


def world_sky(sun_elevation=35.0, sun_rotation=200.0, strength=0.6):
    w = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    sky = nt.nodes.new("ShaderNodeTexSky")
    for attr, val in (("sky_type", "NISHITA"), ("sky_type", "MULTIPLE_SCATTERING"), ("sky_type", "SINGLE_SCATTERING")):
        try:
            sky.sky_type = val
            break
        except TypeError:
            continue
    sky.sun_elevation = math.radians(sun_elevation)
    sky.sun_rotation = math.radians(sun_rotation)
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(sky.outputs[0], bg.inputs[0])
    nt.links.new(bg.outputs[0], out.inputs[0])
    return w


def look_at(ob, target):
    d = Vector(target) - ob.location
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def camera(name, loc, target, focal=85.0, fstop=None, focus=None, sensor=36.0):
    cam = bpy.data.objects.get(name)
    if cam is None:
        cam = bpy.data.objects.new(name, bpy.data.cameras.new(name))
        bpy.context.scene.collection.objects.link(cam)
    cam.location = loc
    look_at(cam, target)
    cam.data.lens = focal
    cam.data.sensor_width = sensor
    cam.data.clip_start = 0.01
    if fstop:
        cam.data.dof.use_dof = True
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.focus_distance = focus if focus else (Vector(target) - Vector(loc)).length
    else:
        cam.data.dof.use_dof = False
    bpy.context.scene.camera = cam
    return cam


def area_light(name, loc, target, power, size=1.0, color=(1, 1, 1), shape="RECTANGLE", size_y=None, spread=180.0):
    lt = bpy.data.objects.get(name)
    if lt is None:
        lt = bpy.data.objects.new(name, bpy.data.lights.new(name, "AREA"))
        bpy.context.scene.collection.objects.link(lt)
    lt.data.energy = power
    lt.data.color = color
    lt.data.shape = shape
    lt.data.size = size
    lt.data.size_y = size_y if size_y else size
    lt.data.spread = math.radians(spread)
    lt.location = loc
    look_at(lt, target)
    return lt


def sun_light(name, elevation, azimuth, strength=3.0, angle=0.6, color=(1.0, 0.96, 0.9)):
    lt = bpy.data.objects.get(name)
    if lt is None:
        lt = bpy.data.objects.new(name, bpy.data.lights.new(name, "SUN"))
        bpy.context.scene.collection.objects.link(lt)
    lt.data.energy = strength
    lt.data.angle = math.radians(angle)
    lt.data.color = color
    lt.rotation_euler = (math.radians(90 - elevation), 0, math.radians(azimuth))
    return lt


def clear_lights():
    for ob in list(bpy.data.objects):
        if ob.type == "LIGHT":
            bpy.data.objects.remove(ob)


def studio_portrait(head_center, key_power=60.0):
    """Classic three-point portrait: big soft key camera-left-high, weak fill, two rim lights."""
    clear_lights()
    hc = Vector(head_center)
    area_light("Key", hc + Vector((-0.9, -1.1, 0.55)), hc, key_power, size=1.0, color=(1.0, 0.97, 0.93))
    area_light("Fill", hc + Vector((1.2, -0.9, 0.0)), hc, key_power * 0.18, size=1.4, color=(0.92, 0.96, 1.0))
    area_light("RimL", hc + Vector((-0.7, 0.9, 0.35)), hc, key_power * 0.55, size=0.35, size_y=1.2)
    area_light("RimR", hc + Vector((0.8, 0.8, 0.30)), hc, key_power * 0.45, size=0.35, size_y=1.2)


def portrait_hdri(head_center, name="studio_small_09", strength=0.7, rotation=0.0, key=22.0):
    """HDRI fill/reflections plus one soft key from camera-left-high (Rembrandt-ish modelling)."""
    clear_lights()
    world_hdri(hdri(name), strength, rotation)
    hc = Vector(head_center)
    if key > 0:
        area_light("Key", hc + Vector((-0.75, -0.95, 0.65)), hc, key, size=0.9, color=(1.0, 0.96, 0.92))
        area_light("Rim", hc + Vector((0.55, 0.85, 0.25)), hc, key * 0.6, size=0.3, size_y=1.0)


def render(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
