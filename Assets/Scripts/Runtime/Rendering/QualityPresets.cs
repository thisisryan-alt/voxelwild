namespace Voxelwild.Rendering
{
    /// <summary>One quality level. Engine-free data; <see cref="QualityManager"/> applies it.</summary>
    public struct QualityPreset
    {
        public string Name;
        public float RenderScale;
        public float ShadowDistance;
        public int ShadowCascades;
        public bool SoftShadows;
        public bool Ssao;
        /// <summary>Columns loaded around the player.</summary>
        public int ViewDistance;
        /// <summary>Sections around the camera that keep inner leaf faces.</summary>
        public int FancyLeavesDistance;
        /// <summary>Multiplies every prop kind's draw and LOD distances.</summary>
        public float PropDistanceScale;
        public bool StochasticTiling;
        public bool CloudShadows;
        public bool Smaa;
    }

    /// <summary>
    /// Low → Cinematic. High is the Phase 2 configuration the performance numbers in the README were measured
    /// with, so the default look is unchanged. Each step up costs more on every axis (enforced by a test).
    /// The capture tool's -vwToggles A/B runs measure what each setting costs.
    /// </summary>
    public static class QualityPresets
    {
        public const int Default = 2;

        public static readonly QualityPreset[] All =
        {
            new QualityPreset
            {
                Name = "Low", RenderScale = 0.75f, ShadowDistance = 50f, ShadowCascades = 2, SoftShadows = false, Ssao = false,
                ViewDistance = 6, FancyLeavesDistance = 0, PropDistanceScale = 0.5f, StochasticTiling = false,
                CloudShadows = false, Smaa = false,
            },
            new QualityPreset
            {
                Name = "Medium", RenderScale = 0.9f, ShadowDistance = 80f, ShadowCascades = 2, SoftShadows = true, Ssao = false,
                ViewDistance = 8, FancyLeavesDistance = 1, PropDistanceScale = 0.75f, StochasticTiling = false,
                CloudShadows = true, Smaa = true,
            },
            new QualityPreset
            {
                Name = "High", RenderScale = 1f, ShadowDistance = 110f, ShadowCascades = 4, SoftShadows = true, Ssao = true,
                ViewDistance = 10, FancyLeavesDistance = 2, PropDistanceScale = 1f, StochasticTiling = true,
                CloudShadows = true, Smaa = true,
            },
            new QualityPreset
            {
                Name = "Ultra", RenderScale = 1f, ShadowDistance = 160f, ShadowCascades = 4, SoftShadows = true, Ssao = true,
                ViewDistance = 14, FancyLeavesDistance = 3, PropDistanceScale = 1.3f, StochasticTiling = true,
                CloudShadows = true, Smaa = true,
            },
            new QualityPreset
            {
                Name = "Cinematic", RenderScale = 1.25f, ShadowDistance = 220f, ShadowCascades = 4, SoftShadows = true, Ssao = true,
                ViewDistance = 18, FancyLeavesDistance = 4, PropDistanceScale = 1.6f, StochasticTiling = true,
                CloudShadows = true, Smaa = true,
            },
        };

        public static int Clamp(int index) => index < 0 ? 0 : index >= All.Length ? All.Length - 1 : index;

        public static int Find(string name)
        {
            for (int i = 0; i < All.Length; i++)
                if (string.Equals(All[i].Name, name, System.StringComparison.OrdinalIgnoreCase)) return i;
            return -1;
        }

        /// <summary>Fog runs out with the view distance so the edge of the loaded world is never visible.</summary>
        public static (float start, float end) FogRange(int viewDistance) => (viewDistance * 14f, viewDistance * 33f);
    }
}
