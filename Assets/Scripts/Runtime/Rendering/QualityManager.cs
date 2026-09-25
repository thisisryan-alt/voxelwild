using System;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;
using Voxelwild.World;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Applies a <see cref="QualityPreset"/> to URP, the world, the sun, the sky and the camera, and remembers
    /// the choice (PlayerPrefs). F4 cycles presets until the settings menu arrives. URP asset values changed at
    /// runtime are restored on exit, so play mode never edits the project's settings.
    /// </summary>
    [DefaultExecutionOrder(-90)]
    public sealed class QualityManager : MonoBehaviour
    {
        public const string PrefKey = "voxelwild.quality";

        [SerializeField] VoxelWorld world;
        [SerializeField] Light sun;
        [SerializeField] DayNightCycle dayNight;
        [SerializeField] Camera playerCamera;
        [SerializeField] UniversalRendererData rendererData;

        static readonly int StochasticId = Shader.PropertyToID("_VoxelStochastic");

        int _index = -1;
        bool _saved;
        float _savedScale, _savedShadowDistance;
        int _savedCascades;
        bool _savedSsao;

        public int Index => _index;
        public QualityPreset Current => QualityPresets.All[Math.Max(_index, 0)];
        public event Action<QualityPreset> Changed;

        void Start()
        {
            int stored = PlayerPrefs.GetInt(PrefKey, QualityPresets.Default);
            // capture runs measure the reference preset unless told otherwise
            if (Array.IndexOf(System.Environment.GetCommandLineArgs(), "-vwCapture") >= 0) stored = QualityPresets.Default;
            string arg = CommandLineArg("-vwQuality");
            if (arg != null && QualityPresets.Find(arg) >= 0) stored = QualityPresets.Find(arg);
            Apply(stored);
        }

        void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && kb.f4Key.wasPressedThisFrame)
            {
                Select((_index + 1) % QualityPresets.All.Length);
            }
        }

        /// <summary>Applies a preset and remembers it for the next session (settings screen, F4).</summary>
        public void Select(int index)
        {
            Apply(index);
            PlayerPrefs.SetInt(PrefKey, _index);
        }

        public void Apply(int index)
        {
            _index = QualityPresets.Clamp(index);
            var p = QualityPresets.All[_index];

            var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (urp != null)
            {
                SaveOriginals(urp);
                urp.renderScale = p.RenderScale;
                urp.shadowDistance = p.ShadowDistance;
                urp.shadowCascadeCount = p.ShadowCascades;
            }
            SetSsao(p.Ssao);
            if (sun != null) sun.shadows = p.SoftShadows ? LightShadows.Soft : LightShadows.Hard;
            if (world != null)
            {
                world.ViewDistance = p.ViewDistance;
                world.FancyLeavesDistance = p.FancyLeavesDistance;
                world.PropDistanceScale = p.PropDistanceScale;
            }
            var (fogStart, fogEnd) = QualityPresets.FogRange(p.ViewDistance);
            RenderSettings.fogStartDistance = fogStart;
            RenderSettings.fogEndDistance = fogEnd;
            if (playerCamera != null)
            {
                playerCamera.farClipPlane = Mathf.Max(1500f, fogEnd * 1.5f);
                var data = playerCamera.GetComponent<UniversalAdditionalCameraData>();
                if (data != null) data.antialiasing = p.Smaa ? AntialiasingMode.SubpixelMorphologicalAntiAliasing : AntialiasingMode.None;
            }
            Shader.SetGlobalFloat(StochasticId, p.StochasticTiling ? 1f : 0f);
            if (dayNight != null) dayNight.CloudShadows = p.CloudShadows;
            Changed?.Invoke(p);
        }

        void SetSsao(bool on)
        {
            if (rendererData == null) return;
            foreach (var f in rendererData.rendererFeatures)
                if (f != null && f.GetType().Name.Contains("AmbientOcclusion"))
                {
                    if (!_saved) _savedSsao = f.isActive;
                    f.SetActive(on);
                }
        }

        void SaveOriginals(UniversalRenderPipelineAsset urp)
        {
            if (_saved) return;
            _saved = true;
            _savedScale = urp.renderScale;
            _savedShadowDistance = urp.shadowDistance;
            _savedCascades = urp.shadowCascadeCount;
        }

        void OnDestroy()
        {
            if (!_saved) return;
            var urp = GraphicsSettings.currentRenderPipeline as UniversalRenderPipelineAsset;
            if (urp != null)
            {
                urp.renderScale = _savedScale;
                urp.shadowDistance = _savedShadowDistance;
                urp.shadowCascadeCount = _savedCascades;
            }
            if (rendererData != null)
                foreach (var f in rendererData.rendererFeatures)
                    if (f != null && f.GetType().Name.Contains("AmbientOcclusion")) f.SetActive(_savedSsao);
        }

        static string CommandLineArg(string name)
        {
            var args = System.Environment.GetCommandLineArgs();
            int i = Array.IndexOf(args, name);
            return i >= 0 && i + 1 < args.Length ? args[i + 1] : null;
        }
    }
}
