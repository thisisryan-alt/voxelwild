using Unity.Mathematics;

namespace Voxelwild.Rendering
{
    /// <summary>What the sky looks like at one moment: light directions, colours and intensities.</summary>
    public struct SkyState
    {
        /// <summary>Unit vector toward the sun / moon.</summary>
        public float3 SunDirection, MoonDirection;
        public float SunElevationDeg;
        /// <summary>Linear colour of the directional light (sun by day, moon by night), max component 1.</summary>
        public float3 LightColor;
        public float LightIntensity;
        /// <summary>True while the directional light is the moon.</summary>
        public bool MoonIsLight;
        /// <summary>0 = new moon, 0.5 = full.</summary>
        public float MoonPhase;
        /// <summary>Lit fraction of the moon disc (0..1).</summary>
        public float MoonIllumination;
        /// <summary>Trilight ambient and fog colours (as authored RenderSettings colours).</summary>
        public float3 AmbientSky, AmbientEquator, AmbientGround, Fog;
        public float StarVisibility;
        /// <summary>Sun light after the atmosphere (for the sun disc), from <see cref="AtmosphereModel"/>.</summary>
        public float3 SunTransmittance;
    }

    /// <summary>
    /// Time of day → sky state. Pure math (no engine calls) so it runs in tests; DayNightCycle applies it.
    /// Time runs 0..1 per day: 0 midnight, 0.25 sunrise in the east (+X), 0.5 noon, 0.75 sunset in the west.
    /// The sun's path is tilted toward the south (-Z) by <c>tiltDeg</c>, so noon stands at 90° − tilt.
    /// The moon rides opposite the sun, offset a little, with an 8-day phase cycle.
    /// </summary>
    public static class SkyModel
    {
        public const int MoonCycleDays = 8;

        // RenderSettings colours tuned in Phase 2 (daylight), plus sunset and night keys
        static readonly float3 DaySky = new float3(0.50f, 0.62f, 0.80f) * 1.7f;
        static readonly float3 DayEquator = new float3(0.52f, 0.56f, 0.60f) * 1.35f;
        static readonly float3 DayGround = new float3(0.30f, 0.27f, 0.23f) * 1.1f;
        static readonly float3 DayFog = new float3(0.66f, 0.76f, 0.86f);
        static readonly float3 DuskSky = new float3(0.46f, 0.42f, 0.50f) * 1.1f;
        static readonly float3 DuskEquator = new float3(0.86f, 0.55f, 0.38f);
        static readonly float3 DuskGround = new float3(0.28f, 0.2f, 0.16f) * 0.8f;
        static readonly float3 DuskFog = new float3(0.86f, 0.62f, 0.48f);
        static readonly float3 NightSky = new float3(0.035f, 0.05f, 0.1f);
        static readonly float3 NightEquator = new float3(0.03f, 0.036f, 0.055f);
        static readonly float3 NightGround = new float3(0.016f, 0.015f, 0.014f);
        static readonly float3 NightFog = new float3(0.03f, 0.04f, 0.07f);
        static readonly float3 MoonColor = new float3(0.62f, 0.72f, 1f);
        static readonly float3 NoonSun = new float3(1.0f, 0.955f, 0.88f);

        public const float SunIntensity = 2.1f;
        public const float MoonIntensity = 0.28f;

        public static float3 SunDirection(float timeOfDay, float tiltDeg = 35f)
        {
            float a = (timeOfDay - 0.25f) * 2f * math.PI;
            float t = math.radians(tiltDeg);
            float s = math.sin(a);
            return math.normalize(new float3(math.cos(a), s * math.cos(t), -s * math.sin(t)));
        }

        public static float MoonPhase(double totalDays) => (float)(((totalDays % MoonCycleDays) + MoonCycleDays) % MoonCycleDays / MoonCycleDays);

        public static float MoonIllumination(float phase) => 0.5f - 0.5f * math.cos(phase * 2f * math.PI);

        /// <summary>Sky state for a moment; <paramref name="totalDays"/> is days since the world began (fraction = time of day).</summary>
        public static SkyState Evaluate(double totalDays, float tiltDeg = 35f)
        {
            float t = (float)(totalDays - math.floor(totalDays));
            var s = new SkyState();
            s.SunDirection = SunDirection(t, tiltDeg);
            s.MoonDirection = math.normalize(-s.SunDirection + new float3(0.1f, 0.12f, 0.15f));
            float e = math.degrees(math.asin(math.clamp(s.SunDirection.y, -1f, 1f)));
            s.SunElevationDeg = e;
            s.MoonPhase = MoonPhase(totalDays);
            s.MoonIllumination = MoonIllumination(s.MoonPhase);
            s.SunTransmittance = AtmosphereModel.Transmittance(s.SunDirection.y);

            float day = math.smoothstep(-6f, 10f, e);          // 0 night .. 1 day
            float dusk = math.exp(-math.pow(e / 9f, 2f)) * math.smoothstep(-10f, 0f, e);   // peaks at the horizon

            // light: the sun until it has set, then the moon
            float sunLight = math.smoothstep(-3f, 6f, e);
            if (sunLight > 0.001f)
            {
                float3 c = s.SunTransmittance;
                c /= math.max(math.cmax(c), 1e-4f);
                // low sun: the atmosphere's own reddening; high sun: the daylight colour tuned in Phase 2
                s.LightColor = math.saturate(math.lerp(c, NoonSun, math.smoothstep(15f, 45f, e)));
                s.LightIntensity = SunIntensity * sunLight;
            }
            else
            {
                s.MoonIsLight = true;
                float moonUp = math.smoothstep(-3f, 8f, math.degrees(math.asin(s.MoonDirection.y)));
                s.LightColor = MoonColor;
                s.LightIntensity = MoonIntensity * moonUp * math.max(0.15f, s.MoonIllumination);
            }

            float moonAmbient = 0.6f + 0.8f * s.MoonIllumination;
            float3 sky = math.lerp(NightSky * moonAmbient, DaySky, day);
            float3 equator = math.lerp(NightEquator * moonAmbient, DayEquator, day);
            float3 ground = math.lerp(NightGround, DayGround, day);
            float3 fog = math.lerp(NightFog * moonAmbient, DayFog, day);
            s.AmbientSky = math.lerp(sky, DuskSky, dusk * 0.8f);
            s.AmbientEquator = math.lerp(equator, DuskEquator, dusk);
            s.AmbientGround = math.lerp(ground, DuskGround, dusk * 0.7f);
            s.Fog = math.lerp(fog, DuskFog, dusk * 0.85f);
            s.StarVisibility = 1f - math.smoothstep(-12f, 2f, e);
            return s;
        }
    }
}
