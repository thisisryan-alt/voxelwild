using Unity.Mathematics;
using UnityEngine;

namespace Voxelwild.Player
{
    /// <summary>Thin line cube drawn around the targeted block.</summary>
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class SelectionOutline : MonoBehaviour
    {
        [SerializeField] float inflate = 0.004f;

        MeshRenderer _renderer;

        void Awake()
        {
            float lo = -inflate, hi = 1f + inflate;
            var v = new Vector3[8];
            for (int i = 0; i < 8; i++)
                v[i] = new Vector3((i & 1) != 0 ? hi : lo, (i & 2) != 0 ? hi : lo, (i & 4) != 0 ? hi : lo);
            int[] lines =
            {
                0, 1, 2, 3, 4, 5, 6, 7,     // x edges
                0, 2, 1, 3, 4, 6, 5, 7,     // y edges
                0, 4, 1, 5, 2, 6, 3, 7,     // z edges
            };
            var mesh = new Mesh { name = "SelectionOutline", vertices = v };
            mesh.SetIndices(lines, MeshTopology.Lines, 0);
            GetComponent<MeshFilter>().sharedMesh = mesh;
            _renderer = GetComponent<MeshRenderer>();
            _renderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            _renderer.receiveShadows = false;
            _renderer.enabled = false;
        }

        public void Show(bool visible, int3 block)
        {
            if (visible) transform.position = (float3)block;
            _renderer.enabled = visible;
        }
    }
}
