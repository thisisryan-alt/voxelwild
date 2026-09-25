using System;

namespace Voxelwild.Gameplay
{
    /// <summary>
    /// Player options from the settings screen (the quality preset is kept by QualityManager). Plain fields so
    /// JsonUtility can store them; <see cref="Validate"/> clamps anything a hand-edited file might hold.
    /// </summary>
    [Serializable]
    public sealed class GameSettings
    {
        public const float MinSensitivity = 0.2f, MaxSensitivity = 3f;
        public const float MinFov = 55f, MaxFov = 100f;

        public int version = 1;
        /// <summary>Multiplier on the controller's base mouse sensitivity.</summary>
        public float mouseSensitivity = 1f;
        public bool invertY;
        public float fieldOfView = 72f;
        public float masterVolume = 0.8f;
        public float effectsVolume = 1f;
        public float ambienceVolume = 0.7f;
        public bool showFps;

        public GameSettings Validate()
        {
            mouseSensitivity = Clamp(mouseSensitivity, MinSensitivity, MaxSensitivity, 1f);
            fieldOfView = Clamp(fieldOfView, MinFov, MaxFov, 72f);
            masterVolume = Clamp(masterVolume, 0f, 1f, 0.8f);
            effectsVolume = Clamp(effectsVolume, 0f, 1f, 1f);
            ambienceVolume = Clamp(ambienceVolume, 0f, 1f, 0.7f);
            return this;
        }

        public GameSettings Clone() => (GameSettings)MemberwiseClone();

        static float Clamp(float v, float min, float max, float fallback) =>
            float.IsNaN(v) || float.IsInfinity(v) ? fallback : Math.Min(Math.Max(v, min), max);
    }
}
