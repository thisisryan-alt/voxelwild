// Type-check stubs for the UnityEditor API surface the new editor scripts use. Signatures only.
using System;
using UnityEngine;
namespace UnityEditor
{
    public class MenuItem : Attribute { public MenuItem(string path) { } }
    public class InitializeOnLoadAttribute : Attribute { }
    public class AssetImporter : UnityEngine.Object { public string assetPath => throw null; }
    public class AssetPostprocessor { public string assetPath => throw null; public AssetImporter assetImporter => throw null; }
    public enum ModelImporterNormals { Import, Calculate, None }
    public enum ModelImporterTangents { Import, CalculateLegacy, CalculateLegacyWithSplitTangents, CalculateMikk, None }
    public enum ModelImporterAnimationType { None, Legacy, Generic, Human }
    public enum ModelImporterMeshCompression { Off, Low, Medium, High }
    public enum ModelImporterIndexFormat { Auto, UInt16, UInt32 }
    public enum ModelImporterMaterialImportMode { None, ImportStandard, ImportViaMaterialDescription }
    public enum ModelImporterMaterialLocation { External, InPrefab }
    [Flags] public enum MeshOptimizationFlags { PolygonOrder = 1, VertexOrder = 2, Everything = ~0 }
    public class ModelImporter : AssetImporter
    {
        public float globalScale { get; set; } public bool useFileScale { get; set; } public bool bakeAxisConversion { get; set; }
        public ModelImporterNormals importNormals { get; set; } public ModelImporterTangents importTangents { get; set; }
        public bool importBlendShapes { get; set; } public bool importVisibility { get; set; } public bool importCameras { get; set; }
        public bool importLights { get; set; } public ModelImporterAnimationType animationType { get; set; } public bool importAnimation { get; set; }
        public bool addCollider { get; set; } public bool isReadable { get; set; } public ModelImporterMeshCompression meshCompression { get; set; }
        public MeshOptimizationFlags meshOptimizationFlags { get; set; } public bool weldVertices { get; set; } public bool keepQuads { get; set; }
        public bool generateSecondaryUV { get; set; } public ModelImporterIndexFormat indexFormat { get; set; }
        public ModelImporterMaterialImportMode materialImportMode { get; set; } public ModelImporterMaterialLocation materialLocation { get; set; }
    }
    public enum TextureImporterType { Default, NormalMap }
    public enum TextureImporterCompression { Uncompressed, Compressed, CompressedHQ, CompressedLQ }
    public class TextureImporter : AssetImporter
    {
        public TextureImporterType textureType { get; set; } public bool sRGBTexture { get; set; } public bool alphaIsTransparency { get; set; }
        public bool mipmapEnabled { get; set; } public int anisoLevel { get; set; } public TextureWrapMode wrapMode { get; set; }
        public TextureImporterCompression textureCompression { get; set; }
    }
    public static class AssetDatabase
    {
        public static void Refresh() => throw null;
        public static void ImportAsset(string path) => throw null;
        public static T LoadAssetAtPath<T>(string path) where T : UnityEngine.Object => throw null;
        public static void CreateAsset(UnityEngine.Object asset, string path) => throw null;
        public static void SaveAssets() => throw null;
        public static string[] FindAssets(string filter) => throw null;
        public static string GUIDToAssetPath(string guid) => throw null;
        public static UnityEngine.Object LoadMainAssetAtPath(string path) => throw null;
        public static UnityEngine.Object[] LoadAllAssetsAtPath(string path) => throw null;
        public static void AddObjectToAsset(UnityEngine.Object o, UnityEngine.Object asset) => throw null;
        public static string GetAssetPath(UnityEngine.Object o) => throw null;
    }
    public static class EditorUtility { public static void SetDirty(UnityEngine.Object o) => throw null; }
}
namespace UnityEditor.SceneManagement
{
    public enum NewSceneSetup { EmptyScene, DefaultGameObjects }
    public enum NewSceneMode { Single, Additive }
    public static class EditorSceneManager
    {
        public static UnityEngine.SceneManagement.Scene NewScene(NewSceneSetup setup, NewSceneMode mode) => throw null;
        public static bool SaveCurrentModifiedScenesIfUserWantsTo() => throw null;
        public static bool SaveScene(UnityEngine.SceneManagement.Scene scene, string path) => throw null;
    }
}
namespace Voxelwild.EditorTools
{
    // the real one is in Assets/Scripts/Editor/BlockTextureArrays.cs (uses more editor API than is stubbed here)
    public static class BlockTextureArrays
    {
        public const string AlbedoPath = "a", NormalPath = "b", MaskPath = "c";
        [Serializable] public class LayerEntry { public string name; }
        [Serializable] public class Manifest { public LayerEntry[] layers; }
        public static Manifest LoadManifest() => throw null;
        public static void Build() => throw null;
    }
}
namespace UnityEngine.Rendering.Universal
{
    public class UniversalAdditionalLightData : UnityEngine.MonoBehaviour { }
}
