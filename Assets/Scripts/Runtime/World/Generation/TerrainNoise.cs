using Unity.Mathematics;
using static Voxelwild.World.VoxelConstants;

namespace Voxelwild.World.Generation
{
    public enum Biome : byte
    {
        Ocean, FrozenOcean, Beach, SnowyBeach, River, FrozenRiver,
        Desert, Badlands, Savanna, Plains, Forest, DenseForest, Jungle, Swamp,
        Taiga, SnowyTaiga, SnowyTundra, Mountains, SnowyPeaks,
    }

    /// <summary>
    /// Deterministic 2D terrain and climate field. Pure static math so it runs identically inside Burst
    /// jobs and on the main thread (spawn search, capture tool, tests).
    ///
    /// Shape: domain-warped continentalness picks ocean / coast / inland base height; massif + ridged
    /// noise build mountain ranges where continentalness is high and erosion low; climate (temperature,
    /// humidity) reshapes that into dunes, terraced badland mesas, flat swamps and lush jungle hills;
    /// river channels cut valleys down to sea level. 3D overhangs and caves are added by the column job.
    /// </summary>
    public static class TerrainNoise
    {
        public static float2 SeedOffset(uint seed, uint salt)
        {
            uint h = math.hash(new uint2(seed, salt));
            uint h2 = math.hash(new uint2(h, salt ^ 0x9E3779B9u));
            return new float2(h & 0xFFFF, h2 & 0xFFFF) - 32768f;
        }

        public static float3 SeedOffset3(uint seed, uint salt)
        {
            var a = SeedOffset(seed, salt);
            var b = SeedOffset(seed, salt + 101);
            return new float3(a, b.x) * 0.25f;
        }

        public static float Fbm(float2 p, int octaves)
        {
            float sum = 0f, amp = 1f, norm = 0f;
            for (int i = 0; i < octaves; i++)
            {
                sum += amp * noise.snoise(p);
                norm += amp;
                amp *= 0.5f;
                p = new float2(p.x * 1.6f - p.y * 1.2f, p.x * 1.2f + p.y * 1.6f);
            }
            return sum / norm;
        }

