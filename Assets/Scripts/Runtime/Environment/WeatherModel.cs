using System;
using Unity.Mathematics;

namespace Voxelwild.Rendering
{
    public enum WeatherKind { Clear, Cloudy, Rain, HeavyRain, Storm, Fog }

    /// <summary>What a weather state looks like at full strength.</summary>
    public struct WeatherParams
    {
        public float CloudCoverage;
        public float CloudDensity;
        /// <summary>Precipitation 0..1 (falls as rain or snow depending on the local climate).</summary>
        public float Precipitation;
        /// <summary>Height-fog density multiplier.</summary>
        public float Fog;
        /// <summary>Distance-fog range multiplier (below 1 pulls the fog in).</summary>
        public float FogDistance;
        public float WindStrength;
        public float Gustiness;
        /// <summary>Sun/moon light multiplier.</summary>
        public float Light;
        /// <summary>Mean seconds between lightning strikes; 0 = none.</summary>
        public float LightningInterval;

        public static WeatherParams Lerp(in WeatherParams a, in WeatherParams b, float t) => new WeatherParams
        {
            CloudCoverage = math.lerp(a.CloudCoverage, b.CloudCoverage, t),
            CloudDensity = math.lerp(a.CloudDensity, b.CloudDensity, t),
            Precipitation = math.lerp(a.Precipitation, b.Precipitation, t),
            Fog = math.lerp(a.Fog, b.Fog, t),
            FogDistance = math.lerp(a.FogDistance, b.FogDistance, t),
            WindStrength = math.lerp(a.WindStrength, b.WindStrength, t),
            Gustiness = math.lerp(a.Gustiness, b.Gustiness, t),
            Light = math.lerp(a.Light, b.Light, t),
            LightningInterval = t < 0.5f ? a.LightningInterval : b.LightningInterval,
        };
    }

    /// <summary>
    /// The weather over time: a seeded Markov chain of <see cref="WeatherKind"/> states lasting a few game hours
    /// each, blended over <see cref="TransitionSeconds"/>, plus surface state that lags behind the sky: ground
    /// gets wet while it rains and dries afterwards, puddles form only after sustained rain, snow settles while
    /// it snows and melts when it stops. Lightning strikes at random during storms.
    /// Engine-free: WeatherSystem applies it, tests drive it directly.
    /// </summary>
    public sealed class WeatherModel
    {
        public const float TransitionSeconds = 60f;
        public const float MinStateSeconds = 240f;
        public const float MaxStateSeconds = 720f;

        public static readonly WeatherParams[] Presets =
        {
            // Clear: fair-weather clouds (the Phase 4 default cover)
            new WeatherParams { CloudCoverage = 0.42f, CloudDensity = 0.9f, Precipitation = 0f, Fog = 1f, FogDistance = 1f, WindStrength = 0.07f, Gustiness = 0.8f, Light = 1f },
            // Cloudy
            new WeatherParams { CloudCoverage = 0.72f, CloudDensity = 0.95f, Precipitation = 0f, Fog = 1.4f, FogDistance = 0.95f, WindStrength = 0.1f, Gustiness = 0.9f, Light = 0.8f },
            // Rain
            new WeatherParams { CloudCoverage = 0.9f, CloudDensity = 1f, Precipitation = 0.5f, Fog = 2.2f, FogDistance = 0.8f, WindStrength = 0.13f, Gustiness = 1f, Light = 0.55f },
            // HeavyRain
            new WeatherParams { CloudCoverage = 1f, CloudDensity = 1f, Precipitation = 1f, Fog = 3.2f, FogDistance = 0.6f, WindStrength = 0.18f, Gustiness = 1f, Light = 0.4f },
            // Storm
            new WeatherParams { CloudCoverage = 1f, CloudDensity = 1f, Precipitation = 1f, Fog = 3.5f, FogDistance = 0.55f, WindStrength = 0.32f, Gustiness = 1f, Light = 0.3f, LightningInterval = 14f },
            // Fog
            new WeatherParams { CloudCoverage = 0.6f, CloudDensity = 0.8f, Precipitation = 0f, Fog = 9f, FogDistance = 0.3f, WindStrength = 0.02f, Gustiness = 0.3f, Light = 0.7f },
        };

        // row = from, column = to (Clear, Cloudy, Rain, HeavyRain, Storm, Fog)
        static readonly float[,] Transitions =
        {
            { 0.30f, 0.55f, 0.00f, 0.00f, 0.00f, 0.15f },
            { 0.35f, 0.20f, 0.35f, 0.00f, 0.00f, 0.10f },
            { 0.00f, 0.45f, 0.20f, 0.25f, 0.10f, 0.00f },
            { 0.00f, 0.20f, 0.50f, 0.00f, 0.30f, 0.00f },
            { 0.00f, 0.00f, 0.50f, 0.50f, 0.00f, 0.00f },
            { 0.50f, 0.50f, 0.00f, 0.00f, 0.00f, 0.00f },
        };

