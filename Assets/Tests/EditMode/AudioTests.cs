using System;
using System.Collections.Generic;
using NUnit.Framework;
using Voxelwild.Audio;
using Voxelwild.Gameplay;
using Voxelwild.World;

namespace Voxelwild.Tests
{
    // Engine-free: also runs outside Unity (tools/dotnet-tests).
    public class AudioTests
    {
        static IEnumerable<(string name, float[] samples)> AllSounds()
        {
            foreach (Surface s in Enum.GetValues(typeof(Surface)))
            {
                yield return ($"step {s}", SoundSynth.Footstep(s, 0));
                yield return ($"break {s}", SoundSynth.Break(s, 0));
                yield return ($"hit {s}", SoundSynth.Hit(s, 0));
                yield return ($"place {s}", SoundSynth.Place(s, 0));
            }
            yield return ("thunder near", SoundSynth.Thunder(1, true));
            yield return ("thunder far", SoundSynth.Thunder(2, false));
            yield return ("splash", SoundSynth.Splash(0));
            yield return ("hurt", SoundSynth.Hurt(0));
            yield return ("pop", SoundSynth.Pop());
            yield return ("click", SoundSynth.Click());
            foreach (SoundSynth.Bed b in Enum.GetValues(typeof(SoundSynth.Bed)))
                yield return ($"bed {b}", SoundSynth.Loop(b));
        }

        [Test]
        public void EverySound_IsFinite_Audible_AndNeverClips()
        {
            foreach (var (name, s) in AllSounds())
            {
                Assert.Greater(s.Length, SoundSynth.SampleRate / 50, name);
                float peak = 0f;
                double energy = 0;
                foreach (var v in s)
                {
                    Assert.IsFalse(float.IsNaN(v) || float.IsInfinity(v), name);
                    peak = Math.Max(peak, Math.Abs(v));
                    energy += v * v;
                }
                Assert.LessOrEqual(peak, 1f, name);
                Assert.Greater(peak, 0.3f, name);
                Assert.Greater(Math.Sqrt(energy / s.Length), 0.005, $"{name} is nearly silent");
            }
        }

        [Test]
        public void Sounds_AreDeterministic_AndVariantsDiffer()
        {
            CollectionAssert.AreEqual(SoundSynth.Footstep(Surface.Gravel, 3), SoundSynth.Footstep(Surface.Gravel, 3));
            CollectionAssert.AreEqual(SoundSynth.Loop(SoundSynth.Bed.Birds, 4), SoundSynth.Loop(SoundSynth.Bed.Birds, 4));
            CollectionAssert.AreNotEqual(SoundSynth.Footstep(Surface.Gravel, 3), SoundSynth.Footstep(Surface.Gravel, 4));
        }

        [Test]
        public void Loops_WrapWithoutAClick()
        {
            foreach (SoundSynth.Bed b in Enum.GetValues(typeof(SoundSynth.Bed)))
            {
                var s = SoundSynth.Loop(b, 7);
                // the jump from the last sample back to the first is no bigger than the steps inside the loop
                float steps = 0f;
                for (int i = 1; i < s.Length; i++) steps = Math.Max(steps, Math.Abs(s[i] - s[i - 1]));
                Assert.LessOrEqual(Math.Abs(s[0] - s[s.Length - 1]), steps, b.ToString());
            }
        }

        [Test]
        public void Surfaces_MatchTheBlocks()
        {
            Assert.AreEqual(Surface.Grass, Surfaces.For(BlockId.Grass));
            Assert.AreEqual(Surface.Stone, Surfaces.For(BlockId.Cobblestone));
            Assert.AreEqual(Surface.Stone, Surfaces.For(BlockId.DiamondOre));
            Assert.AreEqual(Surface.Wood, Surfaces.For(BlockId.Planks));
            Assert.AreEqual(Surface.Sand, Surfaces.For(BlockId.Sand));
            Assert.AreEqual(Surface.Leaves, Surfaces.For(BlockId.SpruceLeaves));
            Assert.AreEqual(Surface.Water, Surfaces.For(BlockId.Water));
            Assert.AreEqual(Surface.Water, Surfaces.For(BlockId.FlowingWater1 + 3));
            Assert.AreEqual(Surface.Glass, Surfaces.For(BlockId.Ice));
        }

        [Test]
        public void Settings_ClampBadValues()
        {
            var s = new GameSettings { mouseSensitivity = 50f, fieldOfView = float.NaN, masterVolume = -1f, ambienceVolume = 2f }.Validate();
            Assert.AreEqual(GameSettings.MaxSensitivity, s.mouseSensitivity);
            Assert.AreEqual(72f, s.fieldOfView);
            Assert.AreEqual(0f, s.masterVolume);
            Assert.AreEqual(1f, s.ambienceVolume);
            var c = s.Clone();
            c.invertY = true;
            Assert.IsFalse(s.invertY, "clone is independent");
        }
    }
}
