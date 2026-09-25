using Unity.Mathematics;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Runs the day: moves the directional light between sun and moon, colours it through the atmosphere,
    /// drives trilight ambient and fog from <see cref="SkyModel"/>, builds the scattering table for the
    /// Voxelwild/Sky shader once, drifts the clouds with the wind, and keeps the skybox reflection current.
    /// Weather (Phase 6) adjusts cloud cover and fog through the public properties.
    /// Debug keys: T jumps an hour ahead (Shift+T back), P pauses time.
    /// </summary>
    [RequireComponent(typeof(Light))]
    [DefaultExecutionOrder(-50)]
    public sealed class DayNightCycle : MonoBehaviour
    {
        [Header("Time")]
        [SerializeField, Range(0f, 1f)] float timeOfDay = 0.35f;
        [Tooltip("Real minutes per game day.")]
        [SerializeField, Min(0.1f)] float dayLengthMinutes = 20f;
        [SerializeField] bool paused;
        [Tooltip("How far the sun's path leans south; noon elevation is 90 minus this.")]
        [SerializeField, Range(0f, 60f)] float tilt = 35f;

        [Header("Sky")]
        [SerializeField] float skyExposure = 28f;
        [SerializeField] float sunDiscIntensity = 60f;

        [Header("Clouds")]
        [SerializeField, Range(0f, 1f)] float cloudCoverage = 0.42f;
        [SerializeField, Range(0f, 1f)] float cloudDensity = 0.9f;
        [SerializeField] float cloudAltitude = 300f;
        [SerializeField] float cloudFeatureSize = 700f;
        [SerializeField, Range(0f, 1f)] float cloudShadowStrength = 0.55f;
        [SerializeField] bool cloudShadows = true;

        [Header("Height fog")]
        [SerializeField] float fogBaseHeight = 64f;
        [SerializeField] float fogFalloff = 0.02f;
        [SerializeField] float fogDensity = 0.0012f;
        [SerializeField, Range(0f, 1f)] float fogSunScatter = 0.6f;

        [Tooltip("Seconds between skybox reflection refreshes while time runs.")]
        [SerializeField] float reflectionInterval = 4f;

        static readonly int SunDirId = Shader.PropertyToID("_VoxelSunDir");
        static readonly int MoonDirId = Shader.PropertyToID("_VoxelMoonDir");
        static readonly int SunColorId = Shader.PropertyToID("_VoxelSunColor");
        static readonly int SunTransmittanceId = Shader.PropertyToID("_VoxelSunTransmittance");
        static readonly int AmbientSkyId = Shader.PropertyToID("_VoxelAmbientSkyColor");
        static readonly int SkyParamsId = Shader.PropertyToID("_VoxelSkyParams");
        static readonly int CloudsId = Shader.PropertyToID("_VoxelClouds");
        static readonly int CloudOffsetId = Shader.PropertyToID("_VoxelCloudOffset");
        static readonly int FogParamsId = Shader.PropertyToID("_VoxelFogParams");
        static readonly int FogSunId = Shader.PropertyToID("_VoxelFogSun");
        static readonly int SkyLutId = Shader.PropertyToID("_VoxelSkyLut");
        static readonly int WindId = Shader.PropertyToID("_VoxelWind");

        Light _light;
        Texture2D _lut;
        double _days;
        float2 _cloudOffset;
        float _nextReflection;

        public SkyState State { get; private set; }
        public bool Paused { get => paused; set => paused = value; }
        /// <summary>Days since the world began; the fraction is the time of day.</summary>
        public double Days { get => _days; set => _days = value; }
        public float TimeOfDay
        {
            get => (float)(_days - math.floor(_days));
            set => _days = math.floor(_days) + math.frac(value);
        }
        public float CloudCoverage { get => cloudCoverage; set => cloudCoverage = math.saturate(value); }
        public float CloudDensity { get => cloudDensity; set => cloudDensity = math.saturate(value); }
        /// <summary>Multiplies the height fog's density (weather fog, rain haze).</summary>
        public float FogDensityScale { get; set; } = 1f;
        /// <summary>Multiplies the sun and moon light (heavy overcast, storms).</summary>
        public float LightScale { get; set; } = 1f;

        void Awake()
        {
            _light = GetComponent<Light>();
            _days = 1.0 + timeOfDay;          // day 1: a waxing moon rather than a new one
            BuildLut();
        }

        void OnDestroy()
        {
            if (_lut != null) Destroy(_lut);
        }

        void BuildLut()
        {
            var data = AtmosphereModel.BuildLut();
            _lut = new Texture2D(AtmosphereModel.LutViewSize, AtmosphereModel.LutSunSize, TextureFormat.RGBAFloat, false, true)
            {
                name = "SkyScatteringLut", wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear,
            };
            var pixels = new Color[data.Length];
            for (int i = 0; i < data.Length; i++) pixels[i] = new Color(data[i].x, data[i].y, data[i].z, data[i].w);
            _lut.SetPixels(pixels);
            _lut.Apply(false, true);
            Shader.SetGlobalTexture(SkyLutId, _lut);
        }

        void Update()
        {
            var kb = Keyboard.current;
            if (kb != null)
            {
                if (kb.tKey.wasPressedThisFrame) _days += (kb.leftShiftKey.isPressed ? -1.0 : 1.0) / 24.0;
                if (kb.pKey.wasPressedThisFrame) paused = !paused;
            }
            if (!paused) _days += Time.deltaTime / (dayLengthMinutes * 60.0);

            // clouds drift with the wind (x,z direction, y strength)
            Vector4 wind = Shader.GetGlobalVector(WindId);
            float2 dir = math.normalizesafe(new float2(wind.x, wind.z), new float2(1, 0));
            _cloudOffset -= dir * (4f + wind.y * 90f) * Time.deltaTime;
            _cloudOffset = math.fmod(_cloudOffset, 1e5f);

            Apply();
            if (!paused && Time.time >= _nextReflection)
            {
                _nextReflection = Time.time + reflectionInterval;
                DynamicGI.UpdateEnvironment();
            }
        }

        void OnValidate()
        {
            if (Application.isPlaying && _light != null) Apply();
        }

        void Apply()
        {
            var s = SkyModel.Evaluate(_days, tilt);
            State = s;
            float3 lightDir = s.MoonIsLight ? s.MoonDirection : s.SunDirection;
            transform.rotation = Quaternion.LookRotation(-(Vector3)lightDir, Vector3.up);
            var linear = new Color(s.LightColor.x, s.LightColor.y, s.LightColor.z);
            _light.color = linear.gamma;
            _light.intensity = s.LightIntensity * LightScale;
            _light.shadowStrength = s.MoonIsLight ? 0.75f : 1f;

            RenderSettings.ambientSkyColor = ToColor(s.AmbientSky);
            RenderSettings.ambientEquatorColor = ToColor(s.AmbientEquator);
            RenderSettings.ambientGroundColor = ToColor(s.AmbientGround);
            RenderSettings.fogColor = ToColor(s.Fog);

            Shader.SetGlobalVector(SunDirId, new Vector4(s.SunDirection.x, s.SunDirection.y, s.SunDirection.z, _light.intensity));
            Shader.SetGlobalVector(MoonDirId, new Vector4(s.MoonDirection.x, s.MoonDirection.y, s.MoonDirection.z, s.MoonPhase));
            Shader.SetGlobalVector(SunColorId, (Vector4)(linear * _light.intensity));
            Shader.SetGlobalVector(SunTransmittanceId, new Vector4(s.SunTransmittance.x, s.SunTransmittance.y, s.SunTransmittance.z, 1f) * LightScale);
            Shader.SetGlobalVector(AmbientSkyId, (Vector4)ToColor(s.AmbientSky).linear);
            Shader.SetGlobalVector(SkyParamsId, new Vector4(skyExposure * math.lerp(0.35f, 1f, LightScale), s.StarVisibility * (1f - cloudCoverage * 0.8f),
                s.MoonIllumination, sunDiscIntensity));
            Shader.SetGlobalVector(CloudsId, new Vector4(cloudCoverage, cloudDensity, cloudAltitude, 1f / math.max(cloudFeatureSize, 1f)));
            Shader.SetGlobalVector(CloudOffsetId, new Vector4(_cloudOffset.x, _cloudOffset.y, cloudShadowStrength, cloudShadows ? 1f : 0f));
            Shader.SetGlobalVector(FogParamsId, new Vector4(fogBaseHeight, fogFalloff, fogDensity * FogDensityScale, fogSunScatter));
            Shader.SetGlobalVector(FogSunId, (Vector4)(linear * math.min(_light.intensity, 1.5f) + ToColor(s.Fog).linear * 0.5f));
        }

        /// <summary>Cloud shadows on or off (quality presets).</summary>
        public bool CloudShadows { get => cloudShadows; set => cloudShadows = value; }

        static Color ToColor(float3 c) => new Color(c.x, c.y, c.z);
    }
}