        public static float TransitionProbability(WeatherKind from, WeatherKind to) => Transitions[(int)from, (int)to];

        readonly System.Random _rng;
        float _stateTime, _stateLength, _blend = 1f, _nextLightning;
        WeatherParams _from;

        public WeatherKind Current { get; private set; }
        public WeatherKind Previous { get; private set; }
        public WeatherParams Params { get; private set; }
        /// <summary>0..1 surface wetness (terrain darkens and turns glossy).</summary>
        public float Wetness { get; private set; }
        /// <summary>0..1 how much standing water collects on flat ground.</summary>
        public float Puddles { get; private set; }
        /// <summary>0..1 settled snow.</summary>
        public float SnowCover { get; private set; }
        /// <summary>True while the chain is held on one state (captures, debug).</summary>
        public bool Frozen { get; set; }
        /// <summary>Seconds left in the current state.</summary>
        public float TimeLeft => math.max(0f, _stateLength - _stateTime);

        public WeatherModel(int seed, WeatherKind start = WeatherKind.Clear)
        {
            _rng = new System.Random(seed);
            Current = Previous = start;
            Params = _from = Presets[(int)start];
            _stateLength = NextLength();
            _nextLightning = NextLightning(Params);
        }

        float NextLength() => (float)(MinStateSeconds + _rng.NextDouble() * (MaxStateSeconds - MinStateSeconds));

        float NextLightning(in WeatherParams p) =>
            p.LightningInterval <= 0f ? float.MaxValue : (float)(-Math.Log(1.0 - _rng.NextDouble() * 0.999) * p.LightningInterval);

        /// <summary>Switches immediately-ish (still blended) to a state, e.g. from a debug key.</summary>
        public void ForceState(WeatherKind kind)
        {
            BeginTransition(kind);
            _stateLength = NextLength();
        }

        void BeginTransition(WeatherKind next)
        {
            _from = Params;
            Previous = Current;
            Current = next;
            _blend = 0f;
            _stateTime = 0f;
        }

        WeatherKind PickNext()
        {
            double r = _rng.NextDouble();
            double acc = 0;
            for (int j = 0; j < Presets.Length; j++)
            {
                acc += Transitions[(int)Current, j];
                if (r < acc) return (WeatherKind)j;
            }
            return Current;
        }

        /// <summary>
        /// Advances by <paramref name="dt"/> seconds. <paramref name="cold"/>: precipitation falls as snow here.
        /// <paramref name="sun"/> (0..1) speeds up drying and melting. Returns true when lightning strikes this step.
        /// </summary>
        public bool Step(float dt, bool cold, float sun = 1f)
        {
            if (!Frozen)
            {
                _stateTime += dt;
                if (_stateTime >= _stateLength)
                {
                    BeginTransition(PickNext());
                    _stateLength = NextLength();
                }
            }
            _blend = math.min(1f, _blend + dt / TransitionSeconds);
            var target = Presets[(int)Current];
            Params = WeatherParams.Lerp(_from, target, math.smoothstep(0f, 1f, _blend));

            float rain = cold ? 0f : Params.Precipitation;
            float snow = cold ? Params.Precipitation : 0f;
            // wet in about a minute of rain, dry over a few minutes (faster in sun)
            Wetness = rain > 0.05f
                ? math.min(1f, Wetness + dt * rain / 60f)
                : math.max(0f, Wetness - dt * (0.2f + 0.8f * sun) / 240f);
            // puddles need the ground soaked first
            float puddleTarget = Wetness > 0.8f ? math.saturate(rain * 1.2f) : 0f;
            Puddles = puddleTarget > Puddles ? math.min(puddleTarget, Puddles + dt / 120f) : math.max(puddleTarget, Puddles - dt / 180f);
            SnowCover = snow > 0.05f
                ? math.min(1f, SnowCover + dt * snow / 150f)
                : math.max(0f, SnowCover - dt * (cold ? 0f : 0.2f + 0.8f * sun) / 300f);

            if (Params.LightningInterval <= 0f)
            {
                _nextLightning = float.MaxValue;
                return false;
            }
            if (_nextLightning == float.MaxValue) _nextLightning = NextLightning(Params);
            _nextLightning -= dt;
            if (_nextLightning > 0f) return false;
            _nextLightning = NextLightning(Params);
            return true;
        }

        /// <summary>Snow instead of rain where it's cold enough: temperature (0..1 biome climate) or altitude.</summary>
        public static bool IsCold(float temperature01, float altitude) =>
            temperature01 < 0.22f || altitude > 150f - temperature01 * 40f;
    }
}
