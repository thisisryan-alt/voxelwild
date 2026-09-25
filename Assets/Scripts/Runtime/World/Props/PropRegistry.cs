using Unity.Collections;
using Unity.Mathematics;
using Voxelwild.World.Generation;

namespace Voxelwild.World.Props
{
    public enum PropPlacement : byte
    {
        /// <summary>On the terrain surface, in the air cell above the ground block.</summary>
        Ground,
        /// <summary>On the floor of a cave, well below the surface.</summary>
        CaveFloor,
        /// <summary>Hanging from a cave ceiling; the pivot is the underside of the block above.</summary>
        CaveCeiling,
    }

    /// <summary>
    /// Where and how often one prop kind appears. Blittable so the decoration job reads it directly.
    /// The art (meshes, materials, LODs) lives in <see cref="PropLibrary"/>, keyed by <see cref="PropRegistry.Name"/>;
    /// generation never needs it, so worlds and tests generate identically with or without the models imported.
    /// </summary>
    public struct PropRule
    {
        public PropPlacement Placement;
        /// <summary>Variants the Blender generator makes (tools/blender, verified against the manifest by a test).</summary>
        public byte Variants;
        /// <summary>Candidate spacing in blocks: 1 = every surface cell may hold one; larger = at most one per
        /// Grid x Grid cell at a hashed position (keeps big props apart without neighbour lookups).</summary>
        public byte Grid;
        /// <summary>Probability per candidate.</summary>
        public float Chance;
        /// <summary>Chance multiplier in the rich biomes.</summary>
        public float RichFactor;
        /// <summary>Frequency (1/blocks) of the clumping noise; 0 = uniform.</summary>
        public float ClusterFrequency;
        /// <summary>Biomes allowed (bit per <see cref="Biome"/>); 0 = any (cave props).</summary>
        public uint Biomes;
        /// <summary>Biomes where Chance is multiplied by RichFactor.</summary>
        public uint RichBiomes;
        /// <summary>Block ids (bit per id below 64) the prop may stand on or hang from.</summary>
        public ulong Support;
        public float ScaleMin, ScaleMax;
        /// <summary>Air cells needed at the anchor and above it (below it for ceiling props).</summary>
        public byte Clearance;
        /// <summary>Half-length in cells along the prop's axis (fallen logs); the whole run needs flat support.</summary>
        public byte Footprint;
        /// <summary>Yaw snapped to 90 degrees (props with a footprint or barrier cells).</summary>
        public bool Cardinal;
        /// <summary>Block written at the anchor cell and hidden inside the mesh (boulders); Air = none.</summary>
        public ushort CoreBlock;
        /// <summary>PropBarrier cells written from the anchor upward (along the footprint) for collision.</summary>
        public byte BarrierHeight;
        /// <summary>Metres the prop is sunk below the anchor's floor (scaled with the prop).</summary>
        public float Sink;
        public float DrawDistance;
        public bool CastShadows;

        public bool InBiome(Biome b) => Biomes == 0 || (Biomes & (1u << (int)b)) != 0;
        public bool Rich(Biome b) => (RichBiomes & (1u << (int)b)) != 0;
        public bool Supports(ushort block) => block < 64 && (Support & (1ul << block)) != 0;
    }

    /// <summary>One placed prop. 20 bytes; a column holds a few hundred.</summary>
    public struct PropInstance
    {
        /// <summary>Anchor cell in world coordinates: the air cell the prop stands in (or hangs in), or the core cell.</summary>
        public int3 Cell;
        public byte Kind;
        public byte Variant;
        /// <summary>Yaw in 1/256 turns.</summary>
        public byte Yaw;
        /// <summary>Scale between the rule's min (0) and max (255).</summary>
        public byte Scale;
        /// <summary>Open cells available from the anchor along the prop's growth direction (formations pick
        /// the longest variant that fits).</summary>
        public byte Room;
        public byte Pad0, Pad1, Pad2;
    }

    /// <summary>The prop kinds. Append only: kind ids are stored with generated props.</summary>
    public static class PropRegistry
    {
        public const byte RockPebbles = 0;
        public const byte RockStone = 1;
        public const byte RockBoulder = 2;
        public const byte CaveStalactite = 3;
        public const byte CaveStalagmite = 4;
        public const byte TreeDead = 5;
        public const byte TreeStump = 6;
        public const byte TreeFallenLog = 7;
        public const byte PlantMushrooms = 8;
        public const byte PlantGrassClump = 9;
        public const byte PlantFlowerClump = 10;

        static uint Biomes(params Biome[] list)
        {
            uint m = 0;
            foreach (var b in list) m |= 1u << (int)b;
            return m;
        }

