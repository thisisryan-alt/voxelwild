using NUnit.Framework;
using Voxelwild.Rendering;

namespace Voxelwild.Tests
{
    // Engine-free: also runs outside Unity (tools/dotnet-tests).
    public class QualityPresetTests
    {
        [Test]
        public void High_IsThePhase2Reference()
        {
            var high = QualityPresets.All[QualityPresets.Default];
            Assert.AreEqual("High", high.Name);
            Assert.AreEqual(10, high.ViewDistance);
            Assert.AreEqual(110f, high.ShadowDistance);
            Assert.AreEqual(4, high.ShadowCascades);
            Assert.AreEqual(1f, high.RenderScale);
            Assert.AreEqual(2, high.FancyLeavesDistance);
            Assert.IsTrue(high.Ssao);
            Assert.AreEqual((140f, 330f), QualityPresets.FogRange(high.ViewDistance), "fog as tuned in Phase 2");
        }

        [Test]
        public void EachStepUp_CostsAtLeastAsMuchOnEveryAxis()
        {
            for (int i = 1; i < QualityPresets.All.Length; i++)
            {
                var a = QualityPresets.All[i - 1];
                var b = QualityPresets.All[i];
                string n = $"{a.Name} -> {b.Name}";
                Assert.GreaterOrEqual(b.RenderScale, a.RenderScale, n);
                Assert.GreaterOrEqual(b.ShadowDistance, a.ShadowDistance, n);
                Assert.GreaterOrEqual(b.ShadowCascades, a.ShadowCascades, n);
                Assert.GreaterOrEqual(b.ViewDistance, a.ViewDistance, n);
                Assert.GreaterOrEqual(b.FancyLeavesDistance, a.FancyLeavesDistance, n);
                Assert.GreaterOrEqual(b.PropDistanceScale, a.PropDistanceScale, n);
                Assert.IsTrue(!a.Ssao || b.Ssao, n);
                Assert.IsTrue(!a.SoftShadows || b.SoftShadows, n);
                Assert.IsTrue(!a.StochasticTiling || b.StochasticTiling, n);
            }
        }

        [Test]
        public void Names_ResolveCaseInsensitively_AndIndicesClamp()
        {
            Assert.AreEqual(0, QualityPresets.Find("low"));
            Assert.AreEqual(4, QualityPresets.Find("Cinematic"));
            Assert.AreEqual(-1, QualityPresets.Find("potato"));
            Assert.AreEqual(0, QualityPresets.Clamp(-3));
            Assert.AreEqual(QualityPresets.All.Length - 1, QualityPresets.Clamp(99));
        }
    }
}
