using UnityEngine;
using Voxelwild.Player;

namespace Voxelwild.Gameplay
{
    /// <summary>Applies the settings that belong to the World scene: look sensitivity, inverted look, field of view.</summary>
    public sealed class SettingsApplier : MonoBehaviour
    {
        [SerializeField] PlayerController player;
        [SerializeField] Camera playerCamera;

        void OnEnable()
        {
            SettingsStore.Changed += Apply;
            Apply(SettingsStore.Current);
        }

        void OnDisable() => SettingsStore.Changed -= Apply;

        void Apply(GameSettings s)
        {
            AudioListener.volume = s.masterVolume;
            if (player != null)
            {
                player.SensitivityScale = s.mouseSensitivity;
                player.InvertY = s.invertY;
            }
            if (playerCamera != null) playerCamera.fieldOfView = s.fieldOfView;
        }
    }
}
