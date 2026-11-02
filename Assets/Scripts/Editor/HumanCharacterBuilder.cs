using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using Voxelwild.Characters;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// Builds the Human_Adam character from the Blender export (tools/blender/human): creates the
    /// materials for the Voxelwild/Character/* shaders, remaps the FBX's material slots to them by name,
    /// and saves a prefab with HumanCharacter (blinks, gaze, voxel light). Also builds a look-dev scene.
    /// Re-run after re-exporting from Blender; nothing here is meant to be edited by hand.
    /// </summary>
    public static class HumanCharacterBuilder
    {
        public const string Name = "Human_Adam";
        public const string ModelPath = CharacterAssetPostprocessor.ModelRoot + "Human/" + Name + ".fbx";
        public const string TexDir = CharacterAssetPostprocessor.TextureRoot + "Human/";
        public const string MatDir = "Assets/Art/Materials/Characters/Human/";
        public const string PrefabPath = "Assets/Art/Prefabs/Characters/" + Name + ".prefab";
        public const string LookdevScene = "Assets/Scenes/HumanLookdev.unity";

        [MenuItem("Voxelwild/Art/Build Human Character")]
        public static void Build()
        {
            Directory.CreateDirectory(MatDir);
            Directory.CreateDirectory(Path.GetDirectoryName(PrefabPath));
            AssetDatabase.Refresh();

            var skin = Shader.Find("Voxelwild/Character/Skin");
            var eye = Shader.Find("Voxelwild/Character/Eye");
            var cornea = Shader.Find("Voxelwild/Character/Cornea");
            var occl = Shader.Find("Voxelwild/Character/EyeOcclusion");
            var hair = Shader.Find("Voxelwild/Character/Hair");
            var detail = Tex("T_Human_SkinDetail_Normal");

            var head = Mat("M_Human_Head", skin, m =>
            {
                m.SetTexture("_BaseMap", Tex("T_Human_Head_BaseColor"));
                m.SetTexture("_NormalMap", Tex("T_Human_Head_Normal"));
                m.SetTexture("_MaskMap", Tex("T_Human_Head_Mask"));
                m.SetTexture("_DetailNormalMap", detail);
                m.SetFloat("_DetailTiling", 30f);
            });
            var body = Mat("M_Human_Body", skin, m =>
            {
                m.SetTexture("_BaseMap", Tex("T_Human_Body_BaseColor"));
                m.SetTexture("_NormalMap", Tex("T_Human_Body_Normal"));
                m.SetTexture("_MaskMap", Tex("T_Human_Body_Mask"));
                m.SetTexture("_DetailNormalMap", detail);
                m.SetFloat("_DetailTiling", 130f);      // body UVs are ~5x larger per unit than the head's
            });
            var sclera = Mat("M_Human_Sclera", eye, m =>
            {
                m.SetTexture("_BaseMap", Tex("T_Human_Sclera_BaseColor"));
                m.SetFloat("_Iris", 0f);
                m.DisableKeyword("_EYE_IRIS");
                m.SetFloat("_Wrap", 0.45f);
            });
            var iris = Mat("M_Human_Iris", eye, m =>
            {
                m.SetTexture("_BaseMap", Tex("T_Human_Iris_BaseColor"));
                m.SetTexture("_NormalMap", Tex("T_Human_Iris_Normal"));
                m.SetFloat("_Iris", 1f);
                m.EnableKeyword("_EYE_IRIS");
                m.SetFloat("_Wrap", 0.15f);
            });
            var corneaMat = Mat("M_Human_Cornea", cornea, m => { m.SetFloat("_Roughness", 0.02f); });
            var wet = Mat("M_Human_EyeWet", cornea, m => { m.SetFloat("_Roughness", 0.05f); m.SetFloat("_EdgeFade", 0.3f); });
            var occlusion = Mat("M_Human_EyeOcclusion", occl, null);
            var teeth = Mat("M_Human_Teeth", skin, m =>
            {
                m.SetTexture("_BaseMap", Tex("T_Human_Teeth_BaseColor"));
                m.SetFloat("_RoughnessScale", 0.3f);
                m.SetFloat("_Translucency", 0.15f);
                m.SetFloat("_ScatterWidth", 0.3f);
                m.SetFloat("_Sheen", 0f);
                m.SetFloat("_SpecularLevel", 1.4f);
            });
            var tongue = Mat("M_Human_Tongue", skin, m =>
            {
                m.SetTexture("_BaseMap", Tex("T_Human_Tongue_BaseColor"));
                m.SetFloat("_RoughnessScale", 0.35f);
                m.SetFloat("_Translucency", 0.3f);
                m.SetFloat("_Sheen", 0f);
            });
            var hairMat = Mat("M_Human_Hair", hair, m =>
            {
                m.SetTexture("_BaseMap", Tex("T_Human_HairCards"));
                m.SetFloat("_Ribbon", 0f);
                m.DisableKeyword("_RIBBON");
                m.SetColor("_HairColor", new Color(0.20f, 0.14f, 0.10f));
            });
            var lashes = Mat("M_Human_Eyelashes", hair, m =>
            {
                m.SetFloat("_Ribbon", 1f);
                m.EnableKeyword("_RIBBON");
                m.SetColor("_HairColor", new Color(0.06f, 0.05f, 0.045f));
                m.SetFloat("_Cutoff", 0.35f);
                m.SetFloat("_SpecStrength1", 0.08f);
            });
            var brows = Mat("M_Human_Eyebrows", hair, m =>
            {
                m.SetFloat("_Ribbon", 1f);
                m.EnableKeyword("_RIBBON");
                m.SetColor("_HairColor", new Color(0.15f, 0.11f, 0.08f));
                m.SetFloat("_Cutoff", 0.4f);
            });

            // remap the FBX material slots (named after the Blender materials) to the generated assets
            var importer = AssetImporter.GetAtPath(ModelPath) as ModelImporter;
            if (importer == null)
            {
                Debug.LogError($"[Human] {ModelPath} not found. Run tools/blender/human/build_human.py --stage full first.");
                return;
            }
            foreach (var mat in new[] { head, body, sclera, iris, corneaMat, wet, occlusion, teeth, tongue, hairMat, lashes, brows })
                importer.AddRemap(new AssetImporter.SourceAssetIdentifier(typeof(Material), mat.name), mat);
            importer.SaveAndReimport();

            var model = AssetDatabase.LoadAssetAtPath<GameObject>(ModelPath);
            var instance = (GameObject)PrefabUtility.InstantiatePrefab(model);
            instance.name = Name;
            if (!instance.TryGetComponent<HumanCharacter>(out _)) instance.AddComponent<HumanCharacter>();
            foreach (var r in instance.GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                r.updateWhenOffscreen = false;
                r.skinnedMotionVectors = true;
                bool helper = r.name.Contains("Cornea") || r.name.Contains("EyeWet") || r.name.Contains("Occlusion");
                r.shadowCastingMode = helper ? ShadowCastingMode.Off : ShadowCastingMode.On;
            }
            PrefabUtility.SaveAsPrefabAsset(instance, PrefabPath);
            Object.DestroyImmediate(instance);
            AssetDatabase.SaveAssets();
            Debug.Log($"[Human] built {PrefabPath}");
        }

        [MenuItem("Voxelwild/Art/Human Look-dev Scene")]
        public static void BuildLookdevScene()
        {
            if (!File.Exists(PrefabPath)) Build();
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var sun = new GameObject("Key Light").AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 2.2f;
            sun.color = new Color(1f, 0.95f, 0.88f);
            sun.shadows = LightShadows.Soft;
            sun.transform.rotation = Quaternion.Euler(35f, 150f, 0f);
            var rim = new GameObject("Rim Light").AddComponent<Light>();
            rim.type = LightType.Spot;
            rim.range = 6f;
            rim.spotAngle = 40f;
            rim.intensity = 6f;
            rim.transform.position = new Vector3(0.9f, 2.1f, 1.2f);
            rim.transform.LookAt(new Vector3(0f, 1.65f, 0f));
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.55f, 0.6f, 0.7f);
            RenderSettings.ambientEquatorColor = new Color(0.4f, 0.38f, 0.36f);
            RenderSettings.ambientGroundColor = new Color(0.18f, 0.16f, 0.14f);

            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(PrefabPath);
            var human = (GameObject)PrefabUtility.InstantiatePrefab(prefab);
            var cam = new GameObject("Camera").AddComponent<Camera>();
            cam.tag = "MainCamera";
            cam.fieldOfView = 18f;
            cam.nearClipPlane = 0.02f;
            cam.transform.position = new Vector3(0.18f, 1.68f, -1.05f);
            cam.transform.LookAt(new Vector3(0f, 1.66f, 0f));
            human.GetComponent<HumanCharacter>().LookTarget = cam.transform;
            var probe = new GameObject("Reflection Probe").AddComponent<ReflectionProbe>();
            probe.transform.position = new Vector3(0f, 1.6f, 0f);
            probe.size = new Vector3(10f, 10f, 10f);
            Directory.CreateDirectory(Path.GetDirectoryName(LookdevScene));
            EditorSceneManager.SaveScene(scene, LookdevScene);
        }

        static Texture2D Tex(string name) => AssetDatabase.LoadAssetAtPath<Texture2D>(TexDir + name + ".png");

        static Material Mat(string name, Shader shader, System.Action<Material> setup)
        {
            string path = MatDir + name + ".mat";
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null)
            {
                m = new Material(shader) { name = name };
                AssetDatabase.CreateAsset(m, path);
            }
            m.shader = shader;
            setup?.Invoke(m);
            EditorUtility.SetDirty(m);
            return m;
        }
    }
}
