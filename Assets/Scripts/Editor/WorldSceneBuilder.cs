using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using UnityEngine.UIElements;
using Voxelwild.Audio;
using Voxelwild.Diagnostics;
using Voxelwild.Gameplay;
using Voxelwild.Player;
using Voxelwild.Rendering;
using Voxelwild.UI;
using Voxelwild.World;
using Voxelwild.World.Props;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// Builds the World scene, its materials and render settings from code so the setup is
    /// reproducible and reviewable in version control. Safe to re-run: existing assets are updated.
    /// </summary>
    public static class WorldSceneBuilder
    {
        public const string ScenePath = "Assets/Scenes/World.unity";
        public const string MenuScenePath = "Assets/Scenes/MainMenu.unity";
        const string MaterialsFolder = "Assets/Art/Materials";
        const string RenderingSettingsFolder = "Assets/Settings/Rendering";
        const string UIFolder = "Assets/UI";
        /// <summary>Layer the item icon camera renders on; the player camera never draws it.</summary>
        const int IconLayer = 31;

        /// <summary>Batch entry: texture arrays, then the scene that references them.</summary>
        [MenuItem("Voxelwild/Build All (Textures + Props + Scene)")]
        public static void BuildAll()
        {
            BlockTextureArrays.Build();
            PropLibraryBuilder.Build();
            Build();
        }

        [MenuItem("Voxelwild/Rebuild World Scene")]
        public static void Build()
        {
            Directory.CreateDirectory(MaterialsFolder);
            Directory.CreateDirectory(RenderingSettingsFolder);
            Directory.CreateDirectory(UIFolder);
            WriteTheme();
            AssetDatabase.Refresh();

            // New scene first: NewScene(Single) unloads unreferenced assets, which would
            // destroy anything we loaded or created before it.
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            ConfigureUrp();
            var profile = LayerProfile();
            var terrain = TerrainMaterial("Terrain", "Voxelwild/Terrain");
            var foliage = TerrainMaterial("Foliage", "Voxelwild/Foliage");
            foliage.SetFloat("_Cutoff", 0.5f);
            foliage.SetFloat("_Translucency", 1f);
            foliage.SetFloat("_VoxelAODirect", 0.15f);
            var water = MaterialAt(MaterialsFolder + "/Water.mat", "Voxelwild/Water");
            water.SetColor("_ShallowColor", new Color(0.16f, 0.46f, 0.47f));
            water.SetColor("_DeepColor", new Color(0.02f, 0.11f, 0.16f));
            water.SetFloat("_Absorption", 0.16f);
            water.SetFloat("_MinAlpha", 0.42f);
            water.SetFloat("_RippleStrength", 0.12f);
            water.SetFloat("_Smoothness", 0.9f);
            water.SetFloat("_Refraction", 0.035f);
            water.SetFloat("_FlowSpeed", 1.4f);
            water.SetFloat("_Foam", 1f);
            water.SetFloat("_Caustics", 1.2f);
            EditorUtility.SetDirty(water);
            var outline = MaterialAt(MaterialsFolder + "/SelectionOutline.mat", "Voxelwild/SelectionOutline");
            var sky = SkyMaterial();
            var volumeProfile = PostProfile();
            var token = MaterialAt(MaterialsFolder + "/ItemToken.mat", "Universal Render Pipeline/Lit");
            token.SetFloat("_Smoothness", 0.35f);
            token.enableInstancing = true;
            EditorUtility.SetDirty(token);
            var particles = MaterialAt(MaterialsFolder + "/Particles.mat", "Universal Render Pipeline/Particles/Simple Lit");
            particles.SetFloat("_Smoothness", 0.2f);
            EditorUtility.SetDirty(particles);
            var panel = HudPanelSettings();
            AssetDatabase.SaveAssets();

            // Re-resolve everything from disk: objects created this call can be replaced on save/import,
            // and a stale in-memory reference serializes as null.
            profile = Reload(profile);
            terrain = Reload(terrain);
            foliage = Reload(foliage);
            water = Reload(water);
            outline = Reload(outline);
            sky = Reload(sky);
            volumeProfile = Reload(volumeProfile);
            token = Reload(token);
            particles = Reload(particles);
            panel = Reload(panel);

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
            var dayNight = sunGo.AddComponent<DayNightCycle>();

            RenderSettings.sun = sun;
            RenderSettings.skybox = sky;
            // Trilight ambient; DayNightCycle drives the colours (these are the daylight values it starts from).
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
            Assign(world, ("terrainMaterial", terrain), ("foliageMaterial", foliage), ("waterMaterial", water), ("layerProfile", profile));
            var props = AssetDatabase.LoadAssetAtPath<PropLibrary>(PropLibraryBuilder.LibraryPath);
            if (props != null) Assign(world, ("propLibrary", props));
            else Debug.LogWarning("[WorldSceneBuilder] no prop library: run Voxelwild/Art/Build Prop Library, then rebuild the scene");

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
            cam.cullingMask = ~(1 << IconLayer);
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

            var underwater = playerGo.AddComponent<UnderwaterEffects>();
            Assign(underwater, ("player", controller), ("waterMaterial", water));

            // --- game rules (Phase 7): survival stats and inventory, dropped items, saving
            var survival = playerGo.AddComponent<PlayerSurvival>();
            Assign(survival, ("player", controller));

            var gameGo = new GameObject("Game");
            var items = gameGo.AddComponent<ItemEntities>();
            Assign(items, ("world", world), ("survival", survival), ("terrainMaterial", terrain), ("foliageMaterial", foliage),
                ("tokenMaterial", token));
            var icons = gameGo.AddComponent<ItemIcons>();
            Assign(icons, ("terrainMaterial", terrain), ("foliageMaterial", foliage));
            SetInt(icons, "iconLayer", IconLayer);
            var session = gameGo.AddComponent<GameSession>();
            Assign(session, ("world", world), ("player", controller), ("survival", survival), ("items", items), ("dayNight", dayNight));

            var interactor = playerGo.AddComponent<BlockInteractor>();
            Assign(interactor, ("world", world), ("player", controller), ("outline", selection), ("survival", survival), ("items", items));

            // --- diagnostics
            var diagGo = new GameObject("Diagnostics");
            var hud = diagGo.AddComponent<DebugHud>();
            Assign(hud, ("world", world), ("player", controller), ("interactor", interactor));
            var director = diagGo.AddComponent<ScreenshotDirector>();
            Assign(director, ("world", world), ("player", controller), ("interactor", interactor), ("captureCamera", cam), ("hud", hud), ("sun", sun));
            var pcRenderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>("Assets/Settings/PC_Renderer.asset");
            if (pcRenderer != null) Assign(director, ("rendererData", pcRenderer));
            Assign(director, ("dayNight", dayNight));

            var quality = worldGo.AddComponent<QualityManager>();
            Assign(quality, ("world", world), ("sun", sun), ("dayNight", dayNight), ("playerCamera", cam));
            if (pcRenderer != null) Assign(quality, ("rendererData", pcRenderer));
            Assign(hud, ("dayNight", dayNight), ("quality", quality));

            var weatherGo = new GameObject("Weather");
            var weather = weatherGo.AddComponent<WeatherSystem>();
            var precipitation = Shader.Find("Voxelwild/Precipitation");
            if (precipitation == null) throw new System.Exception("shader Voxelwild/Precipitation not found");
            Assign(weather, ("dayNight", dayNight), ("environment", sunGo.GetComponent<EnvironmentLighting>()), ("quality", quality),
                ("player", controller), ("world", world), ("sun", sun), ("precipitationShader", precipitation));
            Assign(hud, ("weather", weather));
            Assign(session, ("weather", weather));

            // --- UI
            var uiGo = new GameObject("UI");
            var doc = uiGo.AddComponent<UIDocument>();
            doc.panelSettings = panel;
            var gameHud = uiGo.AddComponent<GameHud>();
            Assign(gameHud, ("player", controller), ("survival", survival), ("interactor", interactor), ("session", session),
                ("icons", icons), ("debugHud", hud), ("world", world));
            var settingsApplier = uiGo.AddComponent<SettingsApplier>();
            Assign(settingsApplier, ("player", controller), ("playerCamera", cam));

            // pause menu: its own document drawn over the HUD
            var pauseGo = new GameObject("PauseMenu");
            var pauseDoc = pauseGo.AddComponent<UIDocument>();
            pauseDoc.panelSettings = panel;
            pauseDoc.sortingOrder = 10;
            var pause = pauseGo.AddComponent<PauseMenu>();
            Assign(pause, ("player", controller), ("session", session), ("hud", gameHud), ("quality", quality));

            // --- polish (Phase 8): sound, particles, pipeline warm-up
            var audioGo = new GameObject("Audio");
            var gameAudio = audioGo.AddComponent<GameAudio>();
            Assign(gameAudio, ("player", controller), ("world", world), ("interactor", interactor), ("survival", survival),
                ("items", items), ("weather", weather), ("dayNight", dayNight));

            var effects = gameGo.AddComponent<BlockEffects>();
            Assign(effects, ("world", world), ("player", controller), ("interactor", interactor), ("icons", icons),
                ("environment", sunGo.GetComponent<EnvironmentLighting>()), ("particleMaterial", particles));

            var warmup = gameGo.AddComponent<ShaderWarmup>();
            Assign(warmup, ("player", controller), ("playerCamera", cam), ("terrainMaterial", terrain), ("foliageMaterial", foliage),
                ("waterMaterial", water), ("tokenMaterial", token), ("particleMaterial", particles));
            if (props != null) Assign(warmup, ("props", props));

            EditorSceneManager.SaveScene(scene, ScenePath);

            BakeEnvironment();
            EditorSceneManager.SaveScene(scene, ScenePath);
            AssetDatabase.SaveAssets();
            Debug.Log("[WorldSceneBuilder] World scene rebuilt");

            BuildMenuScene(sky, volumeProfile, panel);
            // the title screen starts the game; World loads from it (or directly, for tests and captures)
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(MenuScenePath, true), new EditorBuildSettingsScene(ScenePath, true) };
            AssetDatabase.SaveAssets();
        }

        /// <summary>The title scene: the live sky at golden hour turning slowly behind the main menu.</summary>
        static void BuildMenuScene(Material sky, VolumeProfile volumeProfile, PanelSettings panel)
        {
            string skyPath = AssetDatabase.GetAssetPath(sky), volumePath = AssetDatabase.GetAssetPath(volumeProfile), panelPath = AssetDatabase.GetAssetPath(panel);
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            sky = AssetDatabase.LoadAssetAtPath<Material>(skyPath);
            volumeProfile = AssetDatabase.LoadAssetAtPath<VolumeProfile>(volumePath);
            panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(panelPath);

            var sunGo = new GameObject("Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1.0f, 0.955f, 0.88f);
            sun.intensity = 2.1f;
            sunGo.AddComponent<UniversalAdditionalLightData>();
            sunGo.AddComponent<EnvironmentLighting>();
            var dayNight = sunGo.AddComponent<DayNightCycle>();
            SetFloat(dayNight, "timeOfDay", 0.29f);          // early morning, sun low in the east
            SetFloat(dayNight, "dayLengthMinutes", 240f);    // barely moves while the menu is open

            RenderSettings.sun = sun;
            RenderSettings.skybox = sky;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.fog = false;

            var volumeGo = new GameObject("PostProcessing");
            var volume = volumeGo.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.sharedProfile = volumeProfile;

            var rig = new GameObject("CameraRig");
            rig.transform.rotation = Quaternion.Euler(0f, 60f, 0f);
            var camGo = new GameObject("Camera");
            camGo.tag = "MainCamera";
            camGo.transform.SetParent(rig.transform, false);
            camGo.transform.localPosition = new Vector3(0f, 80f, 0f);
            camGo.transform.localRotation = Quaternion.Euler(-9f, 0f, 0f);
            var cam = camGo.AddComponent<Camera>();
            cam.fieldOfView = 60f;
            cam.farClipPlane = 5000f;
            cam.allowHDR = true;
            cam.clearFlags = CameraClearFlags.Skybox;
            var camData = camGo.AddComponent<UniversalAdditionalCameraData>();
            camData.renderPostProcessing = true;
            camGo.AddComponent<AudioListener>();

            var audioGo = new GameObject("Audio");
            var gameAudio = audioGo.AddComponent<GameAudio>();
            Assign(gameAudio, ("dayNight", dayNight));

            var uiGo = new GameObject("UI");
            var doc = uiGo.AddComponent<UIDocument>();
            doc.panelSettings = panel;
            var menu = uiGo.AddComponent<MainMenu>();
            Assign(menu, ("cameraRig", rig.transform));

            EditorSceneManager.SaveScene(scene, MenuScenePath);
            Debug.Log("[WorldSceneBuilder] MainMenu scene rebuilt");
        }

        static void SetFloat(Object target, string field, float value)
        {
            var so = new SerializedObject(target);
            var p = so.FindProperty(field) ?? throw new System.Exception($"{target.GetType().Name}.{field} not found");
            p.floatValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
        }

        static void WriteTheme()
        {
            // runtime theme: Unity's default controls and font, nothing else (the HUD styles itself in code)
            string path = UIFolder + "/VoxelwildTheme.tss";
            const string content = "@import url(\"unity-theme://default\");\n";
            if (!File.Exists(path) || File.ReadAllText(path) != content) File.WriteAllText(path, content);
        }

        static PanelSettings HudPanelSettings()
        {
            const string path = UIFolder + "/HudPanelSettings.asset";
            var panel = AssetDatabase.LoadAssetAtPath<PanelSettings>(path);
            if (panel == null)
            {
                panel = ScriptableObject.CreateInstance<PanelSettings>();
                AssetDatabase.CreateAsset(panel, path);
            }
            AssetDatabase.ImportAsset(UIFolder + "/VoxelwildTheme.tss");
            panel.themeStyleSheet = AssetDatabase.LoadAssetAtPath<ThemeStyleSheet>(UIFolder + "/VoxelwildTheme.tss");
            if (panel.themeStyleSheet == null) Debug.LogError("[WorldSceneBuilder] UI theme did not import");
            // layouts are authored at 1600×900 and scale with the window
            panel.scaleMode = PanelScaleMode.ScaleWithScreenSize;
            panel.referenceResolution = new Vector2Int(1600, 900);
            panel.screenMatchMode = PanelScreenMatchMode.MatchWidthOrHeight;
            panel.match = 0.5f;
            panel.sortingOrder = 0;
            EditorUtility.SetDirty(panel);
            return panel;
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
                so.FindProperty("m_ShadowDistance").floatValue = 110f;
                so.FindProperty("m_ShadowCascadeCount").intValue = 4;
                so.FindProperty("m_Cascade4Split").vector3Value = new Vector3(0.08f, 0.2f, 0.45f);
                so.FindProperty("m_MainLightShadowmapResolution").intValue = 4096;
                so.FindProperty("m_SoftShadowQuality").intValue = 2;   // medium: high costs ~10 ms on integrated GPUs in forests
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
                var rendererSo = new SerializedObject(AssetDatabase.LoadMainAssetAtPath(path));
                // the SSAO depth-normals prepass already lays down depth: prime with it so the forward pass
                // shades each pixel once instead of once per overlapping leaf
                rendererSo.FindProperty("m_DepthPrimingMode").intValue = 2;   // Forced
                rendererSo.ApplyModifiedPropertiesWithoutUndo();
                foreach (var obj in AssetDatabase.LoadAllAssetsAtPath(path))
                {
                    if (obj == null || obj.GetType().Name != "ScreenSpaceAmbientOcclusion") continue;
                    var so = new SerializedObject(obj);
                    so.FindProperty("m_Settings.Intensity").floatValue = 0.9f;
                    so.FindProperty("m_Settings.Radius").floatValue = 0.45f;
                    so.FindProperty("m_Settings.DirectLightingStrength").floatValue = 0.3f;
                    so.FindProperty("m_Settings.Downsample").boolValue = true;
                    so.ApplyModifiedPropertiesWithoutUndo();
                }
            }
        }

        static TerrainLayerProfile LayerProfile()
        {
            const string path = RenderingSettingsFolder + "/TerrainLayerProfile.asset";
            var profile = AssetDatabase.LoadAssetAtPath<TerrainLayerProfile>(path);
            var manifest = BlockTextureArrays.LoadManifest();
            if (profile != null && profile.layers.Length == manifest.layers.Length)
            {
                if (profile.version < 2)
                {
                    // v2 added stochastic tiling: take the default per layer, keep all tuned values
                    for (int i = 0; i < profile.layers.Length; i++)
                        profile.layers[i].stochastic = DefaultLayer(profile.layers[i].name).stochastic;
                    profile.version = TerrainLayerProfile.CurrentVersion;
                    EditorUtility.SetDirty(profile);
                }
                return profile;
            }

            if (profile == null)
            {
                profile = ScriptableObject.CreateInstance<TerrainLayerProfile>();
                AssetDatabase.CreateAsset(profile, path);
            }
            // Starting values tuned against the capture screenshots; edit the asset to art-direct further.
            profile.version = TerrainLayerProfile.CurrentVersion;
            profile.layers = new TerrainLayerProfile.Layer[manifest.layers.Length];
            for (int i = 0; i < manifest.layers.Length; i++)
                profile.layers[i] = DefaultLayer(manifest.layers[i].name);
            EditorUtility.SetDirty(profile);
            return profile;
        }

        static TerrainLayerProfile.Layer DefaultLayer(string n)
        {
            bool built = n == "Cobblestone" || n == "Planks" || n == "Bricks";
            var layer = new TerrainLayerProfile.Layer
            {
                name = n,
                blocksPerTile = built ? 1f : n == "GrassTop" ? 2f : 2.5f,
                normalStrength = built ? 1.0f : 1.15f,
                roughnessScale = 1.15f,
                macroVariation = built ? 0.12f : 0.4f,
                tint = Color.white,
                specular = 1f,
            };
            switch (n)
            {
                case "Stone": layer.tint = new Color(1.45f, 1.42f, 1.38f); layer.roughnessScale = 1.35f; break;
                case "Bedrock": layer.tint = new Color(1.3f, 1.3f, 1.3f); layer.roughnessScale = 1.3f; break;
                case "GrassTop": layer.tint = new Color(0.84f, 0.92f, 0.76f); layer.roughnessScale = 1.8f; layer.biomeTint = true; break;
                case "Dirt": layer.roughnessScale = 1.3f; break;
                case "Snow": layer.roughnessScale = 1.2f; layer.macroVariation = 0.15f; break;
                case "OakLog": case "SpruceLog": case "JungleLog":
                    layer.blocksPerTile = 1.5f; layer.macroVariation = 0.15f; layer.roughnessScale = 1.3f; break;
                case "BirchLog":
                    layer.blocksPerTile = 1.5f; layer.macroVariation = 0.1f; layer.tint = new Color(1.55f, 1.52f, 1.45f); break;
                case "LogTop": layer.blocksPerTile = 1f; layer.macroVariation = 0.05f; break;
                case "Leaves":
                    layer.blocksPerTile = 1f; layer.macroVariation = 0.25f; layer.roughnessScale = 1.1f;
                    layer.tint = new Color(0.62f, 0.78f, 0.48f); layer.biomeTint = true; layer.cutout = true; layer.translucency = 0.9f; layer.roughnessScale = 1.5f; break;
                case "Needles":
                    layer.blocksPerTile = 1f; layer.macroVariation = 0.2f; layer.biomeTint = true; layer.cutout = true; layer.translucency = 0.5f; break;
                case "Sandstone": layer.tint = new Color(1.1f, 1.02f, 0.9f); layer.blocksPerTile = 2f; break;
                case "RedSandstone": layer.blocksPerTile = 3f; layer.tint = new Color(1.15f, 0.92f, 0.8f); break;
                case "Mud": layer.roughnessScale = 0.8f; break;
                case "Moss": layer.blocksPerTile = 2f; layer.roughnessScale = 1.3f; break;
                case "Ice": layer.blocksPerTile = 2f; layer.roughnessScale = 0.5f; layer.macroVariation = 0.1f; break;
                case "CoalOre": case "IronOre": case "GoldOre": case "DiamondOre":
                    layer.blocksPerTile = 1f; layer.macroVariation = 0.2f; layer.tint = new Color(1.45f, 1.42f, 1.38f); break;
                case "GrassTuft":
                    layer.blocksPerTile = 1f; layer.macroVariation = 0.2f; layer.biomeTint = true; layer.cutout = true;
                    layer.translucency = 1.0f; layer.roughnessScale = 1.3f; layer.tint = new Color(0.9f, 1f, 0.85f); break;
                case "FlowerRed": case "FlowerYellow": case "DeadBush":
                    layer.blocksPerTile = 1f; layer.macroVariation = 0f; layer.cutout = true; layer.translucency = 0.7f; break;
                case "Glowcap":
                    layer.blocksPerTile = 1f; layer.macroVariation = 0f; layer.cutout = true; layer.emission = 5f; layer.translucency = 0.4f; break;
                case "Torch": case "TorchTop":
                    layer.blocksPerTile = 1f; layer.macroVariation = 0f; layer.emission = 9f; break;
                case "Cactus": case "CactusTop": layer.blocksPerTile = 1f; layer.macroVariation = 0.1f; break;
            }
            // large natural scans repeat visibly across open ground
            layer.stochastic = n == "Stone" || n == "Dirt" || n == "GrassTop" || n == "Sand" || n == "Gravel" || n == "Snow"
                               || n == "Sandstone" || n == "RedSandstone" || n == "Mud" || n == "Moss";
            switch (n)
            {
                case "GrassTop": case "Leaves": case "Needles": case "GrassTuft": case "Moss": layer.specular = 0.3f; break;
                case "FlowerRed": case "FlowerYellow": case "DeadBush": case "Dirt": layer.specular = 0.5f; break;
            }
            return layer;
        }

        static Material TerrainMaterial(string name, string shader)
        {
            var m = MaterialAt(MaterialsFolder + $"/{name}.mat", shader);
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
            // physically based sky driven by DayNightCycle (scattering table, sun, moon, stars, clouds)
            var m = MaterialAt(MaterialsFolder + "/Sky.mat", "Voxelwild/Sky");
            m.SetFloat("_StarDensity", 0.9975f);
            m.SetFloat("_StarBrightness", 2.5f);
            m.SetFloat("_MoonSize", 1.6f);
            m.SetFloat("_SunSize", 0.6f);
            m.SetFloat("_HorizonFog", 0.12f);
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
            bloom.downscale.Override(BloomDownscaleMode.Quarter);
            bloom.maxIterations.Override(5);

            var color = Get<ColorAdjustments>(profile);
            color.postExposure.Override(0.25f);
            color.contrast.Override(12f);
            color.saturation.Override(0f);

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

        static void SetInt(Object target, string field, int value)
        {
            var so = new SerializedObject(target);
            var p = so.FindProperty(field) ?? throw new System.Exception($"{target.GetType().Name}.{field} not found");
            p.intValue = value;
            so.ApplyModifiedPropertiesWithoutUndo();
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
