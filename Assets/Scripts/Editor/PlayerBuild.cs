using System.Runtime.InteropServices;
using UnityEditor;
using UnityEditor.Build;
using UnityEditor.Build.Reporting;
using UnityEngine;

namespace Voxelwild.EditorTools
{
    /// <summary>Standalone Windows build (native ARM64 on Arm machines, x64 elsewhere) into Builds/Windows.</summary>
    public static class PlayerBuild
    {
        public const string OutputPath = "Builds/Windows/Voxelwild.exe";

        [MenuItem("Voxelwild/Build/Windows Player")]
        public static void BuildWindows()
        {
            bool arm = RuntimeInformation.OSArchitecture == Architecture.Arm64;
            UnityEditor.WindowsStandalone.UserBuildSettings.architecture = arm ? OSArchitecture.ARM64 : OSArchitecture.x64;
            PlayerSettings.SetScriptingBackend(NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);

            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { WorldSceneBuilder.ScenePath },
                locationPathName = OutputPath,
                target = BuildTarget.StandaloneWindows64,
                options = BuildOptions.None,
            });

            var s = report.summary;
            Debug.Log($"[PlayerBuild] {s.result}: {s.totalSize / (1024 * 1024)} MB, {s.totalErrors} errors, {s.totalWarnings} warnings, {s.totalTime.TotalSeconds:0}s ({(arm ? "ARM64" : "x64")})");
            if (s.result != BuildResult.Succeeded && Application.isBatchMode) EditorApplication.Exit(1);
        }
    }
}
