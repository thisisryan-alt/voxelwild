"""FBX export for Unity.

One FBX per asset holding its LOD meshes as root objects named <Name>_LOD0..n; Unity's importer turns the
suffix into an LODGroup on the model prefab, and the prop library reads the meshes by name. Material slot
names become the FBX material names that PropLibraryBuilder maps to Voxelwild/Prop materials.

Axis conversion is baked into the vertices (+Z up in Blender -> +Y up in Unity) so every object imports with
an identity transform. The FBX header timestamp is pinned so re-exporting unchanged geometry gives
byte-identical files (no LFS churn).
"""

import datetime

import bpy

from . import common as C


class _FixedDatetime(datetime.datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(2026, 1, 1, 0, 0, 0)


class _FixedDatetimeModule:
    datetime = _FixedDatetime


def _pin_fbx_timestamp():
    import io_scene_fbx.export_fbx_bin as fbx_bin
    fbx_bin.datetime = _FixedDatetimeModule


def export_fbx(objects, path):
    _pin_fbx_timestamp()
    for o in objects:
        o.location = (0, 0, 0)
        o.rotation_euler = (0, 0, 0)
        o.scale = (1, 1, 1)
    C.select_only(*objects)
    bpy.ops.export_scene.fbx(
        filepath=path,
        use_selection=True,
        object_types={"MESH"},
        apply_unit_scale=True,
        apply_scale_options="FBX_SCALE_ALL",
        axis_forward="-Z",
        axis_up="Y",
        bake_space_transform=True,
        use_mesh_modifiers=True,
        mesh_smooth_type="OFF",          # explicit normals; Unity imports them as authored
        use_tspace=False,                # Unity computes MikkTSpace tangents, matching Blender's bake
        colors_type="SRGB",
        prioritize_active_color=True,
        use_triangles=True,
        add_leaf_bones=False,
        bake_anim=False,
        use_custom_props=False,
        path_mode="STRIP",
        embed_textures=False,
    )
