using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using Voxelwild.Diagnostics;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// Batch-mode entry point that plays the World scene with the ScreenshotDirector active:
    /// <code>Unity -batchmode -projectPath . -executeMethod Voxelwild.EditorTools.CaptureRunner.Run -vwCapture Screenshots</code>
    /// (no -quit: the runner exits the editor itself once the capture finishes).
    /// </summary>
    [InitializeOnLoad]
    public static class CaptureRunner
    {
        const string ActiveKey = "Voxelwild.CaptureRunner.Active";
        const string StartKey = "Voxelwild.CaptureRunner.Start";
        const double TimeoutSeconds = 900;

        static CaptureRunner()
        {
            if (SessionState.GetBool(ActiveKey, false)) EditorApplication.update += Poll;
        }

        public static void Run()
        {
            EditorSceneManager.OpenScene(WorldSceneBuilder.ScenePath);
            SessionState.SetBool(ActiveKey, true);
            SessionState.SetFloat(StartKey, (float)EditorApplication.timeSinceStartup);
            EditorApplication.update += Poll;
            EditorApplication.EnterPlaymode();
        }

        static void Poll()
        {
            double elapsed = EditorApplication.timeSinceStartup - SessionState.GetFloat(StartKey, 0);
            if (elapsed > TimeoutSeconds)
            {
                Debug.LogError("[CaptureRunner] timed out");
                Finish(2);
                return;
            }
            if (!EditorApplication.isPlaying || !ScreenshotDirector.Finished) return;
            Finish(ScreenshotDirector.Failed ? 1 : 0);
        }

        static void Finish(int code)
        {
            EditorApplication.update -= Poll;
            SessionState.SetBool(ActiveKey, false);
            EditorApplication.Exit(code);
        }
    }
}
