// Type-check stubs for packages whose assemblies aren't available outside Unity. Signatures only.
using System;
using System.Collections.Generic;
namespace Unity.Burst
{
    [AttributeUsage(AttributeTargets.All)] public class BurstCompileAttribute : Attribute { public BurstCompileAttribute() { } public bool CompileSynchronously { get; set; } public FloatMode FloatMode { get; set; } public FloatPrecision FloatPrecision { get; set; } }
    public enum FloatMode { Default, Strict, Deterministic, Fast }
    public enum FloatPrecision { Standard, High, Medium, Low }
    [AttributeUsage(AttributeTargets.All)] public class BurstDiscardAttribute : Attribute { }
    [AttributeUsage(AttributeTargets.All)] public class NoAliasAttribute : Attribute { }
}
namespace Unity.Collections
{
    public struct NativeList<T> : IDisposable where T : unmanaged
    {
        public NativeList(int capacity, AllocatorManager.AllocatorHandle allocator) { throw null; }
        public NativeList(int capacity, Allocator allocator) { throw null; }
        public bool IsCreated => throw null;
        public int Length { get => throw null; set => throw null; }
        public int Capacity { get => throw null; set => throw null; }
        public T this[int index] { get => throw null; set => throw null; }
        public void Add(in T value) => throw null;
        public void Clear() => throw null;
        public void RemoveAt(int index) => throw null;
        public void RemoveAtSwapBack(int index) => throw null;
        public NativeArray<T> AsArray() => throw null;
        public T[] ToArray() => throw null;
        public void Dispose() => throw null;
        public unsafe void* GetUnsafePtr() => throw null;
    }
    public static class AllocatorManager { public struct AllocatorHandle { public static implicit operator AllocatorHandle(Allocator a) => default; } }
    public static class NativeSortExtension
    {
        public static void Sort<T>(this NativeList<T> list) where T : unmanaged, IComparable<T> => throw null;
        public static void Sort<T>(this NativeArray<T> array) where T : unmanaged, IComparable<T> => throw null;
    }
}
namespace UnityEngine.InputSystem
{
    namespace Controls
    {
        public class ButtonControl { public bool isPressed => throw null; public bool wasPressedThisFrame => throw null; public bool wasReleasedThisFrame => throw null; }
        public class KeyControl : ButtonControl { }
        public class Vector2Control { public UnityEngine.Vector2 ReadValue() => throw null; }
    }
    public enum Key { None, Digit1 = 41, Digit2, Digit3, Digit4, Digit5, Digit6, Digit7, Digit8, Digit9, Digit0 }
    public class Keyboard
    {
        public Controls.KeyControl this[Key key] => throw null;
        public static Keyboard current => throw null;
        public Controls.KeyControl aKey, dKey, sKey, wKey, fKey, f1Key, f3Key, f4Key, tKey, pKey, yKey, eKey, qKey, cKey, rKey, iKey, mKey, tabKey, enterKey, escapeKey, leftCtrlKey, leftShiftKey, spaceKey, f2Key, f5Key, f6Key;
    }
    public class Mouse
    {
        public static Mouse current => throw null;
        public Controls.Vector2Control delta, scroll, position;
        public Controls.ButtonControl leftButton, rightButton, middleButton;
    }
}
namespace UnityEngine.Rendering.Universal
{
    public class ScriptableRendererFeature : UnityEngine.ScriptableObject { public void SetActive(bool active) => throw null; public bool isActive => throw null; }
    public class UniversalRendererData : UnityEngine.ScriptableObject { public List<ScriptableRendererFeature> rendererFeatures => throw null; }
    public class UniversalRenderPipelineAsset : UnityEngine.Rendering.RenderPipelineAsset { public float renderScale { get; set; } public float shadowDistance { get; set; } public int shadowCascadeCount { get; set; } public override UnityEngine.Rendering.RenderPipeline CreatePipeline() => throw null; }
    public enum AntialiasingMode { None, FastApproximateAntialiasing, SubpixelMorphologicalAntiAliasing, TemporalAntiAliasing }
    public class UniversalAdditionalCameraData : UnityEngine.MonoBehaviour { public bool renderPostProcessing { get; set; } public AntialiasingMode antialiasing { get; set; } public AntialiasingQuality antialiasingQuality { get; set; } public bool renderShadows { get; set; } }
}
