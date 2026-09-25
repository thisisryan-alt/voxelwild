using System;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.InputSystem;
using Voxelwild.Player;
using Voxelwild.World;
using Voxelwild.World.Generation;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Drives <see cref="WeatherModel"/> and applies it: cloud cover and density, sun/moon strength and fog go to
    /// the day/night cycle, wind to EnvironmentLighting, wetness / puddles / snow cover to the shaders
    /// (<c>_VoxelWeather</c>), and rain or snow particles fall around the camera: snow where the local climate is
    /// cold. Particles stop under cover (a roof or canopy between the eye and the sky). Storms flash lightning.
    /// Debug: Y cycles the weather. Captures hold clear weather unless <c>-vwWeather</c> names another.
    /// </summary>
    [DefaultExecutionOrder(-40)]
    public sealed class WeatherSystem : MonoBehaviour
    {
        [SerializeField] DayNightCycle dayNight;
        [SerializeField] EnvironmentLighting environment;
        [SerializeField] QualityManager quality;
        [SerializeField] PlayerController player;
        [SerializeField] VoxelWorld world;
        [SerializeField] Light sun;
        [SerializeField] Shader precipitationShader;
        [SerializeField] int seed = 20260924;
        [SerializeField] WeatherKind startWeather = WeatherKind.Clear;
        [SerializeField] int maxRainParticles = 5000;
        [SerializeField] int maxSnowParticles = 3000;

        static readonly int WeatherId = Shader.PropertyToID("_VoxelWeather");
        static readonly int ShapeId = Shader.PropertyToID("_Shape");
        static readonly int OpacityId = Shader.PropertyToID("_Opacity");

        WeatherModel _model;
        ParticleSystem _rain, _snow;
        float _flash;
        bool _cold, _covered;

        public WeatherModel Model => _model;
        public bool Cold => _cold;
        public bool Covered => _covered;
        /// <summary>Raised on each lightning strike (thunder).</summary>
        public event Action Lightning;

        void Awake()
        {
            // each world gets its own weather: GameSession has set the world seed by now (it runs first)
            if (world != null) seed ^= (int)(world.Seed * 2654435761u);
            _model = new WeatherModel(seed, startWeather);
            var args = System.Environment.GetCommandLineArgs();
            if (Array.IndexOf(args, "-vwCapture") >= 0)
            {
                int w = Array.IndexOf(args, "-vwWeather");
                var kind = WeatherKind.Clear;
                if (w >= 0 && w + 1 < args.Length) Enum.TryParse(args[w + 1], true, out kind);
                _model = new WeatherModel(seed, kind) { Frozen = true };
            }
        }

        void Start()
        {
            if (precipitationShader == null) precipitationShader = Shader.Find("Voxelwild/Precipitation");
            var cam = Camera.main != null ? Camera.main.transform : transform;
            _rain = MakeParticles("Rain", cam, 0f, maxRainParticles);
            _snow = MakeParticles("Snow", cam, 1f, maxSnowParticles);
        }

        void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.yKey.wasPressedThisFrame)
                _model.ForceState((WeatherKind)(((int)_model.Current + 1) % WeatherModel.Presets.Length));

            float3 eye = player != null && player.Spawned ? player.EyePosition : (float3)transform.position;
            var climate = world != null ? TerrainNoise.SampleSurface(eye.xz, world.Seed) : default;
            _cold = WeatherModel.IsCold(climate.Temperature, eye.y);
            float sunUp = dayNight != null ? math.saturate(dayNight.State.SunElevationDeg / 30f) : 1f;
            if (_model.Step(Time.deltaTime, _cold, sunUp))
            {
                _flash = 1f;
                Lightning?.Invoke();
            }
            var p = _model.Params;

            if (dayNight != null)
            {
                dayNight.CloudCoverage = p.CloudCoverage;
                dayNight.CloudDensity = p.CloudDensity;
                dayNight.FogDensityScale = p.Fog;
                dayNight.LightScale = p.Light;
            }
            if (environment != null)
            {
                environment.WindStrength = p.WindStrength;
                environment.Gustiness = p.Gustiness;
            }
            if (quality != null)
            {
                var (start, end) = QualityPresets.FogRange(quality.Current.ViewDistance);
                RenderSettings.fogStartDistance = start * p.FogDistance;
                RenderSettings.fogEndDistance = end * p.FogDistance;
            }
            Shader.SetGlobalVector(WeatherId, new Vector4(_model.Wetness, _model.SnowCover, _model.Puddles, (int)TextureLayer.Snow));

            // under a roof or canopy: no rain or snow falling around the camera
            int? top = world != null ? world.GetHeightmap((int)math.floor(eye.x), (int)math.floor(eye.z)) : null;
            _covered = top.HasValue && top.Value >= eye.y;
            float fall = _covered ? 0f : p.Precipitation;
            SetRate(_rain, _cold ? 0f : fall, maxRainParticles / 1.1f);
            SetRate(_snow, _cold ? fall : 0f, maxSnowParticles / 6f);
            DriftWithWind(_rain, p.WindStrength * 30f);
            DriftWithWind(_snow, p.WindStrength * 12f);
            // the emitters ride on the camera; keep their spawn boxes level when the player looks up or down
            if (_rain != null) _rain.transform.rotation = Quaternion.identity;
            if (_snow != null) _snow.transform.rotation = Quaternion.identity;
        }

        void LateUpdate()
        {
            // lightning: a blue-white flash on top of whatever the day/night cycle set this frame
            if (_flash <= 0f) return;
            float f = _flash * _flash;
            RenderSettings.ambientSkyColor += new Color(0.6f, 0.65f, 0.8f) * (f * 3f);
            if (sun != null) sun.intensity += f * 1.5f;
            _flash = math.max(0f, _flash - Time.deltaTime * 4f);
        }

        ParticleSystem MakeParticles(string name, Transform parent, float shape, int max)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.transform.localPosition = new Vector3(0f, shape < 0.5f ? 14f : 10f, 0f);
            var ps = go.AddComponent<ParticleSystem>();
            ps.Stop(true, ParticleSystemStopBehavior.StopEmittingAndClear);
            var main = ps.main;
            main.loop = true;
            main.playOnAwake = true;
            main.maxParticles = max;
            main.simulationSpace = ParticleSystemSimulationSpace.World;
            main.startSpeed = 0f;
            main.gravityModifier = 0f;
            main.startLifetime = shape < 0.5f ? 1.4f : 7f;
            main.startSize = shape < 0.5f ? 0.035f : 0.06f;
            main.startColor = new Color(1f, 1f, 1f, 1f);
            var emission = ps.emission;
            emission.rateOverTime = 0f;
            var box = ps.shape;
            box.shapeType = ParticleSystemShapeType.Box;
            box.scale = new Vector3(40f, 1f, 40f);
            var vel = ps.velocityOverLifetime;
            vel.enabled = true;
            vel.space = ParticleSystemSimulationSpace.World;
            vel.x = new ParticleSystem.MinMaxCurve(0f);
            vel.y = new ParticleSystem.MinMaxCurve(shape < 0.5f ? -16f : -1.4f);
            vel.z = new ParticleSystem.MinMaxCurve(0f);
            if (shape > 0.5f)
            {
                var noise = ps.noise;
                noise.enabled = true;
                noise.strength = 0.6f;
                noise.frequency = 0.4f;
            }
            var r = go.GetComponent<ParticleSystemRenderer>();
            r.renderMode = shape < 0.5f ? ParticleSystemRenderMode.Stretch : ParticleSystemRenderMode.Billboard;
            r.velocityScale = shape < 0.5f ? 0.06f : 0f;
            r.lengthScale = 1f;
            r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            r.receiveShadows = false;
            if (precipitationShader != null)
            {
                var m = new Material(precipitationShader) { name = name + "Material" };
                m.SetFloat(ShapeId, shape);
                m.SetFloat(OpacityId, shape < 0.5f ? 0.3f : 0.85f);
                r.sharedMaterial = m;
            }
            ps.Play();
            return ps;
        }

        static void SetRate(ParticleSystem ps, float intensity, float maxRate)
        {
            if (ps == null) return;
            var e = ps.emission;
            e.rateOverTime = intensity * maxRate;
        }

        void DriftWithWind(ParticleSystem ps, float speed)
        {
            if (ps == null || environment == null) return;
            var v = ps.velocityOverLifetime;
            Vector2 d = environment.WindDirection.sqrMagnitude > 0 ? environment.WindDirection.normalized : Vector2.right;
            v.x = new ParticleSystem.MinMaxCurve(d.x * speed);
            v.z = new ParticleSystem.MinMaxCurve(d.y * speed);
        }
    }
}
