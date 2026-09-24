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
        [SerializeField] int width = 1600;
        [SerializeField] int height = 900;

        public static bool Finished { get; private set; }
        public static bool Failed { get; private set; }

        string _outDir;
        readonly StringBuilder _report = new StringBuilder();

        void Awake()
        {
            var args = Environment.GetCommandLineArgs();
            int i = Array.IndexOf(args, "-vwCapture");
            if (i < 0 || i + 1 >= args.Length) { enabled = false; return; }
            _outDir = Path.GetFullPath(args[i + 1]);
            Directory.CreateDirectory(_outDir);
            Finished = false;
            Failed = false;
        }

        void Start()
        {
            if (!enabled) return;
            if (hud != null) hud.Hidden = true;
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

            var shots = new List<(string name, float3 eye, float yaw, float pitch)>();
            float3 eye = spawn + new float3(0, 1.62f, 0);
            shots.Add(("01_player_eye", eye, 35f, 8f));
            shots.Add(("02_showcase_closeup", spawn + new float3(-2.2f, 2.4f, -1.5f), 55f, 22f));
            shots.Add(("03_overview", spawn + new float3(-40f, 55f, -40f), 45f, 28f));
            if (FindFeature(spawn, s => s.MountainMask > 0.6f && s.Height > 140f, out var peak))
                shots.Add(("04_mountains", LookFrom(peak, 150f, 30f, out float y4, out float p4), y4, p4));
            if (FindFeature(spawn, s => s.Height > VoxelConstants.SeaLevel - 3 && s.Height < VoxelConstants.SeaLevel + 1, out var coast))
                shots.Add(("05_coast", LookFrom(coast, 40f, 14f, out float y5, out float p5), y5, p5));

            foreach (var shot in shots)
            {
                player.Flying = true;
                player.Teleport(shot.eye - new float3(0, 1.62f, 0), shot.yaw, shot.pitch);
                yield return WaitForStreaming(shot.eye, 180f);
                for (int f = 0; f < 10; f++) yield return null;   // let SSAO/exposure settle
                Capture(shot.name);
            }

            yield return MeasureFrames("moving (fly-through)", 180, true);

            _report.AppendLine($"done in {Time.realtimeSinceStartup - t0:0.0}s");
            File.WriteAllText(Path.Combine(_outDir, "report.txt"), _report.ToString());
            Debug.Log("[Capture]\n" + _report);
            Finished = true;
            if (!Application.isEditor) Application.Quit(0);
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
            float3 start = player.Body.Position;
            for (int i = 0; i < frames; i++)
            {
                if (fly)
                {
                    player.Flying = true;
                    player.Teleport(start + new float3(i * 0.35f, 0, i * 0.2f), 60f, 5f);
                }
                yield return null;
                samples.Add(Time.unscaledDeltaTime * 1000f);
            }
            samples.Sort();
            float avg = 0;
            foreach (var s in samples) avg += s;
            avg /= samples.Count;
            _report.AppendLine($"frame time [{label}]: avg {avg:0.00} ms, p50 {samples[samples.Count / 2]:0.00}, p95 {samples[(int)(samples.Count * 0.95f)]:0.00}, max {samples[^1]:0.00}");
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

        bool FindFeature(float3 around, Func<TerrainNoise.Sample, bool> predicate, out float3 point)
        {
            for (int ring = 1; ring < 40; ring++)
            for (int k = 0; k < 16; k++)
            {
                float a = k * math.PI / 8f + ring * 0.21f;
                float2 xz = around.xz + new float2(math.cos(a), math.sin(a)) * ring * 16f;
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
            _report.AppendLine($"captured {name}: eye {player.EyePosition}, sections {world.RenderedSections}, tris {world.RenderedTriangles / 1000}k");
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
