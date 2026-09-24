using System;
using UnityEngine;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Per-texture-layer material tuning for the terrain shader. One profile drives every terrain
    /// layer, so materials are configured as data instead of hundreds of material assets.
    /// Uploaded as global vector arrays (index = TextureLayer).
    /// </summary>
    [CreateAssetMenu(menuName = "Voxelwild/Terrain Layer Profile", fileName = "TerrainLayerProfile")]
    public sealed class TerrainLayerProfile : ScriptableObject
    {
        public const int MaxLayers = 32;

        [Serializable]
        public struct Layer
        {
            public string name;
            [Tooltip("World blocks covered by one texture repeat. 1 = aligned to blocks (bricks, planks); 2-3 = continuous natural ground.")]
            [Range(0.25f, 8f)] public float blocksPerTile;
            [Range(0f, 2f)] public float normalStrength;
            [Tooltip("Multiplies the scanned roughness.")]
            [Range(0f, 2f)] public float roughnessScale;
            [Tooltip("Low-frequency brightness/hue variation that hides tiling.")]
            [Range(0f, 1f)] public float macroVariation;
            public Color tint;
        }

        public Layer[] layers = Array.Empty<Layer>();

        static readonly int ParamsId = Shader.PropertyToID("_VoxelLayerParams");
        static readonly int TintId = Shader.PropertyToID("_VoxelLayerTint");

        public void ApplyGlobals()
        {
            var p = new Vector4[MaxLayers];
            var t = new Vector4[MaxLayers];
            for (int i = 0; i < MaxLayers; i++)
            {
                if (i < layers.Length)
                {
                    var l = layers[i];
                    p[i] = new Vector4(1f / Mathf.Max(0.01f, l.blocksPerTile), l.normalStrength, l.roughnessScale, l.macroVariation);
                    t[i] = l.tint.linear;
                }
                else
                {
                    p[i] = new Vector4(1f, 1f, 1f, 0.3f);
                    t[i] = Vector4.one;
                }
            }
            Shader.SetGlobalVectorArray(ParamsId, p);
            Shader.SetGlobalVectorArray(TintId, t);
        }

        void OnValidate() => ApplyGlobals();
    }
}
