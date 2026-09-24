using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Voxelwild.Diagnostics;
using Voxelwild.Player;
using Voxelwild.Rendering;
using Voxelwild.World;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// Builds the World scene, its materials and render settings from code so the setup is
    /// reproducible and reviewable in version control. Safe to re-run: existing assets are updated.
    /// </summary>
    public static class WorldSceneBuilder
    {
        public const string ScenePath = "Assets/Scenes/World.unity";
        const string MaterialsFolder = "Assets/Art/Materials";
        const string RenderingSettingsFolder = "Assets/Settings/Rendering";

        /// <summary>Batch entry: texture arrays, then the scene that references them.</summary>
        [MenuItem("Voxelwild/Build All (Textures + Scene)")]
        public static void BuildAll()
        {
            BlockTextureArrays.Build();
            Build();
        }

        [MenuItem("Voxelwild/Rebuild World Scene")]
        public static void Build()
        {
            Directory.CreateDirectory(MaterialsFolder);
            Directory.CreateDirectory(RenderingSettingsFolder);
            AssetDatabase.Refresh();

            // New scene first: NewScene(Single) unloads unreferenced assets, which would
            // destroy anything we loaded or created before it.
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            ConfigureUrp();
            var profile = LayerProfile();
            var terrain = TerrainMaterial();
            var water = MaterialAt(MaterialsFolder + "/Water.mat", "Voxelwild/Water");
            water.SetColor("_ShallowColor", new Color(0.16f, 0.46f, 0.47f));
            water.SetColor("_DeepColor", new Color(0.02f, 0.11f, 0.16f));
            water.SetFloat("_Absorption", 0.16f);
            water.SetFloat("_MinAlpha", 0.42f);
            water.SetFloat("_RippleStrength", 0.12f);
            water.SetFloat("_Smoothness", 0.9f);
            EditorUtility.SetDirty(water);
            var outline = MaterialAt(MaterialsFolder + "/SelectionOutline.mat", "Voxelwild/SelectionOutline");
            var sky = SkyMaterial();
            var volumeProfile = PostProfile();
            AssetDatabase.SaveAssets();

            // Re-resolve everything from disk: objects created this call can be replaced on save/import,
            // and a stale in-memory reference serializes as null.
            profile = Reload(profile);
            terrain = Reload(terrain);
            water = Reload(water);
            outline = Reload(outline);
            sky = Reload(sky);
            volumeProfile = Reload(volumeProfile);

            // --- sun & environment
            var sunGo = new GameObject("Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1.0f, 0.955f, 0.88f);
            sun.intensity = 2.1f;
            sun.shadows = LightShadows.Soft;
            sun.shadowStrength = 1f;
            sun.shadowBias = 0.05f;
            sun.shadowNormalBias = 0.4f;
            sunGo.transform.rotation = Quaternion.Euler(47f, -38f, 0f);
            sunGo.AddComponent<UniversalAdditionalLightData>();
            sunGo.AddComponent<EnvironmentLighting>();

            RenderSettings.sun = sun;
            RenderSettings.skybox = sky;
            // Explicit sky/horizon/ground ambient until the Phase 4 atmosphere drives it dynamically.
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.50f, 0.62f, 0.80f) * 1.7f;
            RenderSettings.ambientEquatorColor = new Color(0.52f, 0.56f, 0.60f) * 1.35f;
            RenderSettings.ambientGroundColor = new Color(0.30f, 0.27f, 0.23f) * 1.1f;
            RenderSettings.ambientIntensity = 1.0f;
            RenderSettings.defaultReflectionMode = DefaultReflectionMode.Skybox;
            RenderSettings.reflectionIntensity = 1.0f;
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Linear;
            RenderSettings.fogColor = new Color(0.66f, 0.76f, 0.86f);
            RenderSettings.fogStartDistance = 140f;
            RenderSettings.fogEndDistance = 330f;

            var volumeGo = new GameObject("PostProcessing");
            var volume = volumeGo.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.sharedProfile = volumeProfile;

            // --- world
            var worldGo = new GameObject("VoxelWorld");
            var world = worldGo.AddComponent<VoxelWorld>();
            Assign(world, ("terrainMaterial", terrain), ("waterMaterial", water), ("layerProfile", profile));

            // --- player
            var playerGo = new GameObject("Player");
            var camGo = new GameObject("Camera");
            camGo.tag = "MainCamera";
            camGo.transform.SetParent(playerGo.transform, false);
            var cam = camGo.AddComponent<Camera>();
            cam.nearClipPlane = 0.05f;
            cam.farClipPlane = 1500f;
            cam.fieldOfView = 72f;
            cam.allowHDR = true;
            var camData = camGo.AddComponent<UniversalAdditionalCameraData>();
            camData.renderPostProcessing = true;
            camData.antialiasing = AntialiasingMode.SubpixelMorphologicalAntiAliasing;
            camData.antialiasingQuality = AntialiasingQuality.High;
            camGo.AddComponent<AudioListener>();

            var controller = playerGo.AddComponent<PlayerController>();
            Assign(controller, ("world", world), ("cameraPivot", camGo.transform));
            Assign(world, ("viewer", playerGo.transform));

            var outlineGo = new GameObject("SelectionOutline");
            outlineGo.AddComponent<MeshFilter>();
            outlineGo.AddComponent<MeshRenderer>().sharedMaterial = outline;
            var selection = outlineGo.AddComponent<SelectionOutline>();

            var interactor = playerGo.AddComponent<BlockInteractor>();
            Assign(interactor, ("world", world), ("player", controller), ("outline", selection));

            // --- diagnostics
            var diagGo = new GameObject("Diagnostics");
            var hud = diagGo.AddComponent<DebugHud>();
            Assign(hud, ("world", world), ("player", controller), ("interactor", interactor));
            var director = diagGo.AddComponent<ScreenshotDirector>();
            Assign(director, ("world", world), ("player", controller), ("interactor", interactor), ("captureCamera", cam), ("hud", hud));

            EditorSceneManager.SaveScene(scene, ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };

            BakeEnvironment();
            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
            Debug.Log("[WorldSceneBuilder] World scene rebuilt");
        }

        static void BakeEnvironment()
        {
            // No static geometry: the bake only produces the ambient probe and skybox reflection.
            const string settingsPath = "Assets/Scenes/World.lighting";
            var settings = AssetDatabase.LoadAssetAtPath<LightingSettings>(settingsPath);
            if (settings == null)
            {
                settings = new LightingSettings { name = "World" };
                AssetDatabase.CreateAsset(settings, settingsPath);
            }
            settings.bakedGI = false;
            settings.realtimeGI = false;
            Lightmapping.lightingSettings = settings;
            if (!Lightmapping.Bake()) Debug.LogWarning("[WorldSceneBuilder] environment bake failed");
        }

        static void ConfigureUrp()
        {
            foreach (var guid in AssetDatabase.FindAssets("t:UniversalRenderPipelineAsset"))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                if (!path.Contains("PC_")) continue;
                var so = new SerializedObject(AssetDatabase.LoadMainAssetAtPath(path));
                so.FindProperty("m_ShadowDistance").floatValue = 150f;
                so.FindProperty("m_ShadowCascadeCount").intValue = 4;
                so.FindProperty("m_Cascade4Split").vector3Value = new Vector3(0.06f, 0.16f, 0.38f);
                so.FindProperty("m_MainLightShadowmapResolution").intValue = 4096;
                so.FindProperty("m_SoftShadowQuality").intValue = 3;
                so.FindProperty("m_ShadowDepthBias").floatValue = 0.6f;
                so.FindProperty("m_ShadowNormalBias").floatValue = 0.6f;
                so.FindProperty("m_RequireDepthTexture").boolValue = true;
                so.FindProperty("m_RequireOpaqueTexture").boolValue = true;
                so.FindProperty("m_SupportsHDR").boolValue = true;
                so.ApplyModifiedPropertiesWithoutUndo();
            }

            foreach (var guid in AssetDatabase.FindAssets("t:UniversalRendererData"))
            {
                var path = AssetDatabase.GUIDToAssetPath(guid);
                if (!path.Contains("PC_")) continue;
                foreach (var obj in AssetDatabase.LoadAllAssetsAtPath(path))
                {
                    if (obj == null || obj.GetType().Name != "ScreenSpaceAmbientOcclusion") continue;
                    var so = new SerializedObject(obj);
                    so.FindProperty("m_Settings.Intensity").floatValue = 0.9f;
                    so.FindProperty("m_Settings.Radius").floatValue = 0.45f;
                    so.FindProperty("m_Settings.DirectLightingStrength").floatValue = 0.3f;
                    so.ApplyModifiedPropertiesWithoutUndo();
                }
            }
        }

        static TerrainLayerProfile LayerProfile()
        {
            const string path = RenderingSettingsFolder + "/TerrainLayerProfile.asset";
            var profile = AssetDatabase.LoadAssetAtPath<TerrainLayerProfile>(path);
            var manifest = BlockTextureArrays.LoadManifest();
            if (profile != null && profile.layers.Length == manifest.layers.Length) return profile;

            if (profile == null)
            {
                profile = ScriptableObject.CreateInstance<TerrainLayerProfile>();
                AssetDatabase.CreateAsset(profile, path);
            }
            // Starting values tuned against the capture screenshots; edit the asset to art-direct further.
            profile.layers = new TerrainLayerProfile.Layer[manifest.layers.Length];
            for (int i = 0; i < manifest.layers.Length; i++)
            {
                string n = manifest.layers[i].name;
                bool built = n == "Cobblestone" || n == "Planks" || n == "Bricks";
                var layer = new TerrainLayerProfile.Layer
                {
                    name = n,
                    blocksPerTile = built ? 1f : n == "GrassTop" ? 2f : 2.5f,
                    normalStrength = built ? 1.0f : 1.15f,
                    roughnessScale = 1.15f,
                    macroVariation = built ? 0.12f : 0.4f,
                    tint = Color.white,
                };
                switch (n)
                {
                    case "Stone": layer.tint = new Color(1.45f, 1.42f, 1.38f); layer.roughnessScale = 1.35f; break;
                    case "Bedrock": layer.tint = new Color(1.3f, 1.3f, 1.3f); layer.roughnessScale = 1.3f; break;
                    case "GrassTop": layer.tint = new Color(0.92f, 1.0f, 0.86f); layer.roughnessScale = 1.8f; break;
                    case "Dirt": layer.roughnessScale = 1.3f; break;
                    case "Snow": layer.roughnessScale = 1.2f; layer.macroVariation = 0.15f; break;
                }
                profile.layers[i] = layer;
            }
            EditorUtility.SetDirty(profile);
            return profile;
        }

        static Material TerrainMaterial()
        {
            var m = MaterialAt(MaterialsFolder + "/Terrain.mat", "Voxelwild/Terrain");
            m.SetTexture("_AlbedoArray", AssetDatabase.LoadAssetAtPath<Texture2DArray>(BlockTextureArrays.AlbedoPath));
            m.SetTexture("_NormalArray", AssetDatabase.LoadAssetAtPath<Texture2DArray>(BlockTextureArrays.NormalPath));
            m.SetTexture("_MaskArray", AssetDatabase.LoadAssetAtPath<Texture2DArray>(BlockTextureArrays.MaskPath));
            if (m.GetTexture("_AlbedoArray") == null)
                Debug.LogError("[WorldSceneBuilder] block texture arrays missing: run Voxelwild/Art/Build Block Texture Arrays first");
            m.SetFloat("_BevelWidth", 0.075f);
            m.SetFloat("_BevelStrength", 0.8f);
            m.SetFloat("_EdgeWear", 0.12f);
            m.SetFloat("_VoxelAOStrength", 0.85f);
            m.SetFloat("_VoxelAODirect", 0.3f);
            m.SetFloat("_GrassOverhang", 0.24f);
            EditorUtility.SetDirty(m);
            return m;
        }

        static Material SkyMaterial()
        {
            var m = MaterialAt(MaterialsFolder + "/Sky.mat", "Skybox/Procedural");
            m.SetFloat("_SunDisk", 2);
            m.SetFloat("_SunSize", 0.035f);
            m.SetFloat("_SunSizeConvergence", 6f);
            m.SetFloat("_AtmosphereThickness", 0.9f);
            m.SetColor("_SkyTint", new Color(0.46f, 0.52f, 0.62f));
            m.SetColor("_GroundColor", new Color(0.62f, 0.70f, 0.78f));   // matches the fog so the world edge blends
            m.SetFloat("_Exposure", 1.2f);
            EditorUtility.SetDirty(m);
            return m;
        }

        static VolumeProfile PostProfile()
        {
            const string path = RenderingSettingsFolder + "/WorldPostProfile.asset";
            var profile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(path);
            if (profile == null)
            {
                profile = ScriptableObject.CreateInstance<VolumeProfile>();
                AssetDatabase.CreateAsset(profile, path);
            }

            var tone = Get<Tonemapping>(profile);
            tone.mode.Override(TonemappingMode.ACES);

            var bloom = Get<Bloom>(profile);
            bloom.intensity.Override(0.22f);
            bloom.threshold.Override(1.1f);
            bloom.scatter.Override(0.65f);

            var color = Get<ColorAdjustments>(profile);
            color.postExposure.Override(0.25f);
            color.contrast.Override(12f);
            color.saturation.Override(6f);

            var wb = Get<WhiteBalance>(profile);
            wb.temperature.Override(4f);

            var vignette = Get<Vignette>(profile);
            vignette.intensity.Override(0.16f);
            vignette.smoothness.Override(0.45f);

            EditorUtility.SetDirty(profile);
            return profile;
        }

        static T Get<T>(VolumeProfile profile) where T : VolumeComponent
        {
            if (profile.TryGet<T>(out var c)) return c;
            c = profile.Add<T>(false);
            c.name = typeof(T).Name;
            AssetDatabase.AddObjectToAsset(c, profile);
            return c;
        }

        static Material MaterialAt(string path, string shaderName)
        {
            var shader = Shader.Find(shaderName);
            if (shader == null) throw new System.Exception($"shader {shaderName} not found");
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null)
            {
                m = new Material(shader);
                AssetDatabase.CreateAsset(m, path);
            }
            else if (m.shader != shader) m.shader = shader;
            return m;
        }

        static T Reload<T>(T asset) where T : Object
        {
            string path = AssetDatabase.GetAssetPath(asset);
            var loaded = string.IsNullOrEmpty(path) ? null : AssetDatabase.LoadAssetAtPath<T>(path);
            if (loaded == null) throw new System.Exception($"asset {typeof(T).Name} at '{path}' could not be reloaded");
            return loaded;
        }

        static void Assign(Object target, params (string field, Object value)[] values)
        {
            var so = new SerializedObject(target);
            foreach (var (field, value) in values)
            {
                var p = so.FindProperty(field);
                if (p == null) throw new System.Exception($"{target.GetType().Name}.{field} not found");
                if (value == null) throw new System.Exception($"{target.GetType().Name}.{field}: value is null");
                p.objectReferenceValue = value;
            }
            so.ApplyModifiedPropertiesWithoutUndo();
            so.Update();
            foreach (var (field, _) in values)
                if (so.FindProperty(field).objectReferenceValue == null)
                    throw new System.Exception($"{target.GetType().Name}.{field} did not persist");
        }
    }
}
