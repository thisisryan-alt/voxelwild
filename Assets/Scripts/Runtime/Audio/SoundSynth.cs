using System;
using Voxelwild.World;

namespace Voxelwild.Audio
{
    /// <summary>What a block sounds like underfoot and when it breaks.</summary>
    public enum Surface : byte { Grass, Dirt, Stone, Sand, Gravel, Wood, Leaves, Snow, Glass, Water }

    public static class Surfaces
    {
        public static Surface For(ushort block)
        {
            if (BlockId.IsWater(block)) return Surface.Water;
            switch (block)
            {
                case BlockId.Grass: case BlockId.SnowyGrass: case BlockId.Moss: case BlockId.TallGrass:
                case BlockId.FlowerRed: case BlockId.FlowerYellow: case BlockId.DeadBush: case BlockId.Glowcap:
                case BlockId.Cactus:
                    return Surface.Grass;
                case BlockId.Dirt: case BlockId.Mud: return Surface.Dirt;
                case BlockId.Sand: return Surface.Sand;
                case BlockId.Gravel: return Surface.Gravel;
                case BlockId.Snow: return Surface.Snow;
                case BlockId.Ice: return Surface.Glass;
                case BlockId.Planks: case BlockId.OakLog: case BlockId.BirchLog: case BlockId.SpruceLog:
                case BlockId.JungleLog: case BlockId.PropBarrier: case BlockId.Torch:
                    return Surface.Wood;
                case BlockId.OakLeaves: case BlockId.BirchLeaves: case BlockId.SpruceLeaves: case BlockId.JungleLeaves:
                    return Surface.Leaves;
                default: return Surface.Stone;
            }
        }
    }

    /// <summary>
    /// Every sound in the game, synthesised from noise and sine waves at startup: no audio files to license or
    /// ship. Footsteps and block hits are filtered noise bursts with grain (crunch) and a pitched body; the
    /// ambience beds are seamless loops (the tail is cross-faded into the head). All output is mono float PCM at
    /// <see cref="SampleRate"/>, peak-normalised, deterministic for a seed.
    /// </summary>
    public static class SoundSynth
    {
        public const int SampleRate = 44100;
        const float TwoPi = 6.2831853f;

        struct Rng
        {
            uint _s;
            public Rng(uint seed) { _s = seed * 747796405u + 2891336453u; if (_s == 0) _s = 1; }
            public float Next01() { _s ^= _s << 13; _s ^= _s >> 17; _s ^= _s << 5; return (_s >> 8) * (1f / 16777216f); }
            public float Signed() => Next01() * 2f - 1f;
            public float Range(float a, float b) => a + (b - a) * Next01();
        }

        /// <summary>One-pole filter coefficient for a cutoff in Hz.</summary>
        static float Coef(float hz) => 1f - MathF.Exp(-TwoPi * MathF.Min(hz, SampleRate * 0.45f) / SampleRate);

        /// <summary>A noise-burst voice. Band = high-pass .. low-pass; grains add crunch; tone adds a pitched body.</summary>
        struct Voice
        {
            public float Length, HighPass, LowPass, Attack, Decay, Noise, Grains, GrainDecay, Tone, ToneDecay, ToneAmp, ToneDrop;
        }

