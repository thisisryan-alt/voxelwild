using System.Linq;
using NUnit.Framework;
using UnityEditor;
using UnityEngine;
using Voxelwild.EditorTools;

namespace Voxelwild.Tests
{
    /// <summary>
    /// The human character as Unity sees it: shaders compile, the FBX imports as a valid Humanoid with
    /// LODs, blend shapes and the expected material slots, and textures get the right import settings.
    /// </summary>
    public class CharacterAssetTests
    {
        static readonly string[] Shaders =
        {
            "Voxelwild/Character/Skin", "Voxelwild/Character/Eye", "Voxelwild/Character/Cornea",
            "Voxelwild/Character/EyeOcclusion", "Voxelwild/Character/Hair",
        };

        [TestCaseSource(nameof(Shaders))]
        public void CharacterShaderCompiles(string name)
        {
            var shader = Shader.Find(name);
            Assert.IsNotNull(shader, $"{name} not found");
            var messages = ShaderUtil.GetShaderMessages(shader);
            var errors = messages.Where(m => m.severity == UnityEditor.Rendering.ShaderCompilerMessageSeverity.Error).ToArray();
            Assert.IsFalse(ShaderUtil.ShaderHasError(shader),
                $"{name}: {string.Join("\n", errors.Select(e => $"{e.file}:{e.line} {e.message}"))}");
        }

        [Test]
        public void HumanModelImportsAsHumanoidWithLodsAndBlendShapes()
        {
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(HumanCharacterBuilder.ModelPath);
            Assert.IsNotNull(model, $"{HumanCharacterBuilder.ModelPath} missing (run build_human.py --stage full)");
            var animator = model.GetComponent<Animator>();
            Assert.IsNotNull(animator);
            Assert.IsNotNull(animator.avatar);
            Assert.IsTrue(animator.avatar.isValid && animator.avatar.isHuman, "avatar is not a valid Humanoid");

            var lod = model.GetComponent<LODGroup>();
            Assert.IsNotNull(lod, "no LODGroup (meshes must end in _LOD0.._LOD2)");
            Assert.GreaterOrEqual(lod.lodCount, 3);

            var body = model.GetComponentsInChildren<SkinnedMeshRenderer>(true).First(r => r.name.EndsWith("Body_LOD0"));
            var mesh = body.sharedMesh;
            foreach (var shape in new[] { "eyeBlinkLeft", "eyeBlinkRight", "jawOpen", "mouthSmile", "browInnerUpLeft" })
                Assert.GreaterOrEqual(mesh.GetBlendShapeIndex(shape), 0, $"Body_LOD0 lacks {shape}");
            Assert.AreEqual(2, mesh.subMeshCount, "body should have head + body submeshes");

            var lashes = model.GetComponentsInChildren<SkinnedMeshRenderer>(true).First(r => r.name.Contains("Eyelashes_L_LOD0"));
            Assert.GreaterOrEqual(lashes.sharedMesh.GetBlendShapeIndex("eyeBlinkLeft"), 0, "lashes must follow the blink");
        }

        [Test]
        public void HumanTexturesHaveCharacterImportSettings()
        {
            var normal = (TextureImporter)AssetImporter.GetAtPath(HumanCharacterBuilder.TexDir + "T_Human_Head_Normal.png");
            Assert.IsNotNull(normal);
            Assert.AreEqual(TextureImporterType.NormalMap, normal.textureType);
            var mask = (TextureImporter)AssetImporter.GetAtPath(HumanCharacterBuilder.TexDir + "T_Human_Head_Mask.png");
            Assert.IsFalse(mask.sRGBTexture, "mask must be linear");
            var color = (TextureImporter)AssetImporter.GetAtPath(HumanCharacterBuilder.TexDir + "T_Human_Head_BaseColor.png");
            Assert.IsTrue(color.sRGBTexture);
            var cards = (TextureImporter)AssetImporter.GetAtPath(HumanCharacterBuilder.TexDir + "T_Human_HairCards.png");
            Assert.IsTrue(cards.mipMapsPreserveCoverage, "hair cards need alpha-coverage mips");
        }
    }
}
