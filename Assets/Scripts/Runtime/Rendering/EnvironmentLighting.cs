using UnityEngine;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Keeps the ambient probe and skybox reflection in sync with the current RenderSettings.
    /// The world has no baked lighting, so this is what makes ambient light correct in builds.
    /// Phase 4 (day/night, atmosphere) extends this into the time-of-day driver.
    /// </summary>
    [RequireComponent(typeof(Light))]
    public sealed class EnvironmentLighting : MonoBehaviour
    {
        void Start()
        {
            RenderSettings.sun = GetComponent<Light>();
            DynamicGI.UpdateEnvironment();
        }
    }
}
