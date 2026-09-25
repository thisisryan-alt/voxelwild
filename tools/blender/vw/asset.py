"""Asset description shared by generators, the bake/export step and the manifest."""

from dataclasses import dataclass, field


@dataclass
class Slot:
    """One material slot. The Unity library builder turns it into a Voxelwild/Prop material.

    layer    TextureLayer name sampled from the block Texture2DArrays, or None for vertex colour only
    mapping  "triplanar" (world-space, continuous with terrain blocks), "uv" (UVTile, metres or 0..1 for end
             grain) or "vertex" (albedo from the Col attribute)
    tiling   UV multiplier: repeats per metre for triplanar and uv mappings
    moss     how much moss the baked moss mask may grow (0 = none)
    """
    name: str
    layer: str = None
    mapping: str = "triplanar"
    tiling: float = 0.5
    moss: float = 0.0
    tint: tuple = (1.0, 1.0, 1.0)
    roughness: float = 1.0
    foliage: bool = False      # double-sided, wind from Col.a, biome-tinted, softened normals

    def to_json(self):
        return {
            "name": self.name, "layer": self.layer, "mapping": self.mapping, "tiling": round(self.tiling, 4),
            "moss": round(self.moss, 3), "tint": [round(c, 3) for c in self.tint],
            "roughness": round(self.roughness, 3), "foliage": self.foliage,
        }


@dataclass
class Asset:
    name: str                  # <Category>_<Name>_<Variant>, e.g. Rock_Boulder_02
    kind: str                  # the prop kind the placement registry refers to, e.g. Rock_Boulder
    variant: int
    category: str              # output folder under Assets/Art/Models
    slots: list
    high: object = None        # high-poly bake source (optional)
    low: object = None         # game mesh LOD0 (optional: decimated from high when missing)
    lods: list = None          # explicit LOD meshes (plants), bypassing decimation
    lod_tris: list = field(default_factory=lambda: [800, 300, 100])
    bake_size: int = 256
    bake: bool = True          # AO / curvature / moss bake
    hang: bool = False         # ceiling prop: pivot at the attachment point, hangs down
    core: bool = False         # encloses a 1 m core block above the pivot (boulders)
    notes: dict = field(default_factory=dict)