        public static float Fbm(float3 p, int octaves)
        {
            float sum = 0f, amp = 1f, norm = 0f;
            for (int i = 0; i < octaves; i++)
            {
                sum += amp * noise.snoise(p);
                norm += amp;
                amp *= 0.5f;
                p = p * 2.03f + 17.1f;
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

        static float ContinentalBase(float c)
        {
            if (c < -0.45f) return 28f;
            if (c < -0.20f) return math.lerp(28f, 50f, (c + 0.45f) / 0.25f);
            if (c < -0.06f) return math.lerp(50f, 62f, (c + 0.20f) / 0.14f);
            if (c < 0.02f) return math.lerp(62f, 67f, (c + 0.06f) / 0.08f);
            if (c < 0.35f) return math.lerp(67f, 80f, (c - 0.02f) / 0.33f);
            return math.lerp(80f, 92f, math.saturate((c - 0.35f) / 0.4f));
        }

        /// <summary>Stair-stepped heights with steep risers (badland mesas).</summary>
        static float Terrace(float h, float step)
        {
            float k = h / step;
            float f = math.frac(k);
            return (math.floor(k) + math.smoothstep(0.72f, 0.95f, f)) * step;
        }

        static float Band(float x, float lo, float hi, float soft) =>
            math.smoothstep(lo - soft, lo + soft, x) * (1f - math.smoothstep(hi - soft, hi + soft, x));

        public struct Sample
        {
            public float Height;
            public float Continentalness;
            public float MountainMask;
            public float Temperature;   // 0 cold .. 1 hot (after altitude cooling)
            public float Humidity;      // 0 dry .. 1 wet
            public float River;         // 0..1 channel strength
            public float Desert;
            public float Badlands;
            public float Swamp;
            /// <summary>Amplitude of 3D overhang noise the column job should apply here.</summary>
            public float Overhang;
            public Biome Biome;
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

            // Climate: very low frequency, lightly jittered so biome borders dither instead of running straight.
            float jitter = Fbm(p * 0.09f + 5.5f, 2) * 0.025f;
            float t = math.saturate((Fbm(q * 0.00042f + SeedOffset(seed, 4) * 0.01f, 3) * 1.7f) * 0.5f + 0.5f + jitter);
            float hu = math.saturate((Fbm(q * 0.00050f + SeedOffset(seed, 5) * 0.01f, 3) * 1.7f) * 0.5f + 0.5f - jitter);

            float baseH = ContinentalBase(cont);
            float mountainMask = math.smoothstep(0.02f, 0.42f, cont) * math.smoothstep(0.35f, -0.30f, erosion);

            float desert = math.smoothstep(0.60f, 0.70f, t) * math.smoothstep(0.40f, 0.30f, hu) * (1f - mountainMask);
            float badlands = desert * math.smoothstep(0.05f, 0.30f, Fbm(q * 0.0013f + 911.3f, 3));
            float lowland = math.smoothstep(-0.08f, 0.0f, cont) * (1f - math.smoothstep(0.12f, 0.28f, cont));
            float swamp = math.smoothstep(0.64f, 0.76f, hu) * Band(t, 0.42f, 0.66f, 0.04f) * lowland * (1f - mountainMask);
            float jungle = math.smoothstep(0.62f, 0.72f, t) * math.smoothstep(0.55f, 0.68f, hu);

            float mountains = (massif * 38f + math.pow(ridge, 1.25f) * 72f) * mountainMask * (1f - desert * 0.6f);
            float inland = math.smoothstep(-0.10f, 0.25f, cont);
            float hillAmp = math.lerp(3f, 15f, inland) * (1f - 0.6f * mountainMask)
                            * math.lerp(1.2f, 0.6f, math.saturate(erosion * 0.5f + 0.5f))
                            * (1f + 0.6f * jungle) * (1f - 0.6f * desert) * (1f - 0.85f * swamp);

            float h = baseH + mountains + hills * hillAmp + detail * 1.4f;

            // desert dunes (not on mesas)
            float2 dp = new float2(p.x * 0.8f + p.y * 0.6f, -p.x * 0.6f + p.y * 0.8f);
            h += Ridged(dp * new float2(0.011f, 0.025f), 2) * 7f * desert * (1f - badlands);

            // badland mesas: lifted plateau, terraced into steep sandstone steps
            if (badlands > 0f)
            {
                float plateau = h + 20f * badlands + Fbm(q * 0.004f + 71.2f, 3) * 10f;
                h = math.lerp(h, Terrace(plateau, 7f), math.smoothstep(0f, 0.6f, badlands));
            }

            // swamps sit right at the water line with small mounds and pools
            h = math.lerp(h, SeaLevel + 0.4f + detail * 1.6f + hills * 1.5f, swamp * 0.9f);

            // rivers: narrow bands of a low-frequency field, cut down below sea level on land
            float rv = math.abs(Fbm(q * 0.00095f + SeedOffset(seed, 6) * 0.01f, 3));
            float river = (1f - math.smoothstep(0.010f, 0.040f, rv)) * math.smoothstep(-0.14f, -0.02f, cont);
            float bed = SeaLevel - 2.5f - (1f - math.smoothstep(0f, 0.012f, rv)) * 3f;
            if (h > bed) h = math.lerp(h, bed, river);

            h = math.clamp(h, MinWorldY + 8, MaxWorldY - 6);

            // altitude cooling
            t = math.saturate(t - math.max(0f, h - 95f) / 200f);

            var s = new Sample
            {
                Height = h, Continentalness = cont, MountainMask = mountainMask, Temperature = t, Humidity = hu,
                River = river, Desert = desert, Badlands = badlands, Swamp = swamp,
                Overhang = mountainMask * 11f + badlands * 3f,
            };
            s.Biome = Classify(s);
            return s;
        }

        public static Biome Classify(in Sample s)
        {
            bool cold = s.Temperature < 0.2f;
            if (s.River > 0.5f && s.Height < SeaLevel + 1) return cold ? Biome.FrozenRiver : Biome.River;
            if (s.Height < SeaLevel - 1) return cold ? Biome.FrozenOcean : Biome.Ocean;
            if (s.Height <= SeaLevel + 2 && s.Continentalness < 0.06f && s.Swamp < 0.5f && s.Badlands < 0.3f)
                return cold ? Biome.SnowyBeach : Biome.Beach;
            if (s.MountainMask > 0.55f || s.Height > 128f)
                return s.Height > 148f || cold ? Biome.SnowyPeaks : Biome.Mountains;
            if (s.Badlands > 0.5f) return Biome.Badlands;
            if (s.Desert > 0.5f) return Biome.Desert;
            if (s.Swamp > 0.5f) return Biome.Swamp;
            if (cold) return s.Humidity < 0.45f ? Biome.SnowyTundra : Biome.SnowyTaiga;
            if (s.Temperature < 0.36f) return Biome.Taiga;
            if (s.Temperature > 0.66f) return s.Humidity > 0.55f ? Biome.Jungle : Biome.Savanna;
            if (s.Humidity < 0.38f) return Biome.Plains;
            return s.Humidity < 0.6f ? Biome.Forest : Biome.DenseForest;
        }

        public static float SurfaceHeight(float2 xz, uint seed) => SampleSurface(xz, seed).Height;
    }
}