        static ulong Blocks(params ushort[] list)
        {
            ulong m = 0;
            foreach (var b in list) m |= 1ul << b;
            return m;
        }

        static readonly ulong Soil = Blocks(BlockId.Grass, BlockId.Dirt, BlockId.SnowyGrass, BlockId.Moss, BlockId.Mud);
        static readonly ulong Rocky = Blocks(BlockId.Grass, BlockId.Dirt, BlockId.SnowyGrass, BlockId.Stone, BlockId.Gravel,
            BlockId.Sand, BlockId.Snow, BlockId.Sandstone, BlockId.RedSandstone, BlockId.Moss);
        static readonly ulong CaveRock = Blocks(BlockId.Stone, BlockId.CoalOre, BlockId.IronOre, BlockId.GoldOre,
            BlockId.DiamondOre, BlockId.Sandstone, BlockId.RedSandstone, BlockId.Moss);

        static readonly uint Open = Biomes(Biome.Plains, Biome.Forest, Biome.DenseForest, Biome.Savanna, Biome.Taiga,
            Biome.SnowyTaiga, Biome.SnowyTundra, Biome.Mountains, Biome.SnowyPeaks, Biome.Desert, Biome.Badlands,
            Biome.Beach, Biome.SnowyBeach, Biome.River, Biome.Jungle, Biome.Swamp);
        static readonly uint Highland = Biomes(Biome.Mountains, Biome.SnowyPeaks, Biome.Taiga, Biome.SnowyTaiga,
            Biome.SnowyTundra, Biome.Badlands);
        static readonly uint Woods = Biomes(Biome.Forest, Biome.DenseForest, Biome.Taiga, Biome.SnowyTaiga, Biome.Jungle, Biome.Swamp);
        static readonly uint Meadow = Biomes(Biome.Plains, Biome.Forest, Biome.Savanna, Biome.Jungle, Biome.Swamp, Biome.Taiga);

