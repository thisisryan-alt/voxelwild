using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.Rendering;
using Voxelwild.Player;
using Voxelwild.World;
using Voxelwild.World.Generation;

namespace Voxelwild.Diagnostics
{
    /// <summary>
    /// Automated visual/perf capture. Active only when the process is started with
    /// <c>-vwCapture &lt;outputDir&gt;</c> (works in a player build and in batch-mode play mode).
    /// Visits a set of viewpoints, waits for streaming to settle, renders real frames to PNG and
    /// writes a report with streaming and frame-time numbers. Never runs in normal play.
    /// </summary>
    public sealed class ScreenshotDirector : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] PlayerController player;
        [SerializeField] BlockInteractor interactor;
        [SerializeField] Camera captureCamera;
        [SerializeField] DebugHud hud;
        [SerializeField] UnityEngine.Rendering.Universal.UniversalRendererData rendererData;
        [SerializeField] Light sun;
        [SerializeField] Voxelwild.Rendering.DayNightCycle dayNight;
        [SerializeField] int width = 1600;
        [SerializeField] int height = 900;

        public static bool Finished { get; private set; }
        public static bool Failed { get; private set; }

        string _outDir;
        string[] _shotFilter;
        string _toggles = "";
        float _timeOfDay = 0.45f;       // mid-morning sun, close to the fixed Phase 2 sun, so captures stay comparable
        readonly StringBuilder _report = new StringBuilder();

        void Awake()
        {
            var args = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(args, "-vwCapture");
            if (i < 0 || i + 1 >= args.Length) { enabled = false; return; }
            _outDir = Path.GetFullPath(args[i + 1]);
            Directory.CreateDirectory(_outDir);
            int s = Array.IndexOf(args, "-vwShots");
            if (s >= 0 && s + 1 < args.Length) _shotFilter = args[s + 1].Split(',');
            int t = Array.IndexOf(args, "-vwToggles");
            if (t >= 0 && t + 1 < args.Length) _toggles = args[t + 1];
            int tod = Array.IndexOf(args, "-vwTime");
            if (tod >= 0 && tod + 1 < args.Length && float.TryParse(args[tod + 1], System.Globalization.NumberStyles.Float,
                    System.Globalization.CultureInfo.InvariantCulture, out float parsed))
                _timeOfDay = Mathf.Repeat(parsed, 1f);
            // measure real frame cost, not the display's refresh interval
            QualitySettings.vSyncCount = 0;
            Application.targetFrameRate = -1;
            Finished = false;
            Failed = false;
        }

        void Start()
        {
            if (!enabled) return;
            if (hud != null) hud.Hidden = true;
            if (dayNight != null)
            {
                dayNight.TimeOfDay = _timeOfDay;
                dayNight.Paused = true;
                _report.AppendLine($"time of day {_timeOfDay:0.000} (paused)");
            }
            ApplyDiagnosticToggles();
            // no targeting outline in captures (TryPlace/TryBreak still work with the component disabled)
            interactor.enabled = false;
            var outline = FindAnyObjectByType<SelectionOutline>();
            if (outline != null) outline.gameObject.SetActive(false);
            StartCoroutine(Run());
        }

        IEnumerator Run()
        {
            float t0 = Time.realtimeSinceStartup;
            _report.AppendLine($"Voxelwild capture {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            _report.AppendLine($"GPU {SystemInfo.graphicsDeviceName} ({SystemInfo.graphicsDeviceType}), CPU {SystemInfo.processorType} x{SystemInfo.processorCount}");
            _report.AppendLine($"view distance {world.ViewDistance} columns, seed {world.Seed}");

            while (!player.Spawned)
            {
                if (Time.realtimeSinceStartup - t0 > 180f) { Fail("spawn area never became ready"); yield break; }
                yield return null;
            }
            _report.AppendLine($"spawn ready after {Time.realtimeSinceStartup - t0:0.00}s at {player.Body.Position}");

            player.InputEnabled = false;
            float3 spawn = player.Body.Position;

            // Wait for the full view distance to stream in, then measure steady-state frame time.
            yield return WaitForStreaming(spawn, 240f);
            _report.AppendLine($"full view distance ready after {Time.realtimeSinceStartup - t0:0.00}s: {world.LoadedColumns} columns, {world.RenderedSections} sections, {world.RenderedTriangles / 1000}k tris");
            yield return MeasureFrames("idle at spawn", 120);

            BuildShowcase(spawn);
            yield return null;

            var shots = new List<Shot>();
            float3 eye = spawn + new float3(0, 1.62f, 0);
            shots.Add(new Shot("01_player_eye", eye, 35f, 8f));
            shots.Add(new Shot("02_showcase_closeup", spawn + new float3(-2.2f, 2.4f, -1.5f), 55f, 22f));
            shots.Add(new Shot("03_overview", spawn + new float3(-40f, 55f, -40f), 45f, 28f));
            if (FindFeature(spawn, s => s.MountainMask > 0.6f && s.Height > 140f, out var peak))
                shots.Add(new Shot("04_mountains", LookFrom(peak, 150f, 30f, out float y4, out float p4), y4, p4));
            if (FindFeature(spawn, s => s.Biome == Biome.Beach, out var coast))
                shots.Add(new Shot("05_coast", LookFrom(coast, 40f, 14f, out float y5, out float p5), y5, p5));
            AddBiomeShot(shots, spawn, "06_forest_interior", Biome.DenseForest, ground: true);
            AddBiomeShot(shots, spawn, "07_jungle", Biome.Jungle, ground: true);
            AddBiomeShot(shots, spawn, "08_taiga", Biome.SnowyTaiga, ground: false);
            AddBiomeShot(shots, spawn, "09_badlands", Biome.Badlands, ground: false);
            AddBiomeShot(shots, spawn, "10_desert", Biome.Desert, ground: false);
            AddBiomeShot(shots, spawn, "11_swamp", Biome.Swamp, ground: false);
            AddBiomeShot(shots, spawn, "12_river", Biome.River, ground: false);
            shots.Add(new Shot("13_cave", spawn + new float3(0, 1.62f, 0), 0, 0) { Cave = true });

            foreach (var shot in shots)
            {
                if (_shotFilter != null && Array.FindIndex(_shotFilter, f => shot.Name.StartsWith(f)) < 0) continue;
                player.Flying = true;
                player.Teleport(shot.Eye - new float3(0, 1.62f, 0), shot.Yaw, shot.Pitch);
                yield return WaitForStreaming(shot.Eye, 180f);
                if (shot.Ground && !SnapToGround(shot)) continue;
                if (shot.Cave && !EnterCave(shot.Eye)) continue;
                if (!shot.Ground && !shot.Cave) ClearCamera();
                yield return WaitForStreaming(player.EyePosition, 60f);
                for (int f = 0; f < 10; f++) yield return null;   // let SSAO/exposure settle
                Capture(shot.Name);
                yield return MeasureFrames(shot.Name, 60);
            }

            // surface fly-through from spawn: streaming + remeshing while moving at ~20 m/s
            player.Flying = true;
            player.Teleport(spawn + new float3(0, 6, 0), 60f, 5f);
            yield return WaitForStreaming(spawn, 120f);
            yield return MeasureFrames("moving (surface fly-through)", 240, true);


            _report.AppendLine($"done in {Time.realtimeSinceStartup - t0:0.0}s");
            File.WriteAllText(Path.Combine(_outDir, "report.txt"), _report.ToString());
            Debug.Log("[Capture]\n" + _report);
            Finished = true;
            if (!Application.isEditor) Application.Quit(0);
        }

        /// <summary>Diagnostic A/B switches for performance investigation (-vwToggles nossao,hardshadows,...).</summary>
        void ApplyDiagnosticToggles()
        {
            if (string.IsNullOrEmpty(_toggles)) return;
            _report.AppendLine($"diagnostic toggles: {_toggles}");
            var urp = UnityEngine.Rendering.GraphicsSettings.currentRenderPipeline as UnityEngine.Rendering.Universal.UniversalRenderPipelineAsset;
            foreach (var toggle in _toggles.Split(','))
            {
                switch (toggle)
                {
                    case "nossao":
                        if (rendererData != null)
                            foreach (var f in rendererData.rendererFeatures)
                                if (f != null && f.GetType().Name.Contains("AmbientOcclusion")) f.SetActive(false);
                        break;
                    case "hardshadows": if (sun != null) sun.shadows = LightShadows.Hard; break;
                    case "noshadows": if (sun != null) sun.shadows = LightShadows.None; break;
                    case "scale75": if (urp != null) urp.renderScale = 0.75f; break;
                    case "nopost":
                        captureCamera.GetComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>().renderPostProcessing = false;
                        break;
                    case "noprops": world.DrawProps = false; break;
                    case "noaa":
                        captureCamera.GetComponent<UnityEngine.Rendering.Universal.UniversalAdditionalCameraData>().antialiasing = UnityEngine.Rendering.Universal.AntialiasingMode.None;
                        break;
                }
            }
        }

        sealed class Shot
        {
            public string Name;
            public float3 Eye;
            public float Yaw, Pitch;
            public bool Ground, Cave;
            public Shot(string name, float3 eye, float yaw, float pitch) { Name = name; Eye = eye; Yaw = yaw; Pitch = pitch; }
        }

        void AddBiomeShot(List<Shot> shots, float3 around, string name, Biome biome, bool ground)
        {
            if (!FindFeature(around, s => s.Biome == biome, out var p, 150))
            {
                _report.AppendLine($"no {biome} found within search radius; skipped {name}");
                return;
            }
            if (ground)
                shots.Add(new Shot(name, p + new float3(0, 3, 0), 40f, 4f) { Ground = true });
            else
                shots.Add(new Shot(name, LookFrom(p, 75f, 30f, out float y, out float pt), y, pt));
        }

        /// <summary>Drops the camera to standing height on the terrain under it (below any canopy).</summary>
        bool SnapToGround(Shot shot)
        {
            int3 c = (int3)math.floor(shot.Eye) + new int3(0, 40, 0);
            for (; c.y > VoxelConstants.MinWorldY; c.y--)
            {
                if (!world.TryGetBlock(c, out var b)) return false;
                bool tree = b >= BlockId.OakLog && b <= BlockId.JungleLeaves;
                if (BlockRegistry.Get(b).Has(BlockFlags.Opaque) && !tree) break;
            }
            // nearest spot with two free cells for the body, then look down the longest open line
            int3 feet = c + new int3(0, 1, 0);
            for (int r = 0; r <= 8 && !Standable(feet); r++)
            for (int k = 0; k < 8 * math.max(1, r) && !Standable(feet); k++)
            {
                float a = k * 2f * math.PI / (8 * math.max(1, r));
                int3 q = c + new int3((int)math.round(math.cos(a) * r), 12, (int)math.round(math.sin(a) * r));
                for (int d = 0; d < 24 && !Standable(q); d++) q.y--;
                if (Standable(q)) feet = q;
            }
            if (!Standable(feet)) return false;
            float yaw = LongestOpenYaw(feet + new int3(0, 1, 0), 24, out int run);
            player.Teleport(new float3(feet.x + 0.5f, feet.y + 0.001f, feet.z + 0.5f), yaw, shot.Pitch);
            _report.AppendLine($"{shot.Name}: standing at {feet}, open sight line {run} blocks");
            return true;
        }

        bool Standable(int3 feet) =>
            !world.IsSolid(feet) && !world.IsSolid(feet + new int3(0, 1, 0)) && world.IsSolid(feet - new int3(0, 1, 0));

        float LongestOpenYaw(int3 eye, int maxRun, out int bestRun)
        {
            float bestYaw = 0;
            bestRun = -1;
            for (int k = 0; k < 16; k++)
            {
                float a = k * math.PI / 8f;
                int run = 0;
                for (int r = 1; r <= maxRun; r++)
                {
                    var q = eye + new int3((int)math.round(math.sin(a) * r), 0, (int)math.round(math.cos(a) * r));
                    if (world.IsSolid(q)) break;
                    run++;
                }
                if (run > bestRun) { bestRun = run; bestYaw = math.degrees(a); }
            }
            return bestYaw;
        }

        /// <summary>Lifts an aerial camera out of any block (terrain, canopy) around it.</summary>
        void ClearCamera()
        {
            float3 feet = player.Body.Position;
            for (int i = 0; i < 60; i++)
            {
                int3 e = (int3)math.floor(feet + new float3(0, 1.62f, 0));
                bool blocked = false;
                for (int dy = -1; dy <= 1 && !blocked; dy++)
                for (int dz = -1; dz <= 1 && !blocked; dz++)
                for (int dx = -1; dx <= 1 && !blocked; dx++)
                    blocked = world.GetBlockOrAir(e + new int3(dx, dy, dz)) != BlockId.Air
                              && !BlockId.IsWater(world.GetBlockOrAir(e + new int3(dx, dy, dz)));
                if (!blocked) break;
                feet.y += 1f;
            }
            player.Teleport(feet, player.Yaw, player.Pitch);
        }

        /// <summary>Finds an open underground space near the camera, places torches through the real
        /// edit path and aims into the widest passage.</summary>
        bool EnterCave(float3 around)
        {
            int3 best = default;
            int bestScore = 0;
            int3 c0 = (int3)math.floor(around);
            for (int dz = -60; dz <= 60; dz += 3)
            for (int dx = -60; dx <= 60; dx += 3)
            {
                int? h = world.GetHeightmap(c0.x + dx, c0.z + dz);
                if (h == null) continue;
                for (int y = h.Value - 14; y > VoxelConstants.MinWorldY + 8; y -= 2)
                {
                    var p = new int3(c0.x + dx, y, c0.z + dz);
                    if (world.GetBlockOrAir(p) != BlockId.Air || world.GetBlockOrAir(p + new int3(0, 1, 0)) != BlockId.Air) continue;
                    if (!world.IsSolid(p - new int3(0, 1, 0)) && !world.IsSolid(p - new int3(0, 2, 0))) continue;
                    int score = 0;
                    for (int k = 0; k < 16; k++)
                    {
                        float a = k * math.PI / 8f;
                        for (int r = 2; r <= 10; r += 2)
                        {
                            var q = p + new int3((int)math.round(math.cos(a) * r), 1, (int)math.round(math.sin(a) * r));
                            if (world.GetBlockOrAir(q) == BlockId.Air) score++; else break;
                        }
                    }
                    if (score > bestScore) { bestScore = score; best = p; }
                }
            }
            if (bestScore < 20)
            {
                _report.AppendLine($"no cave found near {around}; skipped");
                return false;
            }

            float bestYaw = 0; int bestRun = -1;
            for (int k = 0; k < 16; k++)
            {
                float a = k * math.PI / 8f;
                int run = 0;
                for (int r = 1; r <= 20; r++)
                {
                    var q = best + new int3((int)math.round(math.sin(a) * r), 1, (int)math.round(math.cos(a) * r));
                    if (world.GetBlockOrAir(q) != BlockId.Air) break;
                    run++;
                }
                if (run > bestRun) { bestRun = run; bestYaw = math.degrees(a); }
            }
            while (!world.IsSolid(best - new int3(0, 1, 0))) best.y--;
            player.Teleport(new float3(best.x + 0.5f, best.y + 0.001f, best.z + 0.5f), bestYaw, 12f);

            // up to five torches on open floor ahead, at least 5 blocks apart
            var placedAt = new List<int3>();
            float ya = math.radians(bestYaw);
            float3 fwd = new float3(math.sin(ya), 0, math.cos(ya));
            float3 right = new float3(fwd.z, 0, -fwd.x);
            for (int dist = 3; dist <= 16 && placedAt.Count < 5; dist += 2)
            for (int side = -6; side <= 6 && placedAt.Count < 5; side += 3)
            {
                int3 q = (int3)math.floor((float3)best + 0.5f + fwd * dist + right * side) + new int3(0, 3, 0);
                for (int k = 0; k < 10 && !world.IsSolid(q - new int3(0, 1, 0)); k++) q.y--;
                bool spaced = true;
                foreach (var t in placedAt) spaced &= math.distancesq(t, q) >= 25;
                if (spaced && interactor.TryPlace(q, BlockId.Torch)) placedAt.Add(q);
            }
            int torches = placedAt.Count;
            _report.AppendLine($"cave at {best} (openness {bestScore}, passage {bestRun}), placed {torches} torches, heightmap above {world.GetHeightmap(best.x, best.z)}");
            return true;
        }

        IEnumerator WaitForStreaming(float3 around, float timeout)
        {
            float start = Time.realtimeSinceStartup;
            int stableFrames = 0;
            while (stableFrames < 10)
            {
                bool busy = world.GeneratingColumns > 0 || world.MeshJobsInFlight > 0 || !world.IsAreaReady(around, 2);
                stableFrames = busy ? 0 : stableFrames + 1;
                if (Time.realtimeSinceStartup - start > timeout)
                {
                    _report.AppendLine($"WARN streaming did not settle within {timeout}s near {around}");
                    yield break;
                }
                yield return null;
            }
        }

        IEnumerator MeasureFrames(string label, int frames, bool fly = false)
        {
            var samples = new List<float>(frames);
            var cpu = new List<float>(frames);
            var gpu = new List<float>(frames);
            var timings = new FrameTiming[1];
            float3 start = player.Body.Position;
            for (int w = 0; w < 5; w++) yield return null;   // skip the capture/readback frame
            for (int i = 0; i < frames; i++)
            {
                if (fly)
                {
                    player.Flying = true;
                    player.Teleport(start + new float3(i * 0.35f, 0, i * 0.2f), 60f, 5f);
                }
                yield return null;
                samples.Add(Time.unscaledDeltaTime * 1000f);
                FrameTimingManager.CaptureFrameTimings();
                if (FrameTimingManager.GetLatestTimings(1, timings) > 0)
                {
                    cpu.Add((float)timings[0].cpuMainThreadFrameTime);
                    gpu.Add((float)timings[0].gpuFrameTime);
                }
            }
            samples.Sort();
            cpu.Sort();
            gpu.Sort();
            string split = gpu.Count > 0 && gpu[gpu.Count / 2] > 0
                ? $", cpu main p50 {cpu[cpu.Count / 2]:0.00}, gpu p50 {gpu[gpu.Count / 2]:0.00}"
                : "";
            float avg = 0;
            foreach (var s in samples) avg += s;
            avg /= samples.Count;
            _report.AppendLine($"frame time [{label}]: avg {avg:0.00} ms, p50 {samples[samples.Count / 2]:0.00}, p95 {samples[(int)(samples.Count * 0.95f)]:0.00}, max {samples[^1]:0.00}{split}, tris {world.RenderedTriangles / 1000}k, props {world.PropsDrawn}");
        }

        /// <summary>A small wall of every placeable block next to spawn, placed through the real edit path.</summary>
        void BuildShowcase(float3 spawn)
        {
            int3 b = (int3)math.floor(spawn) + new int3(2, 0, 3);
            int placed = 0, i = 0;
            foreach (var id in BlockInteractor.Hotbar)
            {
                // stand each pillar on the actual ground surface of its column
                int3 c = b + new int3(i, 12, 0);
                while (c.y > b.y - 16 && !world.IsSolid(c)) c.y--;
                for (int y = 1; y <= 2 + (i % 2); y++)
                    if (interactor.TryPlace(c + new int3(0, y, 0), id)) placed++;
                i++;
            }
            _report.AppendLine($"showcase: placed {placed} blocks via BlockInteractor.TryPlace, edited sections {world.ModifiedSections}");
        }

        bool FindFeature(float3 around, Func<TerrainNoise.Sample, bool> predicate, out float3 point, int rings = 40)
        {
            for (int ring = 1; ring < rings; ring++)
            for (int k = 0; k < 16; k++)
            {
                float a = k * math.PI / 8f + ring * 0.21f;
                float2 xz = around.xz + new float2(math.cos(a), math.sin(a)) * ring * (rings > 40 ? 24f : 16f);
                var s = TerrainNoise.SampleSurface(math.floor(xz), world.Seed);
                if (!predicate(s)) continue;
                point = new float3(xz.x, s.Height, xz.y);
                return true;
            }
            point = default;
            return false;
        }

        static float3 LookFrom(float3 target, float distance, float elevationDeg, out float yaw, out float pitch)
        {
            float3 dir = math.normalize(new float3(1f, 0, 0.6f));
            float3 eye = target - dir * distance + new float3(0, distance * math.tan(math.radians(elevationDeg)), 0);
            float3 d = target - eye;
            yaw = math.degrees(math.atan2(d.x, d.z));
            pitch = -math.degrees(math.atan2(d.y, math.length(d.xz)));
            eye.y = math.max(eye.y, VoxelConstants.SeaLevel + 3);
            return eye;
        }

        void Capture(string name)
        {
            var desc = new RenderTextureDescriptor(width, height, RenderTextureFormat.ARGB32, 24) { sRGB = true, msaaSamples = 1 };
            var rt = RenderTexture.GetTemporary(desc);
            var request = new RenderPipeline.StandardRequest { destination = rt };
            if (RenderPipeline.SupportsRenderRequest(captureCamera, request))
                RenderPipeline.SubmitRenderRequest(captureCamera, request);
            else
            {
                captureCamera.targetTexture = rt;
                captureCamera.Render();
                captureCamera.targetTexture = null;
            }

            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var tex = new Texture2D(width, height, TextureFormat.RGB24, false);
            tex.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            tex.Apply();
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);

            string path = Path.Combine(_outDir, name + ".png");
            File.WriteAllBytes(path, tex.EncodeToPNG());
            Destroy(tex);
            _report.AppendLine($"captured {name}: eye {player.EyePosition}, sections {world.RenderedSections}, tris {world.RenderedTriangles / 1000}k, props {world.PropsDrawn}");
        }

        void Fail(string reason)
        {
            _report.AppendLine("FAILED: " + reason);
            if (_outDir != null) File.WriteAllText(Path.Combine(_outDir, "report.txt"), _report.ToString());
            Debug.LogError("[Capture] " + reason);
            Failed = true;
            Finished = true;
            if (!Application.isEditor) Application.Quit(1);
        }
    }
}
