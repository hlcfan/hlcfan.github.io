"""Step 2 of the bake: light the exported scene in Cycles and write lightmaps.

Run: blender -b -P tools/bake/bake.py -- <scene.glb> <meta.json> <out dir> [samples]

Groups are the name prefix of each mesh (desk, pc, crt, props, wall). Each group is baked twice,
with the desk lamp on and off. The CRT glow is not baked: the runtime adds it as a light.

Output in <out dir>:
  lm_<group>_<state>.jpg  sRGB lightmap per group and lamp state (irradiance only, no albedo)
  geometry.glb            the meshes with a second UV set ("lm"), no materials
  bake.json               files and exposure per group
"""
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

SIZES = {"desk": 1024, "pc": 1024, "crt": 1024, "props": 2048, "wall": 512}
STATES = ["on", "off"]


def main():
    args = sys.argv[sys.argv.index("--") + 1:]
    glb, meta_path, out_dir = args[:3]
    samples = int(args[3]) if len(args) > 3 else 256
    meta = json.load(open(meta_path))
    os.makedirs(out_dir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    by_group = {}
    for o in meshes:
        by_group.setdefault(o.name.split("_")[0], []).append(o)
    print("meshes per group:", {g: len(v) for g, v in by_group.items()})

    setup_cycles(samples)
    lamp = setup_lights(meta, meshes)
    preview = os.environ.get("BAKE_PREVIEW")
    if preview:  # render the site camera view with the bake lights, then stop
        render_preview(preview)
        return

    for objs in by_group.values():
        unwrap(objs)

    manifest = {"geometry": "geometry.glb", "groups": {}}
    for group, objs in by_group.items():
        entry = {"states": {}}
        scale = None
        for state in STATES:
            lamp.data.energy = LAMP_WATTS if state == "on" else 0
            image = bake_group(group, objs, SIZES.get(group, 1024))
            # One exposure per group, taken from the lamp-on map, so the off map is darker.
            scale = scale or exposure_of(image)
            entry["states"][state] = write_lightmap(group, state, image, scale, out_dir)
        # The shoulder lowers mid-tones. The runtime gain puts the 99th percentile back.
        entry["exposure"] = scale * REF / shoulder(REF)
        manifest["groups"][group] = entry

    export_geometry(os.path.join(out_dir, "geometry.glb"))
    with open(os.path.join(out_dir, "bake.json"), "w") as f:
        json.dump(manifest, f, indent=2)
    print("bake done:", manifest)


def setup_cycles(samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 6
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "METAL"
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = "GPU"
    except Exception as e:  # CPU is slower but works
        print("GPU unavailable, using CPU:", e)


def render_preview(path):
    """Quick look at the lighting from the site camera. Tune lights here before a full bake."""
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("cam")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = math.radians(35)
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = to_blender((0, 58, 118))
    cam.rotation_euler = (to_blender((0, 22, 4)) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.render.filepath = path
    scene.view_settings.view_transform = "Standard"
    scene.cycles.use_denoising = True
    bpy.ops.render.render(write_still=True)


def to_blender(p):
    """three.js (x, y up, z) to Blender (x, -z, y up)."""
    return Vector((p[0], -p[2], p[1]))


LAMP_WATTS = 200000


def setup_lights(meta, meshes):
    world = bpy.data.worlds.new("night")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.02, 0.03, 0.07, 1)
    bg.inputs["Strength"].default_value = 0.35

    # Desk lamp: a warm point light inside the shade. The bulb itself must not block it.
    pos = to_blender(meta["lamp"])
    for o in meshes:
        center = sum((o.matrix_world @ Vector(c) for c in o.bound_box), Vector()) / 8
        if (center - pos).length < 3 and o.name.startswith("props"):
            o.visible_shadow = False
    lamp = add_light("lamp", "POINT", pos, (1.0, 0.66, 0.32), LAMP_WATTS, radius=1.5)

    # Window: dim blue moonlight from the wall window at the right, so the warm lamp and the cool
    # light split the scene. The light sits just in front of the glass, aimed at the desk.
    add_light("window", "AREA", to_blender((76, 28, -60)), (0.45, 0.6, 1.0), 60000,
              target=to_blender((0, 8, 8)), size=(30, 36))
    return lamp


def add_light(name, kind, loc, color, power, target=None, spot_deg=90, blend=0.5, radius=0, size=None):
    data = bpy.data.lights.new(name, kind)
    data.color = color
    data.energy = power
    if kind in ("SPOT", "POINT"):
        data.shadow_soft_size = radius
    if kind == "SPOT":
        data.spot_size = math.radians(spot_deg)
        data.spot_blend = blend
    if kind == "AREA":
        data.shape = "RECTANGLE"
        data.size, data.size_y = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    if target is not None:
        direction = target - loc
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


def unwrap(objs):
    """Add a second UV set to every mesh and pack all of them into one 0-1 space."""
    view = bpy.context.view_layer
    for o in view.objects:
        o.select_set(False)
    for o in objs:
        layer = o.data.uv_layers.new(name="lm")
        o.data.uv_layers.active = layer
        o.select_set(True)
    view.objects.active = objs[0]
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    # Lightmap Pack gives every face its own cell and fills the 0-1 square. Smart UV Project
    # squeezed the big desk faces into thin strips, which left most of the map empty.
    bpy.ops.uv.lightmap_pack(PREF_CONTEXT="ALL_FACES", PREF_PACK_IN_ONE=True, PREF_NEW_UVLAYER=False,
                             PREF_BOX_DIV=48, PREF_MARGIN_DIV=0.1)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_group(group, objs, size):
    image = bpy.data.images.new(f"lm_{group}", size, size, float_buffer=True)
    image.colorspace_settings.name = "Non-Color"
    for o in objs:
        for slot in o.material_slots:
            if not slot.material.get("lm_private"):
                slot.material = slot.material.copy()  # one material per object, so image nodes do not clash
                slot.material["lm_private"] = True
            mat = slot.material
            mat.use_nodes = True
            node = mat.node_tree.nodes.get("lm_target") or mat.node_tree.nodes.new("ShaderNodeTexImage")
            node.name = "lm_target"
            node.image = image
            mat.node_tree.nodes.active = node

    view = bpy.context.view_layer
    for o in view.objects:
        o.select_set(False)
    for o in objs:
        o.select_set(True)
        o.data.uv_layers.active = o.data.uv_layers["lm"]
    view.objects.active = objs[0]
    bpy.ops.object.bake(type="DIFFUSE", pass_filter={"DIRECT", "INDIRECT"}, margin=6, use_clear=True)
    return image


def pixels_of(image):
    w, h = image.size
    px = np.empty(w * h * 4, dtype=np.float32)
    image.pixels.foreach_get(px)
    return px.reshape(h, w, 4)


REF = 0.6      # the 99th percentile of lit texels maps to this value before the shoulder
WHITE = 2.0    # in units of REF-normalised light, where the shoulder reaches 1


def shoulder(x):
    """Extended Reinhard. Soft-clips hot spots, such as a speaker next to the lamp."""
    return x * (1 + x / (WHITE * WHITE)) / (1 + x)


def exposure_of(image):
    rgb = pixels_of(image)[..., :3]
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    lit = luma[luma > 1e-4]
    high = float(np.percentile(lit, 99)) if lit.size else 1.0
    return max(high / REF, 1e-6)


def write_lightmap(group, state, image, exposure, out_dir):
    w, h = image.size
    rgb = pixels_of(image)[..., :3]
    lin = np.clip(shoulder(rgb / exposure), 0, 1)
    srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)

    out = bpy.data.images.new(f"out_{group}_{state}", w, h, alpha=False)
    out.colorspace_settings.name = "Non-Color"
    out_px = np.ones((h, w, 4), dtype=np.float32)
    out_px[..., :3] = srgb
    out.pixels.foreach_set(out_px.ravel())
    name = f"lm_{group}_{state}.jpg"
    path = os.path.join(out_dir, name)
    out.filepath_raw = path
    out.file_format = "JPEG"
    bpy.context.scene.render.image_settings.quality = 80
    out.save()
    print(f"{group} {state}: exposure {exposure:.4f}, {os.path.getsize(path) // 1024} KB")
    return {"file": name}


def export_geometry(path):
    for o in list(bpy.data.objects):
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    for o in bpy.data.objects:
        for slot in o.material_slots:
            slot.material = None
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_materials="NONE",
        export_image_format="NONE",
        export_texcoords=True,
        export_normals=True,
        export_lights=False,
        export_cameras=False,
    )


main()
