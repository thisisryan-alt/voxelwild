using Unity.Collections;

namespace Voxelwild.World
{
    // Kept apart from the block table so BlockDefinition.cs stays engine-free (tests run it outside Unity).
    public static partial class BlockRegistry
    {
        public static NativeArray<BlockDefinition> CreateNative(Allocator allocator)
        {
            var arr = new NativeArray<BlockDefinition>(Table.Length, allocator);
            for (int i = 0; i < Table.Length; i++) arr[i] = Table[i].def;
            return arr;
        }
    }
}
