using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Voxelwild.Rendering;
using Voxelwild.World.Props;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// The Phase 3 quality gate: renders every prop in the library with the real Voxelwild/Prop materials,
    /// block texture arrays and layer tuning. Each asset gets one strip in Screenshots/turntables/: LOD0 from
    /// four sides, then LOD1 and LOD2 from the first side, on a 1 m grid-lined stone floor for scale.
    /// <code>Unity -batchmode -projectPath . -quit -executeMethod Voxelwild.EditorTools.PropTurntable.CaptureAll</code>
    /// </summary>
    public static class PropTurntable
    {
        const int Tile = 384;
        const string OutFolder = "Screenshots/turntables";
        static readonly int PropLightId = Shader.PropertyToID("_PropLight");

        [MenuItem("Voxelwild/Art/Capture Prop Turntables")]
        public static void CaptureMenu()
        {
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            CaptureAll();
        }

        public static void CaptureAll()
        {
            var library = AssetDatabase.LoadAssetAtPath<PropLibrary>(PropLibraryBuilder.LibraryPath);
            if (library == null || library.entries.Length == 0)
            {
                Debug.LogError("[PropTurntable] no prop library: run Voxelwild/Art/Build Prop Library");
                return;
            }
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            SetupStage(out var camera);
            Directory.CreateDirectory(OutFolder);
            var rt = new RenderTexture(Tile, Tile, 24, RenderTextureFormat.ARGB32, RenderTextureReadWrite.sRGB);
            var mpb = new MaterialPropertyBlock();
            mpb.SetVector(PropLightId, new Vector4(1f, 0f, 0.55f, 0.5f));   // open sky, no torch light, temperate climate

            int done = 0;
            foreach (var e in library.entries)
            {
                if (e.lods.Length == 0) continue;
                var views = new[] { (0, 30f), (0, 120f), (0, 210f), (0, 300f), (1, 30f), (2, 30f) };
                var strip = new Texture2D(Tile * views.Length, Tile, TextureFormat.RGB24, false);
                for (int v = 0; v < views.Length; v++)
                {
                    var (lod, yaw) = views[v];
                    lod = Mathf.Min(lod, e.lods.Length - 1);
                    var go = new GameObject(e.name);
                    go.AddComponent<MeshFilter>().sharedMesh = e.lods[lod].mesh;
                    var r = go.AddComponent<MeshRenderer>();
                    r.sharedMaterials = e.lods[lod].materials;
                    r.SetPropertyBlock(mpb);
                    if (e.hang) go.transform.position = new Vector3(0, 3f, 0);
                    Frame(camera, e, yaw);
                    Render(camera, rt);
                    RenderTexture.active = rt;
                    var tile = new Texture2D(Tile, Tile, TextureFormat.RGB24, false);
                    tile.ReadPixels(new Rect(0, 0, Tile, Tile), 0, 0);
                    tile.Apply();
                    strip.SetPixels(v * Tile, 0, Tile, Tile, tile.GetPixels());
                    Object.DestroyImmediate(tile);
                    Object.DestroyImmediate(go);
                }
                strip.Apply();
                File.WriteAllBytes($"{OutFolder}/{e.name}.png", strip.EncodeToPNG());
                Object.DestroyImmediate(strip);
                done++;
            }
            RenderTexture.active = null;
            rt.Release();
            Debug.Log($"[PropTurntable] {done} props -> {OutFolder}/");
        }

        /// <summary>Same path as the capture tool: a URP render request, falling back to Camera.Render.</summary>
        static void Render(Camera camera, RenderTexture rt)
        {
            var request = new RenderPipeline.StandardRequest { destination = rt };
            if (RenderPipeline.SupportsRenderRequest(camera, request))
                RenderPipeline.SubmitRenderRequest(camera, request);
            else
            {
                camera.targetTexture = rt;
                camera.Render();
                camera.targetTexture = null;
            }
        }

        static void Frame(Camera camera, PropLibrary.Entry e, float yaw)
        {
            float baseY = e.hang ? 3f : 0f;
            float h = e.top - e.bottom;
            var centre = new Vector3(0, baseY + (e.top + e.bottom) * 0.5f, 0);
            float extent = Mathf.Max(h, e.radius * 2f) * 0.6f + 0.15f;
            float dist = extent / Mathf.Tan(camera.fieldOfView * 0.5f * Mathf.Deg2Rad) * 1.15f;
            float pitch = e.hang ? -20f : 22f;
            var rot = Quaternion.Euler(-pitch, yaw, 0);
            camera.transform.position = centre - rot * Vector3.forward * dist;
            camera.transform.LookAt(centre);
            camera.farClipPlane = dist * 4f + 50f;
        }

        static void SetupStage(out Camera camera)
        {
            var profile = AssetDatabase.LoadAssetAtPath<TerrainLayerProfile>("Assets/Settings/Rendering/TerrainLayerProfile.asset");
            if (profile != null) profile.ApplyGlobals();
            Shader.SetGlobalVector("_VoxelBlockLightColor", (Vector4)(new Color(1f, 0.83f, 0.64f).linear * 1.8f));
            Shader.SetGlobalVector("_VoxelWind", new Vector4(0.8f, 0f, 0.6f, 0f));

            var sunGo = new GameObject("Sun");
            var sun = sunGo.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = new Color(1.0f, 0.955f, 0.88f);
            sun.intensity = 2.1f;
            sun.shadows = LightShadows.Soft;
            sunGo.transform.rotation = Quaternion.Euler(47f, -38f, 0f);
            sunGo.AddComponent<UniversalAdditionalLightData>();
            RenderSettings.sun = sun;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = new Color(0.50f, 0.62f, 0.80f) * 1.7f;
            RenderSettings.ambientEquatorColor = new Color(0.52f, 0.56f, 0.60f) * 1.35f;
            RenderSettings.ambientGroundColor = new Color(0.30f, 0.27f, 0.23f) * 1.1f;
            RenderSettings.fog = false;

            // floor (and a ceiling slab for hanging props): plain planes, 1 m cells from a URP Lit grid texture
            var grid = new Texture2D(64, 64) { filterMode = FilterMode.Bilinear, wrapMode = TextureWrapMode.Repeat };
            for (int y = 0; y < 64; y++)
            for (int x = 0; x < 64; x++)
                grid.SetPixel(x, y, x < 1 || y < 1 ? new Color(0.22f, 0.21f, 0.2f) : new Color(0.42f, 0.4f, 0.37f));
            grid.Apply();
            var lit = new Material(Shader.Find("Universal Render Pipeline/Lit"));
            lit.SetTexture("_BaseMap", grid);
            lit.SetTextureScale("_BaseMap", new Vector2(12, 12));
            lit.SetFloat("_Smoothness", 0.1f);
            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.transform.localScale = new Vector3(1.2f, 1f, 1.2f);
            floor.GetComponent<MeshRenderer>().sharedMaterial = lit;
            var ceiling = GameObject.CreatePrimitive(PrimitiveType.Plane);
            ceiling.transform.SetPositionAndRotation(new Vector3(0, 3f, 0), Quaternion.Euler(180f, 0, 0));
            ceiling.transform.localScale = new Vector3(0.4f, 1f, 0.4f);
            ceiling.GetComponent<MeshRenderer>().sharedMaterial = lit;

            var camGo = new GameObject("TurntableCamera");
            camera = camGo.AddComponent<Camera>();
            camera.fieldOfView = 35f;
            camera.nearClipPlane = 0.05f;
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = new Color(0.62f, 0.7f, 0.78f);
            camera.allowHDR = true;
            var data = camGo.AddComponent<UniversalAdditionalCameraData>();
            data.renderPostProcessing = false;
            data.antialiasing = AntialiasingMode.None;
        }
    }
}
