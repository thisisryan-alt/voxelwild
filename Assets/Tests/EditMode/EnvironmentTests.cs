using NUnit.Framework;
using Unity.Mathematics;
using Voxelwild.Rendering;

namespace Voxelwild.Tests
{
    // Engine-free: these also run outside Unity (tools/dotnet-tests).
    public class SkyModelTests
    {
        [Test]
        public void Sun_RisesEast_PeaksSouthAtNoon_SetsWest_IsDownAtMidnight()
        {
            var rise = SkyModel.SunDirection(0.25f);
            var noon = SkyModel.SunDirection(0.5f);
            var set = SkyModel.SunDirection(0.75f);
            var midnight = SkyModel.SunDirection(0f);
            Assert.Greater(rise.x, 0.99f);
            Assert.AreEqual(0f, rise.y, 1e-4f);
            Assert.AreEqual(55f, math.degrees(math.asin(noon.y)), 0.01f, "noon elevation = 90 - tilt");
            Assert.Less(noon.z, 0f, "noon sun stands to the south (-Z)");
            Assert.Less(set.x, -0.99f);
            Assert.Less(midnight.y, -0.5f);
        }

        [Test]
        public void Daylight_IsSunlit_NightIsMoonlit_AndStarsOnlyAtNight()
        {
            var noon = SkyModel.Evaluate(10.5);
            var night = SkyModel.Evaluate(10.0);
            Assert.IsFalse(noon.MoonIsLight);
            Assert.AreEqual(SkyModel.SunIntensity, noon.LightIntensity, 1e-3f);
            Assert.IsTrue(night.MoonIsLight);
            Assert.Less(night.LightIntensity, 0.3f);
            Assert.AreEqual(0f, noon.StarVisibility, 1e-4f);
            Assert.AreEqual(1f, night.StarVisibility, 1e-4f);
            Assert.Greater(math.csum(noon.AmbientSky), 5f * math.csum(night.AmbientSky), "nights are much darker");
        }

        [Test]
        public void SunsetLight_IsWarmerThanNoon()
        {
            var noon = SkyModel.Evaluate(3.5);
            var dusk = SkyModel.Evaluate(3.745);
            Assert.Greater(dusk.SunElevationDeg, 0f);
            Assert.Less(dusk.SunElevationDeg, 5f);
            float warmNoon = noon.LightColor.x / noon.LightColor.z;
            float warmDusk = dusk.LightColor.x / dusk.LightColor.z;
            Assert.Greater(warmDusk, warmNoon * 1.8f, $"noon {noon.LightColor}, dusk {dusk.LightColor}");
            Assert.Greater(dusk.Fog.x / dusk.Fog.z, noon.Fog.x / noon.Fog.z, "dusk fog is warmer");
        }

        [Test]
        public void MoonPhases_CycleEveryEightDays()
        {
            Assert.AreEqual(0f, SkyModel.MoonIllumination(SkyModel.MoonPhase(0)), 1e-4f, "day 0 is a new moon");
            Assert.AreEqual(1f, SkyModel.MoonIllumination(SkyModel.MoonPhase(4)), 1e-4f, "day 4 is full");
            Assert.AreEqual(SkyModel.MoonPhase(3), SkyModel.MoonPhase(3 + SkyModel.MoonCycleDays), 1e-5f);
            var fullNight = SkyModel.Evaluate(4.0);
            var newNight = SkyModel.Evaluate(8.0);
            Assert.Greater(fullNight.LightIntensity, newNight.LightIntensity);
        }
    }

    public class AtmosphereTests
    {
        [Test]
        public void Transmittance_IsNearlyWhiteOverhead_RedAtTheHorizon_ZeroBelowIt()
        {
            var zenith = AtmosphereModel.Transmittance(1f);
            var horizon = AtmosphereModel.Transmittance(0.02f);
            Assert.Greater(zenith.x, 0.9f);
            Assert.Greater(zenith.z, 0.7f);
            Assert.Greater(horizon.x / math.max(horizon.z, 1e-6f), 5f, $"horizon sun {horizon}");
            Assert.AreEqual(0f, math.cmax(AtmosphereModel.Transmittance(-0.2f)), 1e-6f);
        }

        [Test]
        public void NoonSky_IsBlue_AndBrightestTowardTheHorizon()
        {
            float muSun = math.sin(math.radians(55f));
            var zenith = AtmosphereModel.InScatter(1f, muSun);
            var nearHorizon = AtmosphereModel.InScatter(0.05f, muSun);
            Assert.Greater(zenith.z, zenith.x * 2f, $"zenith {zenith}");
            Assert.Greater(math.csum(nearHorizon.xyz), math.csum(zenith.xyz), "the horizon is brighter than the zenith");
        }

        [Test]
        public void SunsetSky_TowardTheSun_IsWarm_AndNightSkyIsDark()
        {
            float muSun = 0.02f;
            var towardSun = AtmosphereModel.Radiance(AtmosphereModel.InScatter(0.05f, muSun), 0.95f);
            Assert.Greater(towardSun.x, towardSun.z, $"sunset glow {towardSun}");
            var night = AtmosphereModel.InScatter(0.5f, -0.3f);
            var day = AtmosphereModel.InScatter(0.5f, 0.8f);
            Assert.Less(math.csum(night.xyz), math.csum(day.xyz) * 0.01f);
        }

        [Test]
        public void Lut_CoordinatesRoundTrip_AndTableIsFinite()
        {
            foreach (float mu in new[] { -0.9f, -0.1f, 0f, 0.05f, 0.5f, 1f })
                Assert.AreEqual(mu, AtmosphereModel.ViewMuFromU(AtmosphereModel.ViewUFromMu(mu)), 1e-5f);
            Assert.AreEqual(0.3f, AtmosphereModel.SunMuFromV(AtmosphereModel.SunVFromMu(0.3f)), 1e-5f);
            var lut = AtmosphereModel.BuildLut();
            Assert.AreEqual(AtmosphereModel.LutViewSize * AtmosphereModel.LutSunSize, lut.Length);
            foreach (var t in lut)
            {
                Assert.IsTrue(math.all(math.isfinite(t)) && math.all(t >= 0f), t.ToString());
            }
        }
    }
}
