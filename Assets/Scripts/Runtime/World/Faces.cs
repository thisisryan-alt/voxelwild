using Unity.Mathematics;

namespace Voxelwild.World
{
    /// <summary>
    /// Face directions and their texture frames. T (u axis) and B (v axis) are chosen so a face
    /// viewed from outside has u to the right and v up. The HLSL copy in VoxelCommon.hlsl must match.
    /// </summary>
    public static class Faces
    {
        public const int PosX = 0, NegX = 1, PosY = 2, NegY = 3, PosZ = 4, NegZ = 5;

        public static int3 Normal(int face) => face switch
        {
            PosX => new int3(1, 0, 0),
            NegX => new int3(-1, 0, 0),
            PosY => new int3(0, 1, 0),
            NegY => new int3(0, -1, 0),
            PosZ => new int3(0, 0, 1),
            _ => new int3(0, 0, -1),
        };

        public static int3 Tangent(int face) => face switch
        {
            PosX => new int3(0, 0, 1),
            NegX => new int3(0, 0, -1),
            PosY => new int3(1, 0, 0),
            NegY => new int3(-1, 0, 0),
            PosZ => new int3(-1, 0, 0),
            _ => new int3(1, 0, 0),
        };

        public static int3 Bitangent(int face) =>
            face == PosY || face == NegY ? new int3(0, 0, 1) : new int3(0, 1, 0);
    }
}
