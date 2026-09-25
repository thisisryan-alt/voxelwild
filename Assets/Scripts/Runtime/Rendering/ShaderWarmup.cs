using System.Collections.Generic;
using UnityEngine;
using Voxelwild.Gameplay;
using Voxelwild.Player;
using Voxelwild.World;
using Voxelwild.World.Props;

namespace Voxelwild.Rendering
{
    /// <summary>
    /// Pipeline warm-up. The first time a material is drawn with a new combination of pass, keywords and render
    /// targets the driver compiles a pipeline state, which showed up as 150–250 ms hitches the first time water,
    /// a new prop or a dropped item came into view. While the world generates (the loading screen covers the
    /// view) this draws every world material once in front of the player camera, through the real camera, lights,
    /// shadows and post stack: the same states the game will ask for later. Props are drawn instanced, as
    /// PropField draws them. The component removes itself once the player has spawned.
    /// </summary>
    public sealed class ShaderWarmup : MonoBehaviour
    {
        [SerializeField] PlayerController player;
        [SerializeField] Camera playerCamera;
        [SerializeField] Material terrainMaterial;
        [SerializeField] Material foliageMaterial;
        [SerializeField] Material waterMaterial;
        [SerializeField] Material tokenMaterial;
        [SerializeField] Material particleMaterial;
        [SerializeField] PropLibrary props;

        readonly List<(Mesh mesh, int sub, Material material, bool instanced)> _draws = new List<(Mesh, int, Material, bool)>();
        readonly List<Mesh> _owned = new List<Mesh>();
        readonly Matrix4x4[] _one = new Matrix4x4[1];

        void Start()
        {
            Add(Owned(ItemIcons.BlockCube(BlockId.Grass, 15)), terrainMaterial);
            Add(Owned(ItemIcons.BlockCube(BlockId.OakLeaves, 15)), foliageMaterial);
            Add(Owned(ItemIcons.BlockCube(BlockId.Water, 15)), waterMaterial);
            var tmp = GameObject.CreatePrimitive(PrimitiveType.Cube);
            var cube = tmp.GetComponent<MeshFilter>().sharedMesh;
            Destroy(tmp);
            Add(cube, tokenMaterial);
            Add(cube, particleMaterial);
            if (props != null)
                foreach (var entry in props.entries)
                    foreach (var lod in entry.lods)
                        for (int s = 0; s < lod.materials.Length && lod.mesh != null; s++)
                            if (lod.materials[s] != null)
                                _draws.Add((lod.mesh, Mathf.Min(s, lod.mesh.subMeshCount - 1), lod.materials[s], lod.materials[s].enableInstancing));
        }

        Mesh Owned(Mesh m)
        {
            _owned.Add(m);
            return m;
        }

        void Add(Mesh mesh, Material material)
        {
            if (mesh != null && material != null) _draws.Add((mesh, 0, material, false));
        }

        void Update()
        {
            if (player.Spawned)
            {
                Destroy(this);
                return;
            }
            // a small grid 6 m ahead of the camera, hidden by the loading screen
            var cam = playerCamera.transform;
            int columns = Mathf.CeilToInt(Mathf.Sqrt(_draws.Count));
            for (int i = 0; i < _draws.Count; i++)
            {
                var (mesh, sub, material, instanced) = _draws[i];
                float size = 0.35f / Mathf.Max(0.1f, mesh.bounds.extents.magnitude);
                var local = new Vector3((i % columns - columns * 0.5f) * 0.4f, (i / columns - columns * 0.5f) * 0.4f, 6f);
                var m = Matrix4x4.TRS(cam.TransformPoint(local), cam.rotation, Vector3.one * size);
                if (instanced)
                {
                    _one[0] = m;
                    Graphics.DrawMeshInstanced(mesh, sub, material, _one, 1);
                }
                else Graphics.DrawMesh(mesh, m, material, 0, playerCamera, sub);
            }
        }

        void OnDestroy()
        {
            foreach (var m in _owned) if (m != null) Destroy(m);
        }
    }
}
