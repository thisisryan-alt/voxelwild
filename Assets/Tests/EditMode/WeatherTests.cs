using System.Collections.Generic;
using NUnit.Framework;
using Unity.Mathematics;
using Voxelwild.Rendering;

namespace Voxelwild.Tests
{
    // Engine-free: also runs outside Unity (tools/dotnet-tests).
    public class WeatherTests
    {
        [Test]
        public void TransitionTable_RowsSumToOne_AndStormsOnlyFollowRain()
        {
            foreach (WeatherKind from in System.Enum.GetValues(typeof(WeatherKind)))
            {
                float sum = 0f;
                foreach (WeatherKind to in System.Enum.GetValues(typeof(WeatherKind))) sum += WeatherModel.TransitionProbability(from, to);
                Assert.AreEqual(1f, sum, 1e-5f, from.ToString());
            }
            Assert.AreEqual(0f, WeatherModel.TransitionProbability(WeatherKind.Clear, WeatherKind.Storm));
            Assert.AreEqual(0f, WeatherModel.TransitionProbability(WeatherKind.Cloudy, WeatherKind.Storm));
        }

        [Test]
        public void Chain_IsDeterministicPerSeed_AndOnlyTakesAllowedSteps()
        {
            var a = new WeatherModel(7);
            var b = new WeatherModel(7);
            var seen = new HashSet<WeatherKind>();
            WeatherKind last = a.Current;
            for (int i = 0; i < 20000; i++)
            {
                a.Step(1f, false);
                b.Step(1f, false);
                Assert.AreEqual(a.Current, b.Current);
                if (a.Current != last)
                {
                    Assert.Greater(WeatherModel.TransitionProbability(last, a.Current), 0f, $"{last} -> {a.Current}");
                    last = a.Current;
                }
                seen.Add(a.Current);
            }
            Assert.GreaterOrEqual(seen.Count, 5, "most states visited in ~5.5 hours");
        }

        [Test]
        public void Transitions_AreSmooth()
        {
            var m = new WeatherModel(3);
            var prev = m.Params;
            m.ForceState(WeatherKind.Storm);
            for (int i = 0; i < 200; i++)
            {
                m.Step(0.5f, false);
                Assert.Less(math.abs(m.Params.CloudCoverage - prev.CloudCoverage), 0.03f);
                Assert.Less(math.abs(m.Params.Light - prev.Light), 0.03f);
                prev = m.Params;
            }
            Assert.AreEqual(WeatherModel.Presets[(int)WeatherKind.Storm].Light, m.Params.Light, 1e-4f, "reaches the target");
        }

        [Test]
        public void Rain_WetsTheGround_ThenPuddles_ThenItDries()
        {
            var m = new WeatherModel(1, WeatherKind.HeavyRain) { Frozen = true };
            for (int i = 0; i < 120; i++) m.Step(1f, false);
            Assert.Greater(m.Wetness, 0.99f);
            Assert.Greater(m.Puddles, 0.3f);
            Assert.AreEqual(0f, m.SnowCover);
            m.ForceState(WeatherKind.Clear);
            for (int i = 0; i < 400; i++) m.Step(1f, false, sun: 1f);
            Assert.Less(m.Wetness, 0.1f);
            Assert.AreEqual(0f, m.Puddles, 1e-4f);
        }

        [Test]
        public void ColdPrecipitation_SettlesAsSnow_AndMeltsOnlyWhenWarm()
        {
            var m = new WeatherModel(1, WeatherKind.HeavyRain) { Frozen = true };
            for (int i = 0; i < 200; i++) m.Step(1f, cold: true);
            Assert.Greater(m.SnowCover, 0.99f);
            Assert.AreEqual(0f, m.Wetness, "snow, not rain");
            m.ForceState(WeatherKind.Clear);
            for (int i = 0; i < 400; i++) m.Step(1f, cold: true);
            Assert.Greater(m.SnowCover, 0.99f, "stays in the cold");
            for (int i = 0; i < 400; i++) m.Step(1f, cold: false);
            Assert.Less(m.SnowCover, 0.1f, "melts when warm");
        }

        [Test]
        public void Lightning_OnlyInStorms()
        {
            var calm = new WeatherModel(5, WeatherKind.HeavyRain) { Frozen = true };
            var storm = new WeatherModel(5, WeatherKind.Storm) { Frozen = true };
            int calmStrikes = 0, stormStrikes = 0;
            for (int i = 0; i < 600; i++)
            {
                if (calm.Step(1f, false)) calmStrikes++;
                if (storm.Step(1f, false)) stormStrikes++;
            }
            Assert.AreEqual(0, calmStrikes);
            Assert.That(stormStrikes, Is.InRange(20, 90), "about one strike per 14 s");
        }

        [Test]
        public void Cold_DependsOnClimateAndAltitude()
        {
            Assert.IsTrue(WeatherModel.IsCold(0.1f, 70f));
            Assert.IsFalse(WeatherModel.IsCold(0.6f, 70f));
            Assert.IsTrue(WeatherModel.IsCold(0.6f, 170f), "mountain tops");
        }
    }
}
