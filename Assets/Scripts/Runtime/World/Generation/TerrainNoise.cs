using Unity.Mathematics;

namespace Voxelwild.World.Generation
{
    /// <summary>
    /// Deterministic height field. Pure static math so it runs identically inside Burst jobs
    /// and on the main thread (spawn search, tests).
    ///
    /// Shape: a domain-warped "continentalness" field picks ocean / coast / inland base height,
    /// ridged noise builds mountain ranges where continentalness is high and erosion is low,
    /// and two octave bands add hills and small surface detail.
    /// </summary>
    public static class TerrainNoise
    {
        public static float2 SeedOffset(uint seed, uint salt)
        {
            uint h = math.hash(new uint2(seed, salt));
            uint h2 = math.hash(new uint2(h, salt ^ 0x9E3779B9u));
            return new float2(h & 0xFFFF, h2 & 0xFFFF) - 32768f;
        }

        public static float Fbm(float2 p, int octaves)
        {
            float sum = 0f, amp = 1f, norm = 0f;
            for (int i = 0; i < octaves; i++)
            {
                sum += amp * noise.snoise(p);
                norm += amp;
                amp *= 0.5f;
                // rotate + scale each octave to hide the lattice
                p = new float2(p.x * 1.6f - p.y * 1.2f, p.x * 1.2f + p.y * 1.6f);
            }
            return sum / norm;
        }

        /// <summary>Ridged multifractal in [0, 1]; sharp crests where the base noise crosses zero.</summary>
        public static float Ridged(float2 p, int octaves)
        {
            float sum = 0f, amp = 0.5f, weight = 1f, norm = 0f;
            for (int i = 0; i < octaves; i++)
            {
                float n = 1f - math.abs(noise.snoise(p));
                n *= n;
                n *= weight;
                weight = math.saturate(n * 2f);
                sum += n * amp;
                norm += amp;
                amp *= 0.5f;
                p = new float2(p.x * 1.7f - p.y * 1.1f, p.x * 1.1f + p.y * 1.7f);
            }
            return sum / norm;
        }

        /// <summary>Piecewise-linear remap of continentalness to base terrain height.</summary>
        static float ContinentalBase(float c)
        {
            // (continentalness, height) control points
            if (c < -0.45f) return 28f;
            if (c < -0.20f) return math.lerp(28f, 50f, (c + 0.45f) / 0.25f);
            if (c < -0.06f) return math.lerp(50f, 62f, (c + 0.20f) / 0.14f);
            if (c < 0.02f) return math.lerp(62f, 67f, (c + 0.06f) / 0.08f);
            if (c < 0.35f) return math.lerp(67f, 80f, (c - 0.02f) / 0.33f);
            return math.lerp(80f, 92f, math.saturate((c - 0.35f) / 0.4f));
        }

        public struct Sample
        {
            public float Height;
            public float Continentalness;
            public float MountainMask;
        }

        public static Sample SampleSurface(float2 xz, uint seed)
        {
            float2 p = xz + SeedOffset(seed, 1);

            float2 warp = new float2(
                Fbm(p * 0.0021f + SeedOffset(seed, 2) * 0.001f, 3),
                Fbm(p * 0.0021f + SeedOffset(seed, 3) * 0.001f, 3)) * 70f;
            float2 q = p + warp;

            float cont = Fbm(q * 0.00085f, 5) * 1.25f;
            float erosion = Fbm(q * 0.0017f + 311.7f, 4);
            float ridge = Ridged(q * 0.0019f + 719.3f, 4);
            float massif = Fbm(q * 0.0011f + 1733.1f, 3) * 0.5f + 0.5f;
            float hills = Fbm(q * 0.0085f + 51.1f, 4);
            float detail = Fbm(p * 0.045f + 97.5f, 2);

            float baseH = ContinentalBase(cont);
            float mountainMask = math.smoothstep(0.02f, 0.42f, cont) * math.smoothstep(0.35f, -0.30f, erosion);
            // Broad uplift (massif) carries the range; ridges add crests on top instead of isolated needles.
            float mountains = (massif * 38f + math.pow(ridge, 1.25f) * 72f) * mountainMask;
            float inland = math.smoothstep(-0.10f, 0.25f, cont);
            float hillAmp = math.lerp(3f, 15f, inland) * (1f - 0.6f * mountainMask) * math.lerp(1.2f, 0.6f, math.saturate(erosion * 0.5f + 0.5f));

            float h = baseH + mountains + hills * hillAmp + detail * 1.4f;
            h = math.clamp(h, VoxelConstants.MinWorldY + 8, VoxelConstants.MaxWorldY - 6);

            return new Sample { Height = h, Continentalness = cont, MountainMask = mountainMask };
        }

        public static float SurfaceHeight(float2 xz, uint seed) => SampleSurface(xz, seed).Height;
    }
}
