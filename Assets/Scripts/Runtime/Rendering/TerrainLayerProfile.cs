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
        public const int MaxLayers = 64;

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
            [Tooltip("Scales specular reflectance (F0 and grazing reflection). Vegetation should be low: it scatters rather than mirrors.")]
            [Range(0f, 1f)] public float specular;
            [Tooltip("Emission strength of the mask's alpha channel (glowcaps, torch embers).")]
            [Range(0f, 20f)] public float emission;
            [Tooltip("Sun light transmitted through thin surfaces (leaves, grass).")]
            [Range(0f, 2f)] public float translucency;
            [Tooltip("Multiply by the biome grass/foliage colour.")]
            public bool biomeTint;
            [Tooltip("Albedo alpha is opacity (alpha-tested) instead of height.")]
            public bool cutout;
            [Tooltip("Hide the texture's repeat with stochastic tiling (natural ground; costs extra samples, quality-dependent).")]
            public bool stochastic;
        }

        /// <summary>Current field layout. The scene builder fills in defaults for fields added since an asset's version.</summary>
        public const int CurrentVersion = 2;
        [HideInInspector] public int version = 1;

        public Layer[] layers = Array.Empty<Layer>();

        static readonly int ParamsId = Shader.PropertyToID("_VoxelLayerParams");
        static readonly int TintId = Shader.PropertyToID("_VoxelLayerTint");
        static readonly int Params2Id = Shader.PropertyToID("_VoxelLayerParams2");
        static readonly int Params3Id = Shader.PropertyToID("_VoxelLayerParams3");

        public void ApplyGlobals()
        {
            var p = new Vector4[MaxLayers];
            var t = new Vector4[MaxLayers];
            var p2 = new Vector4[MaxLayers];
            var p3 = new Vector4[MaxLayers];
            for (int i = 0; i < MaxLayers; i++)
            {
                if (i < layers.Length)
                {
                    var l = layers[i];
                    p[i] = new Vector4(1f / Mathf.Max(0.01f, l.blocksPerTile), l.normalStrength, l.roughnessScale, l.macroVariation);
                    Color lin = l.tint.linear;
                    t[i] = new Vector4(lin.r, lin.g, lin.b, l.specular);
                    p2[i] = new Vector4(l.emission, l.translucency, l.biomeTint ? 1 : 0, l.cutout ? 1 : 0);
                    p3[i] = new Vector4(l.stochastic ? 1 : 0, 0, 0, 0);
                }
                else
                {
                    p[i] = new Vector4(1f, 1f, 1f, 0.3f);
                    t[i] = Vector4.one;
                    p2[i] = Vector4.zero;
                }
            }
            Shader.SetGlobalVectorArray(ParamsId, p);
            Shader.SetGlobalVectorArray(TintId, t);
            Shader.SetGlobalVectorArray(Params2Id, p2);
            Shader.SetGlobalVectorArray(Params3Id, p3);
        }

        void OnValidate() => ApplyGlobals();
    }
}
