using System;
using UnityEngine;
using UnityEngine.UIElements;
using Voxelwild.Gameplay;
using Voxelwild.Rendering;

namespace Voxelwild.UI
{
    /// <summary>
    /// The settings window, shared by the main menu and the pause menu. Changes apply at once and are saved
    /// (SettingsStore for controls and audio, QualityManager's preference for the graphics preset).
    /// </summary>
    public static class SettingsView
    {
        /// <param name="quality">The running QualityManager, or null in the main menu (the preset applies in-game).</param>
        public static VisualElement Build(QualityManager quality, Action back)
        {
            var s = SettingsStore.Current.Clone();
            void Save() => SettingsStore.Set(s);

            var w = Ui.Window(560);
            w.Add(Ui.Title("Settings"));

            int preset = quality != null ? quality.Index : QualityPresets.Clamp(PlayerPrefs.GetInt(QualityManager.PrefKey, QualityPresets.Default));
            w.Add(Ui.Chooser("Graphics quality", () => QualityPresets.All[preset].Name, step =>
            {
                preset = (preset + step + QualityPresets.All.Length) % QualityPresets.All.Length;
                if (quality != null) quality.Select(preset);
                else PlayerPrefs.SetInt(QualityManager.PrefKey, preset);
            }));

            w.Add(Ui.Slider("Field of view", GameSettings.MinFov, GameSettings.MaxFov, s.fieldOfView, v => { s.fieldOfView = Mathf.Round(v); Save(); }));
            w.Add(Ui.Slider("Mouse sensitivity", GameSettings.MinSensitivity, GameSettings.MaxSensitivity, s.mouseSensitivity, v => { s.mouseSensitivity = v; Save(); }));
            w.Add(Ui.Toggle("Invert mouse Y", s.invertY, v => { s.invertY = v; Save(); }));
            w.Add(Ui.Slider("Master volume", 0f, 1f, s.masterVolume, v => { s.masterVolume = v; Save(); }));
            w.Add(Ui.Slider("Effects volume", 0f, 1f, s.effectsVolume, v => { s.effectsVolume = v; Save(); }));
            w.Add(Ui.Slider("Ambience volume", 0f, 1f, s.ambienceVolume, v => { s.ambienceVolume = v; Save(); }));
            w.Add(Ui.Toggle("Show frame rate", s.showFps, v => { s.showFps = v; Save(); }));

            var gap = new VisualElement();
            gap.style.height = 10;
            w.Add(gap);
            w.Add(Ui.Button("Back", back, primary: true));
            return w;
        }
    }
}