        static Voice StepVoice(Surface s) => s switch
        {
            Surface.Grass => new Voice { Length = 0.22f, HighPass = 1400, LowPass = 7000, Attack = 0.006f, Decay = 0.06f, Noise = 0.5f, Grains = 900, GrainDecay = 0.003f },
            Surface.Dirt => new Voice { Length = 0.18f, HighPass = 90, LowPass = 1300, Attack = 0.003f, Decay = 0.045f, Noise = 1f, Grains = 200, GrainDecay = 0.004f, Tone = 95, ToneDecay = 0.04f, ToneAmp = 0.35f, ToneDrop = 0.3f },
            Surface.Stone => new Voice { Length = 0.14f, HighPass = 700, LowPass = 4200, Attack = 0.001f, Decay = 0.028f, Noise = 1f, Grains = 120, GrainDecay = 0.002f, Tone = 240, ToneDecay = 0.02f, ToneAmp = 0.2f },
            Surface.Sand => new Voice { Length = 0.3f, HighPass = 500, LowPass = 3800, Attack = 0.03f, Decay = 0.09f, Noise = 0.8f, Grains = 500, GrainDecay = 0.002f },
            Surface.Gravel => new Voice { Length = 0.26f, HighPass = 400, LowPass = 5200, Attack = 0.008f, Decay = 0.07f, Noise = 0.4f, Grains = 1400, GrainDecay = 0.005f },
            Surface.Wood => new Voice { Length = 0.2f, HighPass = 150, LowPass = 2600, Attack = 0.001f, Decay = 0.03f, Noise = 0.6f, Grains = 0, Tone = 190, ToneDecay = 0.07f, ToneAmp = 0.8f, ToneDrop = 0.08f },
            Surface.Leaves => new Voice { Length = 0.32f, HighPass = 2200, LowPass = 9000, Attack = 0.02f, Decay = 0.1f, Noise = 0.6f, Grains = 700, GrainDecay = 0.006f },
            Surface.Snow => new Voice { Length = 0.28f, HighPass = 300, LowPass = 2600, Attack = 0.02f, Decay = 0.08f, Noise = 0.3f, Grains = 1800, GrainDecay = 0.004f },
            Surface.Glass => new Voice { Length = 0.2f, HighPass = 2500, LowPass = 9000, Attack = 0.001f, Decay = 0.015f, Noise = 0.7f, Tone = 2600, ToneDecay = 0.06f, ToneAmp = 0.35f },
            _ => new Voice { Length = 0.35f, HighPass = 350, LowPass = 2600, Attack = 0.01f, Decay = 0.12f, Noise = 1f, Grains = 300, GrainDecay = 0.01f },
        };

