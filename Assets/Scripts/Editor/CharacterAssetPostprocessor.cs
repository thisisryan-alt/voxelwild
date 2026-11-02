using UnityEditor;
using UnityEngine;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// Import rules for character art exported by tools/blender/human (nothing is hand-tuned in the
    /// inspector):
    ///   Assets/Art/Models/Characters/**.fbx  Humanoid avatar from the mixamorig skeleton, blend shapes,
    ///                                        authored normals, MikkTSpace tangents, LODs from _LODn names.
    ///   Assets/Art/Textures/Characters/**    by suffix: _BaseColor sRGB, _Normal normal map (BC5),
    ///                                        _Mask / _Height linear, _HairCards linear with alpha-coverage
    ///                                        preserving mips so cards keep their density at distance.
    /// </summary>
    public sealed class CharacterAssetPostprocessor : AssetPostprocessor
    {
        public const string ModelRoot = "Assets/Art/Models/Characters/";
        public const string TextureRoot = "Assets/Art/Textures/Characters/";

        void OnPreprocessModel()
        {
            if (!assetPath.StartsWith(ModelRoot)) return;
            var mi = (ModelImporter)assetImporter;
            mi.globalScale = 1f;
            mi.useFileScale = true;
            mi.bakeAxisConversion = true;
            mi.importBlendShapes = true;
            mi.importBlendShapeNormals = ModelImporterNormals.Calculate;
            mi.importNormals = ModelImporterNormals.Import;
            mi.importTangents = ModelImporterTangents.CalculateMikk;
            mi.weldVertices = false;                     // UV seams and hair cards must stay split
            mi.optimizeMeshPolygons = true;
            mi.optimizeMeshVertices = true;
            mi.meshCompression = ModelImporterMeshCompression.Off;
            mi.isReadable = false;
            mi.importCameras = false;
            mi.importLights = false;
            mi.importVisibility = false;
            mi.animationType = ModelImporterAnimationType.Human;
            mi.avatarSetup = ModelImporterAvatarSetup.CreateFromThisModel;
            mi.optimizeGameObjects = false;              // HumanCharacter finds the eye bones by name
            mi.skinWeights = ModelImporterSkinWeights.Custom;
            mi.maxBonesPerVertex = 4;
            mi.importAnimation = false;
            mi.materialImportMode = ModelImporterMaterialImportMode.ImportViaMaterialDescription;
            mi.materialLocation = ModelImporterMaterialLocation.InPrefab;
        }

        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(TextureRoot)) return;
            var ti = (TextureImporter)assetImporter;
            string name = System.IO.Path.GetFileNameWithoutExtension(assetPath);
            ti.mipmapEnabled = true;
            ti.mipmapFilter = TextureImporterMipFilter.KaiserFilter;
            ti.anisoLevel = 8;
            ti.wrapMode = name.Contains("Detail") ? TextureWrapMode.Repeat : TextureWrapMode.Clamp;
            ti.maxTextureSize = 4096;
            ti.textureCompression = TextureImporterCompression.CompressedHQ;
            ti.alphaSource = TextureImporterAlphaSource.FromInput;

            if (name.EndsWith("_Normal"))
            {
                ti.textureType = TextureImporterType.NormalMap;
                ti.sRGBTexture = false;
                SetFormat(ti, TextureImporterFormat.BC5);
            }
            else if (name.EndsWith("_BaseColor"))
            {
                ti.textureType = TextureImporterType.Default;
                ti.sRGBTexture = true;
                ti.alphaSource = TextureImporterAlphaSource.None;
                SetFormat(ti, TextureImporterFormat.BC7);
            }
            else if (name.EndsWith("_HairCards"))
            {
                ti.textureType = TextureImporterType.Default;
                ti.sRGBTexture = false;
                ti.alphaIsTransparency = false;
                ti.mipMapsPreserveCoverage = true;
                ti.alphaTestReferenceValue = 0.5f;
                ti.mipmapFilter = TextureImporterMipFilter.BoxFilter;
                SetFormat(ti, TextureImporterFormat.BC7);
            }
            else
            {
                ti.textureType = TextureImporterType.Default;
                ti.sRGBTexture = false;
                SetFormat(ti, TextureImporterFormat.BC7);
            }
        }

        static void SetFormat(TextureImporter ti, TextureImporterFormat format)
        {
            foreach (var platform in new[] { "Standalone", "Windows Store Apps" })
            {
                var s = ti.GetPlatformTextureSettings(platform);
                s.overridden = true;
                s.format = format;
                s.maxTextureSize = 4096;
                ti.SetPlatformTextureSettings(s);
            }
        }
    }
}
