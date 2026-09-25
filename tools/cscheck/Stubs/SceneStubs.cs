// Stubs for the URP volume and editor APIs WorldSceneBuilder uses. Signatures only.
using System;
namespace UnityEngine.Rendering
{
    public class VolumeParameter<T> { public T value; public void Override(T v) => throw null; }
    public class ClampedFloatParameter : VolumeParameter<float> { }
    public class MinFloatParameter : VolumeParameter<float> { }
    public class FloatParameter : VolumeParameter<float> { }
    public class ClampedIntParameter : VolumeParameter<int> { }
    public class VolumeComponent : ScriptableObject { }
    public class VolumeProfile : ScriptableObject
    {
        public bool TryGet<T>(out T component) where T : VolumeComponent => throw null;
        public T Add<T>(bool overrides = false) where T : VolumeComponent => throw null;
    }
    public class Volume : MonoBehaviour { public bool isGlobal; public VolumeProfile sharedProfile; }
}
namespace UnityEngine.Rendering.Universal
{
    public enum TonemappingMode { None, Neutral, ACES }
    public enum BloomDownscaleMode { Half, Quarter }
    public class TonemappingModeParameter : VolumeParameter<TonemappingMode> { }
    public class DownscaleParameter : VolumeParameter<BloomDownscaleMode> { }
    public class Tonemapping : VolumeComponent { public TonemappingModeParameter mode; }
    public class Bloom : VolumeComponent { public MinFloatParameter intensity, threshold; public ClampedFloatParameter scatter; public DownscaleParameter downscale; public ClampedIntParameter maxIterations; }
    public class ColorAdjustments : VolumeComponent { public FloatParameter postExposure; public ClampedFloatParameter contrast, saturation; }
    public class WhiteBalance : VolumeComponent { public ClampedFloatParameter temperature; }
    public class Vignette : VolumeComponent { public ClampedFloatParameter intensity, smoothness; }
    public enum AntialiasingQuality { Low, Medium, High }
}
namespace UnityEditor
{
    public class SerializedProperty
    {
        public float floatValue { get; set; } public int intValue { get; set; } public bool boolValue { get; set; }
        public UnityEngine.Vector3 vector3Value { get; set; } public UnityEngine.Object objectReferenceValue { get; set; }
    }
    public class SerializedObject
    {
        public SerializedObject(UnityEngine.Object o) { }
        public SerializedProperty FindProperty(string path) => throw null;
        public bool ApplyModifiedPropertiesWithoutUndo() => throw null;
        public void Update() => throw null;
    }
    public class EditorBuildSettingsScene { public EditorBuildSettingsScene(string path, bool enabled) { } }
    public static class EditorBuildSettings { public static EditorBuildSettingsScene[] scenes { get; set; } }
    public static class Lightmapping { public static UnityEngine.LightingSettings lightingSettings { get; set; } public static bool Bake() => throw null; }
    public static partial class AssetDatabaseExtra { }
}

namespace UnityEngine.TestTools
{
    public sealed class UnityTestAttribute : System.Attribute { }
    public sealed class UnitySetUpAttribute : System.Attribute { }
    public sealed class UnityTearDownAttribute : System.Attribute { }
}
