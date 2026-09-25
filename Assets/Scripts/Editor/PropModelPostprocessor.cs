using UnityEditor;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// Import settings for everything tools/blender/build_props.py writes under Assets/Art/Models, so nothing
    /// depends on hand-set importer options: metre scale with the axis conversion baked in, authored normals
    /// with MikkTSpace tangents (matching the Blender bake), no animation, cameras, lights or colliders.
    /// FBX materials stay embedded so the library builder can read each submesh's slot name; the drawn
    /// materials are the Voxelwild/Prop ones PropLibraryBuilder generates.
    /// Baked maps are linear data; *_Normal.png imports as a normal map.
    /// </summary>
    public sealed class PropModelPostprocessor : AssetPostprocessor
    {
        public const string ModelsFolder = "Assets/Art/Models";

        static bool IsProp(string path) => path.StartsWith(ModelsFolder + "/");

        void OnPreprocessModel()
        {
            if (!IsProp(assetPath)) return;
            var m = (ModelImporter)assetImporter;
            m.globalScale = 1f;
            m.useFileScale = true;
            m.bakeAxisConversion = true;
            m.importNormals = ModelImporterNormals.Import;
            m.importTangents = ModelImporterTangents.CalculateMikk;
            m.importBlendShapes = false;
            m.importVisibility = false;
            m.importCameras = false;
            m.importLights = false;
            m.animationType = ModelImporterAnimationType.None;
            m.importAnimation = false;
            m.addCollider = false;
            m.isReadable = false;
            m.meshCompression = ModelImporterMeshCompression.Off;
            m.meshOptimizationFlags = MeshOptimizationFlags.Everything;
            m.weldVertices = true;
            m.keepQuads = false;
            m.generateSecondaryUV = false;
            m.indexFormat = ModelImporterIndexFormat.UInt16;
            m.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
            m.materialLocation = ModelImporterMaterialLocation.InPrefab;
        }

        void OnPreprocessTexture()
        {
            if (!IsProp(assetPath)) return;
            var t = (TextureImporter)assetImporter;
            bool normal = assetPath.EndsWith("_Normal.png");
            t.textureType = normal ? TextureImporterType.NormalMap : TextureImporterType.Default;
            t.sRGBTexture = false;
            t.alphaIsTransparency = false;
            t.mipmapEnabled = true;
            t.anisoLevel = 4;
            t.wrapMode = UnityEngine.TextureWrapMode.Clamp;
            t.textureCompression = TextureImporterCompression.CompressedHQ;
        }
    }
}
