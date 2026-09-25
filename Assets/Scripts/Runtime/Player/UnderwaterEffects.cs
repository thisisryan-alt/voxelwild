using UnityEngine;
using Voxelwild.Rendering;

namespace Voxelwild.Player
{
    /// <summary>
    /// With the camera under water, fog closes in and takes the water's deep colour, dimmed with the ambient
    /// light so night dives are dark; height fog is switched off so it doesn't double up. Runs after the day/night
    /// cycle (which sets the fog every frame) and restores the fog range on surfacing.
    /// </summary>
    [DefaultExecutionOrder(100)]
    public sealed class UnderwaterEffects : MonoBehaviour
    {
        [SerializeField] PlayerController player;
        [SerializeField] Material waterMaterial;
        [SerializeField] float visibility = 16f;

        static readonly int FogParamsId = Shader.PropertyToID("_VoxelFogParams");
        static readonly int DeepColorId = Shader.PropertyToID("_DeepColor");
        static readonly int ShallowColorId = Shader.PropertyToID("_ShallowColor");

        bool _under;
        float _savedStart, _savedEnd;

        public bool Underwater => _under;

        void LateUpdate()
        {
            bool under = player != null && player.Spawned && player.HeadInWater;
            if (under && !_under)
            {
                _savedStart = RenderSettings.fogStartDistance;
                _savedEnd = RenderSettings.fogEndDistance;
            }
            else if (!under && _under)
            {
                RenderSettings.fogStartDistance = _savedStart;
                RenderSettings.fogEndDistance = _savedEnd;
            }
            _under = under;
            if (!under) return;

            Color deep = waterMaterial != null ? waterMaterial.GetColor(DeepColorId) : new Color(0.02f, 0.11f, 0.16f);
            Color shallow = waterMaterial != null ? waterMaterial.GetColor(ShallowColorId) : new Color(0.16f, 0.46f, 0.47f);
            float light = Mathf.Clamp01(RenderSettings.ambientSkyColor.grayscale * 0.8f);
            RenderSettings.fogColor = Color.Lerp(deep, shallow, 0.35f) * Mathf.Lerp(0.15f, 1.2f, light);
            RenderSettings.fogStartDistance = 0f;
            RenderSettings.fogEndDistance = visibility;
            Vector4 p = Shader.GetGlobalVector(FogParamsId);
            p.z = 0f;
            Shader.SetGlobalVector(FogParamsId, p);
        }
    }
}
