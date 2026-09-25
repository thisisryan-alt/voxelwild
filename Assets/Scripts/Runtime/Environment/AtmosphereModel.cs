using Unity.Mathematics;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Earth-like atmosphere, single scattering (Rayleigh + Mie), for the sky shader and the sun's colour.
    ///
    /// The sky shader reads a 2D table indexed by the cosine of the view zenith angle and of the sun zenith angle.
    /// Each texel holds the in-scattered light for a unit sun without the phase functions: Rayleigh RGB and Mie's red
    /// channel (Bruneton's trick: the shader rebuilds Mie's colour from the ratio of the scattering coefficients).
    /// The phase functions depend on the view–sun angle and are applied per pixel. The sun's zenith angle is taken
    /// as the same at every sample along the view ray (flat-sky approximation), which is what makes a 2D table enough.
    /// Pure math, no engine calls: the table is built once at startup and checked by tests.
    /// </summary>
    public static class AtmosphereModel
    {
        public const float PlanetRadius = 6360e3f;
        public const float AtmosphereRadius = 6420e3f;
        public const float ViewerAltitude = 200f;
        public static readonly float3 RayleighScattering = new float3(5.8e-6f, 13.5e-6f, 33.1e-6f);
        public const float RayleighHeight = 8000f;
        public const float MieScattering = 21e-6f;
        public const float MieExtinction = MieScattering * 1.11f;
        public const float MieHeight = 1200f;
        public const float MieG = 0.76f;

        public const int LutViewSize = 64;
        public const int LutSunSize = 64;
        const int ViewSamples = 24;
        const int SunSamples = 8;

        /// <summary>Distance from a point at radius r along direction cosine mu to the top of the atmosphere.</summary>
        static float DistanceToTop(float r, float mu)
        {
            float disc = r * r * (mu * mu - 1f) + AtmosphereRadius * AtmosphereRadius;
            return -r * mu + math.sqrt(math.max(disc, 0f));
        }

        /// <summary>Distance to the ground, or -1 when the ray misses the planet.</summary>
        static float DistanceToGround(float r, float mu)
        {
            float disc = r * r * (mu * mu - 1f) + PlanetRadius * PlanetRadius;
            if (mu >= 0f || disc < 0f) return -1f;
            return -r * mu - math.sqrt(disc);
        }

        static float3 Extinction(float rayleighDepth, float mieDepth) =>
            RayleighScattering * rayleighDepth + MieExtinction * mieDepth;

        /// <summary>Rayleigh and Mie optical depths (metres of scale-height-weighted path) from radius r along mu.</summary>
        static float2 OpticalDepth(float r, float mu)
        {
            if (DistanceToGround(r, mu) > 0f) return new float2(1e9f, 1e9f);    // blocked by the planet
            float len = DistanceToTop(r, mu);
            float ds = len / SunSamples;
            float2 depth = 0f;
            for (int i = 0; i < SunSamples; i++)
            {
                float d = (i + 0.5f) * ds;
                float ri = math.sqrt(r * r + d * d + 2f * r * mu * d);
                float h = ri - PlanetRadius;
                depth += new float2(math.exp(-h / RayleighHeight), math.exp(-h / MieHeight)) * ds;
            }
            return depth;
        }

        /// <summary>Fraction of sunlight reaching the viewer through the atmosphere, for a sun at cosine-zenith muSun.</summary>
        public static float3 Transmittance(float muSun)
        {
            var d = OpticalDepth(PlanetRadius + ViewerAltitude, muSun);
            return math.exp(-Extinction(d.x, d.y));
        }

        /// <summary>Table coordinate u (0..1) ↔ view cosine: squared around the horizon, where the sky changes fastest.</summary>
        public static float ViewMuFromU(float u)
        {
            float x = u * 2f - 1f;
            return x * math.abs(x);
        }

        public static float ViewUFromMu(float mu) => 0.5f + 0.5f * math.sign(mu) * math.sqrt(math.abs(mu));

        /// <summary>Table coordinate v (0..1) ↔ sun cosine, covering the sun from 0.35 below the horizon to overhead.</summary>
        public static float SunMuFromV(float v) => math.lerp(-0.35f, 1f, v);
        public static float SunVFromMu(float mu) => math.saturate((mu + 0.35f) / 1.35f);

        /// <summary>In-scattered light for a unit sun, without phase functions: xyz Rayleigh, w Mie (red channel).</summary>
        public static float4 InScatter(float muView, float muSun)
        {
            float r = PlanetRadius + ViewerAltitude;
            float ground = DistanceToGround(r, muView);
            float len = ground > 0f ? ground : DistanceToTop(r, muView);
            float ds = len / ViewSamples;
            float2 viewDepth = 0f;
            float3 rayleigh = 0f;
            float mie = 0f;
            for (int i = 0; i < ViewSamples; i++)
            {
                float d = (i + 0.5f) * ds;
                float ri = math.sqrt(r * r + d * d + 2f * r * muView * d);
                float h = ri - PlanetRadius;
                float2 density = new float2(math.exp(-h / RayleighHeight), math.exp(-h / MieHeight));
                viewDepth += density * ds;
                // flat-sky approximation: the sun has the same zenith angle at every sample
                var sunDepth = OpticalDepth(ri, muSun);
                float3 t = math.exp(-Extinction(viewDepth.x + sunDepth.x, viewDepth.y + sunDepth.y));
                rayleigh += t * density.x * ds;
                mie += t.x * density.y * ds;
            }
            return new float4(rayleigh * RayleighScattering, mie * MieScattering);
        }

        /// <summary>The whole table, row-major by sun (v), then view (u): LutViewSize x LutSunSize texels.</summary>
        public static float4[] BuildLut()
        {
            var lut = new float4[LutViewSize * LutSunSize];
            for (int j = 0; j < LutSunSize; j++)
            for (int i = 0; i < LutViewSize; i++)
            {
                float muView = ViewMuFromU((i + 0.5f) / LutViewSize);
                float muSun = SunMuFromV((j + 0.5f) / LutSunSize);
                lut[i + j * LutViewSize] = InScatter(muView, muSun);
            }
            return lut;
        }

        public static float RayleighPhase(float cosTheta) => 3f / (16f * math.PI) * (1f + cosTheta * cosTheta);

        public static float MiePhase(float cosTheta, float g = MieG)
        {
            float g2 = g * g;
            return 3f / (8f * math.PI) * (1f - g2) * (1f + cosTheta * cosTheta)
                   / ((2f + g2) * math.pow(math.max(1f + g2 - 2f * g * cosTheta, 1e-4f), 1.5f));
        }

        /// <summary>Sky radiance for a unit sun as the shader computes it from a table texel (used by tests).</summary>
        public static float3 Radiance(float4 texel, float cosTheta)
        {
            float3 mie = texel.w <= 0f ? float3.zero
                : texel.xyz * (texel.w / math.max(texel.x, 1e-12f))
                  * (RayleighScattering.x / MieScattering) * (MieScattering / RayleighScattering);
            return texel.xyz * RayleighPhase(cosTheta) + mie * MiePhase(cosTheta);
        }
    }
}