        static readonly (string name, PropRule rule)[] Table =
        {
            ("Rock_Pebbles", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 4, Grid = 1, Chance = 0.012f, RichFactor = 2.5f,
                ClusterFrequency = 1f / 12f, Biomes = Open, RichBiomes = Highland | Biomes(Biome.Beach, Biome.River),
                Support = Rocky, ScaleMin = 0.8f, ScaleMax = 1.35f, Clearance = 1, Sink = 0.02f,
                DrawDistance = 48f, CastShadows = false,
            }),
            ("Rock_Stone", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 4, Grid = 1, Chance = 0.005f, RichFactor = 3f,
                ClusterFrequency = 1f / 16f, Biomes = Open, RichBiomes = Highland,
                Support = Rocky, ScaleMin = 0.8f, ScaleMax = 1.4f, Clearance = 1, Sink = 0.04f,
                DrawDistance = 110f, CastShadows = true,
            }),
            ("Rock_Boulder", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 4, Grid = 8, Chance = 0.1f, RichFactor = 3f,
                Biomes = Open & ~Biomes(Biome.Beach, Biome.SnowyBeach, Biome.River, Biome.Swamp),
                RichBiomes = Highland | Biomes(Biome.Plains),
                // scale >= 1 keeps the core block inside the mesh (the mesh encloses it at scale 1)
                Support = Rocky, ScaleMin = 1f, ScaleMax = 1.3f, Clearance = 2, CoreBlock = BlockId.Stone,
                DrawDistance = 260f, CastShadows = true,
            }),
            ("Cave_Stalactite", new PropRule
            {
                Placement = PropPlacement.CaveCeiling, Variants = 4, Grid = 1, Chance = 0.05f, RichFactor = 1f,
                ClusterFrequency = 1f / 10f, Support = CaveRock, ScaleMin = 0.8f, ScaleMax = 1.2f, Clearance = 2,
                DrawDistance = 72f, CastShadows = true,
            }),
            ("Cave_Stalagmite", new PropRule
            {
                Placement = PropPlacement.CaveFloor, Variants = 4, Grid = 1, Chance = 0.03f, RichFactor = 1f,
                ClusterFrequency = 1f / 10f, Support = CaveRock, ScaleMin = 0.8f, ScaleMax = 1.2f, Clearance = 2,
                DrawDistance = 72f, CastShadows = true,
            }),
            ("Tree_Dead", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 3, Grid = 9, Chance = 0.08f, RichFactor = 4f,
                Biomes = Biomes(Biome.Savanna, Biome.Desert, Biome.Badlands, Biome.SnowyTundra, Biome.Mountains, Biome.Plains),
                RichBiomes = Biomes(Biome.Savanna, Biome.Badlands),
                Support = Rocky, ScaleMin = 0.85f, ScaleMax = 1.15f, Clearance = 6, BarrierHeight = 2,
                Sink = 0.05f, DrawDistance = 260f, CastShadows = true,
            }),
            ("Tree_Stump", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 2, Grid = 6, Chance = 0.08f, RichFactor = 2f,
                Biomes = Woods | Biomes(Biome.Plains), RichBiomes = Biomes(Biome.Forest, Biome.Taiga),
                Support = Soil, ScaleMin = 0.9f, ScaleMax = 1.2f, Clearance = 2, BarrierHeight = 1,
                Sink = 0.05f, DrawDistance = 110f, CastShadows = true,
            }),
            ("Tree_FallenLog", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 2, Grid = 11, Chance = 0.2f, RichFactor = 1.5f,
                Biomes = Woods, RichBiomes = Biomes(Biome.Forest, Biome.DenseForest),
                Support = Soil, ScaleMin = 0.9f, ScaleMax = 1.1f, Clearance = 1, Footprint = 2, Cardinal = true,
                BarrierHeight = 1, Sink = 0.06f, DrawDistance = 160f, CastShadows = true,
            }),
            ("Plant_Mushrooms", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 3, Grid = 1, Chance = 0.004f, RichFactor = 3f,
                ClusterFrequency = 1f / 8f, Biomes = Woods, RichBiomes = Biomes(Biome.DenseForest, Biome.Swamp),
                Support = Soil, ScaleMin = 0.8f, ScaleMax = 1.4f, Clearance = 1, DrawDistance = 40f,
            }),
            ("Plant_GrassClump", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 2, Grid = 1, Chance = 0.03f, RichFactor = 2f,
                ClusterFrequency = 1f / 9f, Biomes = Meadow, RichBiomes = Biomes(Biome.Plains, Biome.Savanna),
                Support = Blocks(BlockId.Grass), ScaleMin = 0.8f, ScaleMax = 1.3f, Clearance = 1, Sink = 0.01f,
                DrawDistance = 56f,
            }),
            ("Plant_FlowerClump", new PropRule
            {
                Placement = PropPlacement.Ground, Variants = 2, Grid = 1, Chance = 0.008f, RichFactor = 2.5f,
                ClusterFrequency = 1f / 7f, Biomes = Biomes(Biome.Plains, Biome.Forest), RichBiomes = Biomes(Biome.Plains),
                Support = Blocks(BlockId.Grass), ScaleMin = 0.9f, ScaleMax = 1.2f, Clearance = 1, Sink = 0.01f,
                DrawDistance = 48f,
            }),
        };

        public static int Count => Table.Length;
        public static string Name(int kind) => kind < Table.Length ? Table[kind].name : $"Unknown({kind})";
        public static PropRule Get(int kind) => Table[kind].rule;

        public static int Find(string name)
        {
            for (int i = 0; i < Table.Length; i++)
                if (Table[i].name == name) return i;
            return -1;
        }

        public static NativeArray<PropRule> CreateNative(Allocator allocator)
        {
            var arr = new NativeArray<PropRule>(Table.Length, allocator);
            for (int i = 0; i < Table.Length; i++) arr[i] = Table[i].rule;
            return arr;
        }

        /// <summary>World-space scale of an instance.</summary>
        public static float ScaleOf(in PropRule rule, in PropInstance p) =>
            math.lerp(rule.ScaleMin, rule.ScaleMax, p.Scale / 255f);

        /// <summary>Yaw of an instance in radians (cardinal props are generated on 64/256 steps).</summary>
        public static float YawOf(in PropInstance p) => p.Yaw * (math.PI * 2f / 256f);

        /// <summary>
        /// True when an edit at <paramref name="cell"/> must remove the prop: the cell is the prop's anchor, core
        /// or barrier, the block it rests on or hangs from, or lies within its footprint.
        /// </summary>
        public static bool DependsOn(in PropRule rule, in PropInstance p, int3 cell)
        {
            int3 d = cell - p.Cell;
            int3 axis = FootprintAxis(p);
            int along = rule.Footprint > 0 ? math.csum(d * axis) : 0;
            int3 perp = d - axis * along;
            if (math.abs(along) > rule.Footprint) return false;
            if (perp.x != 0 || perp.z != 0) return false;
            if (rule.Placement == PropPlacement.CaveCeiling) return perp.y == 1 || perp.y == 0;
            int top = math.max(1, (int)rule.BarrierHeight) - 1;
            return perp.y >= -1 && perp.y <= top;
        }

        /// <summary>Unit cell step along a footprint prop's length (x or z); zero for single-cell props.</summary>
        public static int3 FootprintAxis(in PropInstance p) =>
            ((p.Yaw + 32) / 64) % 2 == 0 ? new int3(1, 0, 0) : new int3(0, 0, 1);
    }
}