        static float[] Render(in Voice v, uint seed, float pitch)
        {
            int n = (int)(v.Length * SampleRate);
            var o = new float[n];
            var rng = new Rng(seed);
            float aL = Coef(v.LowPass * pitch), aH = Coef(v.HighPass * pitch);
            float lp = 0f, hp = 0f, grain = 0f;
            float grainMul = v.GrainDecay > 0f ? MathF.Exp(-1f / (v.GrainDecay * SampleRate)) : 0f;
            float phase = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)SampleRate;
                float env = t < v.Attack ? t / v.Attack : MathF.Exp(-(t - v.Attack) / v.Decay);
                if (v.Grains > 0f && rng.Next01() < v.Grains / SampleRate) grain = rng.Range(0.4f, 1f);
                float x = rng.Signed() * (v.Noise * env + grain);
                grain *= grainMul;
                lp += aL * (x - lp);
                hp += aH * (lp - hp);
                float s = lp - hp;
                if (v.ToneAmp > 0f)
                {
                    float f = v.Tone * pitch * (1f - v.ToneDrop * MathF.Min(t / 0.1f, 1f));
                    phase += TwoPi * f / SampleRate;
                    s += v.ToneAmp * MathF.Sin(phase) * MathF.Exp(-t / v.ToneDecay) * (t < 0.002f ? t / 0.002f : 1f);
                }
                o[i] = s;
            }
            FadeOut(o, 0.01f);
            Normalize(o, 0.8f);
            return o;
        }

        static float Pitch(uint seed, float spread) => 1f + (new Rng(seed ^ 0x9E3779B9u).Signed()) * spread;

        /// <summary>A footstep on a surface; vary <paramref name="variant"/> so repeated steps differ.</summary>
        public static float[] Footstep(Surface s, int variant) =>
            Render(StepVoice(s), (uint)(variant * 7919 + (int)s * 104729 + 1), Pitch((uint)variant, 0.08f));

        /// <summary>A block breaking: longer and lower than a step, with more debris.</summary>
        public static float[] Break(Surface s, int variant)
        {
            var v = StepVoice(s);
            v.Length *= 1.8f;
            v.Decay *= 2.2f;
            v.Grains = v.Grains * 1.5f + 300f;
            v.GrainDecay = MathF.Max(v.GrainDecay, 0.004f);
            v.Noise = MathF.Max(v.Noise, 0.6f);
            return Render(v, (uint)(variant * 31337 + (int)s * 7 + 11), Pitch((uint)variant + 99, 0.06f) * 0.8f);
        }

        /// <summary>A pick or hand striking a block while mining.</summary>
        public static float[] Hit(Surface s, int variant)
        {
            var v = StepVoice(s);
            v.Length = MathF.Min(v.Length, 0.12f);
            v.Decay *= 0.6f;
            v.Attack = 0.001f;
            return Render(v, (uint)(variant * 4099 + (int)s * 13 + 5), Pitch((uint)variant + 7, 0.05f) * 1.15f);
        }

        /// <summary>A block set down: a short soft thud with the surface's colour.</summary>
        public static float[] Place(Surface s, int variant)
        {
            var v = StepVoice(s);
            v.Length = 0.12f;
            v.Attack = 0.001f;
            v.Decay = 0.025f;
            v.LowPass *= 0.7f;
            v.Tone = v.Tone > 0f ? v.Tone : 150f;
            v.ToneAmp = MathF.Max(v.ToneAmp, 0.4f);
            v.ToneDecay = 0.03f;
            return Render(v, (uint)(variant * 211 + (int)s * 3 + 17), Pitch((uint)variant + 3, 0.05f));
        }

        /// <summary>
        /// Thunder: a crack when <paramref name="near"/>, then a rumble of several rolling swells of low noise.
        /// Distant thunder is darker and softer at the start.
        /// </summary>
        public static float[] Thunder(int seed, bool near)
        {
            float length = near ? 7f : 8f;
            int n = (int)(length * SampleRate);
            var o = new float[n];
            var rng = new Rng((uint)seed * 2654435761u + 3);
            int swells = 4 + (int)(rng.Next01() * 3);
            var at = new float[swells];
            var width = new float[swells];
            var amp = new float[swells];
            for (int k = 0; k < swells; k++)
            {
                at[k] = (near ? 0.1f : 0.5f) + rng.Next01() * 3.2f;
                width[k] = rng.Range(0.3f, 1.3f);
                amp[k] = rng.Range(0.5f, 1f);
            }
            float aL = Coef(near ? 320f : 160f), aL2 = Coef(near ? 900f : 350f), aCrack = Coef(3000f);
            float brown = 0f, lp = 0f, lp2 = 0f, crackLp = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)SampleRate;
                float env = 0f;
                for (int k = 0; k < swells; k++)
                {
                    float d = (t - at[k]) / width[k];
                    env += amp[k] * MathF.Exp(-d * d);
                }
                env *= MathF.Exp(-t / 3.5f) * MathF.Min(t / 0.05f, 1f);
                float w = rng.Signed();
                brown = brown * 0.995f + w * 0.1f;
                lp += aL * (brown - lp);
                lp2 += aL2 * (w - lp2);
                float s = lp * 3f * env + lp2 * 0.15f * env;
                if (near && t < 0.35f)
                {
                    crackLp += aCrack * (w - crackLp);
                    s += (w - crackLp) * MathF.Exp(-t / 0.06f) * 1.2f;
                }
                o[i] = s;
            }
            FadeOut(o, 1.5f);
            Normalize(o, 0.9f);
            return o;
        }

        // ------------------------------------------------------------------ one-shots

        /// <summary>Falling into water: a burst of spray and a few bubbles.</summary>
        public static float[] Splash(int variant)
        {
            int n = (int)(0.9f * SampleRate);
            var o = new float[n];
            var rng = new Rng((uint)variant * 977u + 41);
            float aL = Coef(3200f), aH = Coef(300f), lp = 0f, hp = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)SampleRate;
                float env = MathF.Min(t / 0.01f, 1f) * MathF.Exp(-t / 0.18f);
                lp += aL * (rng.Signed() - lp);
                hp += aH * (lp - hp);
                o[i] = (lp - hp) * env;
            }
            for (int b = 0; b < 7; b++) AddBubble(o, rng.Range(0.05f, 0.6f), rng.Range(500f, 1400f), 0.25f, ref rng);
            FadeOut(o, 0.05f);
            Normalize(o, 0.8f);
            return o;
        }

        /// <summary>Taking damage: a dull low thump.</summary>
        public static float[] Hurt(int variant)
        {
            int n = (int)(0.25f * SampleRate);
            var o = new float[n];
            var rng = new Rng((uint)variant * 131u + 7);
            float aL = Coef(700f), lp = 0f, phase = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)SampleRate;
                lp += aL * (rng.Signed() - lp);
                phase += TwoPi * (140f - 60f * MathF.Min(t / 0.2f, 1f)) / SampleRate;
                o[i] = (MathF.Sin(phase) * 0.9f + lp * 0.8f) * MathF.Min(t / 0.003f, 1f) * MathF.Exp(-t / 0.06f);
            }
            FadeOut(o, 0.02f);
            Normalize(o, 0.8f);
            return o;
        }

        /// <summary>Picking up an item: a short rising blip.</summary>
        public static float[] Pop()
        {
            int n = (int)(0.09f * SampleRate);
            var o = new float[n];
            float phase = 0f;
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)SampleRate;
                phase += TwoPi * (650f + 900f * t / 0.09f) / SampleRate;
                o[i] = MathF.Sin(phase) * MathF.Min(t / 0.004f, 1f) * MathF.Exp(-t / 0.03f);
            }
            FadeOut(o, 0.01f);
            Normalize(o, 0.5f);
            return o;
        }

        /// <summary>UI click.</summary>
        public static float[] Click()
        {
            int n = (int)(0.04f * SampleRate);
            var o = new float[n];
            for (int i = 0; i < n; i++)
            {
                float t = i / (float)SampleRate;
                o[i] = (MathF.Sin(TwoPi * 2200f * t) * 0.7f + MathF.Sin(TwoPi * 3300f * t) * 0.3f) * MathF.Exp(-t / 0.008f);
            }
            FadeOut(o, 0.005f);
            Normalize(o, 0.45f);
            return o;
        }

        // ------------------------------------------------------------------ ambience loops

        public enum Bed { Wind, Rain, Birds, Crickets, Cave, Underwater }

        /// <summary>A seamless ambience loop.</summary>
        public static float[] Loop(Bed bed, int seed = 1)
        {
            switch (bed)
            {
                case Bed.Wind: return MakeLoop(10f, seed, WindSample);
                case Bed.Rain: return MakeLoop(6f, seed, RainSample);
                case Bed.Birds: return MakeLoop(14f, seed, BirdsSample);
                case Bed.Crickets: return MakeLoop(6f, seed, CricketsSample);
                case Bed.Cave: return MakeLoop(12f, seed, CaveSample);
                default: return MakeLoop(6f, seed, UnderwaterSample);
            }
        }

        delegate void Fill(float[] buffer, ref Rng rng);

        static float[] MakeLoop(float seconds, int seed, Fill fill)
        {
            const float fade = 0.5f;
            int n = (int)(seconds * SampleRate), f = (int)(fade * SampleRate);
            var raw = new float[n + f];
            var rng = new Rng((uint)seed * 2246822519u + 19);
            fill(raw, ref rng);
            var o = new float[n];
            Array.Copy(raw, o, n);
            // o[n-1] runs on into raw[n]; blending raw[n..n+f) into the head makes o[0] follow o[n-1]
            for (int i = 0; i < f; i++)
            {
                float w = i / (float)f;
                o[i] = raw[i] * w + raw[n + i] * (1f - w);
            }
            Normalize(o, 0.7f);
            return o;
        }

        static void WindSample(float[] o, ref Rng rng)
        {
            float brown = 0f, lp = 0f, lp2 = 0f;
            // slow gusts from a few incommensurate sines
            float g1 = rng.Range(0f, 6f), g2 = rng.Range(0f, 6f), g3 = rng.Range(0f, 6f);
            for (int i = 0; i < o.Length; i++)
            {
                float t = i / (float)SampleRate;
                float gust = 0.55f + 0.25f * MathF.Sin(t * 0.63f + g1) + 0.15f * MathF.Sin(t * 1.37f + g2) + 0.08f * MathF.Sin(t * 2.9f + g3);
                float w = rng.Signed();
                brown = brown * 0.998f + w * 0.05f;
                lp += Coef(200f + 500f * gust) * (w - lp);
                lp2 += Coef(90f) * (brown - lp2);
                o[i] = (lp * 0.6f + lp2 * 2.5f) * gust;
            }
        }

        static void RainSample(float[] o, ref Rng rng)
        {
            float lp = 0f, hp = 0f, drop = 0f, dropLp = 0f;
            float aL = Coef(6500f), aH = Coef(900f), aD = Coef(2500f);
            for (int i = 0; i < o.Length; i++)
            {
                float w = rng.Signed();
                lp += aL * (w - lp);
                hp += aH * (lp - hp);
                if (rng.Next01() < 90f / SampleRate) drop = rng.Range(0.5f, 1.5f);
                dropLp += aD * (rng.Signed() * drop - dropLp);
                drop *= 0.9985f;
                o[i] = (lp - hp) * 0.6f + dropLp * 0.5f;
            }
        }

        static void BirdsSample(float[] o, ref Rng rng)
        {
            float seconds = o.Length / (float)SampleRate;
            float t = rng.Range(0.2f, 1f);
            while (t < seconds - 1.5f)
            {
                // a phrase: 2–6 chirps from one bird (its own pitch and shape)
                int chirps = 2 + (int)(rng.Next01() * 5);
                float baseF = rng.Range(2200f, 4800f), sweep = rng.Range(-0.5f, 0.6f), len = rng.Range(0.05f, 0.14f);
                float gap = rng.Range(0.06f, 0.16f), vol = rng.Range(0.25f, 0.8f);
                for (int c = 0; c < chirps; c++)
                {
                    AddChirp(o, t, len, baseF * rng.Range(0.95f, 1.05f), sweep, vol);
                    t += len + gap;
                }
                t += rng.Range(0.6f, 2.4f);
            }
        }

        static void AddChirp(float[] o, float start, float len, float f0, float sweep, float vol)
        {
            int s = (int)(start * SampleRate), n = (int)(len * SampleRate);
            float phase = 0f;
            for (int i = 0; i < n && s + i < o.Length; i++)
            {
                float u = i / (float)n;
                float f = f0 * (1f + sweep * u);
                phase += TwoPi * f / SampleRate;
                float env = MathF.Sin(MathF.PI * u);
                o[s + i] += (MathF.Sin(phase) + 0.2f * MathF.Sin(2f * phase)) * env * env * vol;
            }
        }

        static void CricketsSample(float[] o, ref Rng rng)
        {
            // three crickets: a 4–5 kHz carrier gated by pulse trains (a few pulses per chirp, chirps ~2/s)
            for (int k = 0; k < 3; k++)
            {
                float carrier = rng.Range(4200f, 5200f), pulseRate = rng.Range(28f, 40f), chirpRate = rng.Range(1.4f, 2.6f);
                int pulses = 3 + (int)(rng.Next01() * 3);
                float offset = rng.Range(0f, 1f), vol = rng.Range(0.3f, 0.7f);
                for (int i = 0; i < o.Length; i++)
                {
                    float t = i / (float)SampleRate;
                    float cp = (t * chirpRate + offset) % 1f;
                    float pulsePos = cp * pulseRate / chirpRate;
                    if (pulsePos >= pulses) continue;
                    float pp = pulsePos % 1f;
                    float gate = pp < 0.6f ? MathF.Sin(MathF.PI * pp / 0.6f) : 0f;
                    o[i] += MathF.Sin(TwoPi * carrier * t) * gate * vol;
                }
            }
        }

        static void CaveSample(float[] o, ref Rng rng)
        {
            float brown = 0f, lp = 0f;
            float aL = Coef(110f);
            for (int i = 0; i < o.Length; i++)
            {
                brown = brown * 0.999f + rng.Signed() * 0.04f;
                lp += aL * (brown - lp);
                o[i] = lp * 3f;
            }
            float seconds = o.Length / (float)SampleRate;
            int drips = 3 + (int)(rng.Next01() * 3);
            for (int d = 0; d < drips; d++) AddDrip(o, rng.Range(0.3f, seconds - 0.5f), rng.Range(1400f, 2600f), rng.Range(0.3f, 0.6f));
        }

        static void AddDrip(float[] o, float start, float f0, float vol)
        {
            int s = (int)(start * SampleRate), n = (int)(0.12f * SampleRate);
            float phase = 0f;
            for (int i = 0; i < n && s + i < o.Length; i++)
            {
                float t = i / (float)SampleRate;
                phase += TwoPi * f0 * (1f + 1.5f * t / 0.12f) / SampleRate;   // plink: rising pitch
                o[s + i] += MathF.Sin(phase) * MathF.Exp(-t / 0.025f) * vol;
            }
            // a faint echo
            for (int i = 0; i < n && s + i + SampleRate / 5 < o.Length; i++)
                o[s + i + SampleRate / 5] += o[s + i] * 0.25f;
        }

        static void UnderwaterSample(float[] o, ref Rng rng)
        {
            float brown = 0f, lp = 0f;
            float aL = Coef(260f);
            for (int i = 0; i < o.Length; i++)
            {
                brown = brown * 0.997f + rng.Signed() * 0.06f;
                lp += aL * (brown - lp);
                o[i] = lp * 2f;
            }
            float seconds = o.Length / (float)SampleRate;
            for (int b = 0; b < 10; b++) AddBubble(o, rng.Range(0f, seconds - 0.2f), rng.Range(300f, 900f), 0.15f, ref rng);
        }

        static void AddBubble(float[] o, float start, float f0, float vol, ref Rng rng)
        {
            int s = (int)(start * SampleRate), n = (int)(0.08f * SampleRate);
            float phase = 0f, rise = rng.Range(1f, 3f);
            for (int i = 0; i < n && s + i < o.Length; i++)
            {
                float t = i / (float)SampleRate;
                phase += TwoPi * f0 * (1f + rise * t / 0.08f) / SampleRate;
                o[s + i] += MathF.Sin(phase) * MathF.Exp(-t / 0.02f) * vol;
            }
        }

        // ------------------------------------------------------------------ helpers

        static void FadeOut(float[] o, float seconds)
        {
            int n = Math.Min(o.Length, (int)(seconds * SampleRate));
            for (int i = 0; i < n; i++) o[o.Length - 1 - i] *= i / (float)n;
        }

        static void Normalize(float[] o, float peak)
        {
            float max = 0f;
            foreach (var v in o) max = MathF.Max(max, MathF.Abs(v));
            if (max < 1e-9f) return;
            float k = peak / max;
            for (int i = 0; i < o.Length; i++) o[i] *= k;
        }
    }
}
