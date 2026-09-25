using UnityEngine;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Keeps the ambient probe and skybox reflection in sync with RenderSettings and publishes the
    /// global voxel lighting parameters (block-light colour, wind). The world has no baked lighting, so
    /// this is what makes ambient light correct in builds. Phase 4 (day/night) and Phase 6 (weather)
    /// extend this into the time-of-day and weather drivers.
    /// </summary>
    [RequireComponent(typeof(Light))]
    public sealed class EnvironmentLighting : MonoBehaviour
    {
        [Tooltip("Colour of torch / glowcap voxel light.")]
        [SerializeField] Color blockLightColor = new Color(1f, 0.83f, 0.64f);
        [SerializeField, Range(0f, 8f)] float blockLightIntensity = 1.8f;
        [SerializeField] Vector2 windDirection = new Vector2(0.8f, 0.6f);
        [SerializeField, Range(0f, 0.5f)] float windStrength = 0.07f;
        [SerializeField, Range(0f, 1f)] float gustiness = 0.8f;

        static readonly int BlockLightId = Shader.PropertyToID("_VoxelBlockLightColor");
        static readonly int WindId = Shader.PropertyToID("_VoxelWind");
        static readonly int WeatherId = Shader.PropertyToID("_VoxelWeather");

        void Start()
        {
            RenderSettings.sun = GetComponent<Light>();
            DynamicGI.UpdateEnvironment();
            // dry and snow-free until a WeatherSystem takes over; w tells shaders which layer is snow
            Shader.SetGlobalVector(WeatherId, new Vector4(0f, 0f, 0f, (int)Voxelwild.World.TextureLayer.Snow));
            Apply();
        }

        /// <summary>Wind direction (x, z) and strength; the weather drives these.</summary>
        public Vector2 WindDirection { get => windDirection; set { windDirection = value; Apply(); } }
        public float WindStrength { get => windStrength; set { windStrength = value; Apply(); } }
        public float Gustiness { get => gustiness; set { gustiness = value; Apply(); } }

        void OnValidate() => Apply();

        void Apply()
        {
            Shader.SetGlobalVector(BlockLightId, (Vector4)(blockLightColor.linear * blockLightIntensity));
            var d = windDirection.sqrMagnitude > 0 ? windDirection.normalized : Vector2.right;
            Shader.SetGlobalVector(WindId, new Vector4(d.x, windStrength, d.y, gustiness));
        }
    }
}
