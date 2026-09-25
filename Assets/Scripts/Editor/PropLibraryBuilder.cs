using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using Voxelwild.World;
using Voxelwild.World.Props;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// Builds Assets/Art/Models/PropLibrary.asset and one Voxelwild/Prop material per prop slot from
    /// props_manifest.json (written by tools/blender/build_props.py next to the FBX files). Safe to re-run:
    /// materials are updated in place, the library is rewritten.
    /// </summary>
    public static class PropLibraryBuilder
    {
        public const string ManifestPath = PropModelPostprocessor.ModelsFolder + "/props_manifest.json";
        public const string LibraryPath = PropModelPostprocessor.ModelsFolder + "/PropLibrary.asset";

        [Serializable] public class Manifest { public int version; public ManifestAsset[] assets; }
        [Serializable] public class Textures { public string normal; public string mask; }
        [Serializable] public class Lod { public string mesh; public int triangles; }
        [Serializable] public class Extents { public float radius; public float top; public float bottom; }

        [Serializable]
        public class Slot
        {
            public string name;
            public string layer;
            public string mapping;
            public float tiling;
            public float moss;
            public float[] tint;
            public float roughness;
            public bool foliage;
        }

        [Serializable]
        public class ManifestAsset
        {
            public string name;
            public string kind;
            public int variant;
            public string category;
            public string fbx;
            public Textures textures;
            public Lod[] lods;
            public Extents extents;
            public bool hang;
            public bool core;
            public Slot[] slots;
        }

        public static Manifest LoadManifest() =>
            File.Exists(ManifestPath) ? JsonUtility.FromJson<Manifest>(File.ReadAllText(ManifestPath)) : null;

        [MenuItem("Voxelwild/Art/Build Prop Library")]
        public static PropLibrary Build()
        {
            var manifest = LoadManifest();
            if (manifest == null)
            {
                Debug.LogWarning($"[PropLibraryBuilder] {ManifestPath} not found: run ./tools/blender.ps1 build first");
                return null;
            }
            AssetDatabase.Refresh();
            var arrays = (albedo: AssetDatabase.LoadAssetAtPath<Texture2DArray>(BlockTextureArrays.AlbedoPath),
                          normal: AssetDatabase.LoadAssetAtPath<Texture2DArray>(BlockTextureArrays.NormalPath),
                          mask: AssetDatabase.LoadAssetAtPath<Texture2DArray>(BlockTextureArrays.MaskPath));
            if (arrays.albedo == null)
                Debug.LogError("[PropLibraryBuilder] block texture arrays missing: run Voxelwild/Art/Build Block Texture Arrays first");

            var entries = new List<PropLibrary.Entry>();
            int errors = 0;
            foreach (var a in manifest.assets)
            {
                var root = AssetDatabase.LoadAssetAtPath<GameObject>(a.fbx);
                if (root == null)
                {
                    Debug.LogError($"[PropLibraryBuilder] {a.name}: model {a.fbx} not imported");
                    errors++;
                    continue;
                }
                var materials = a.slots.ToDictionary(s => s.name, s => PropMaterial(a, s, arrays));
                var filters = root.GetComponentsInChildren<MeshFilter>(true);
                var lods = new List<PropLibrary.Lod>();
                foreach (var lod in a.lods)
                {
                    var mf = filters.FirstOrDefault(f => f.sharedMesh != null && f.sharedMesh.name == lod.mesh)
                             ?? filters.FirstOrDefault(f => f.name == lod.mesh);
                    if (mf == null)
                    {
                        Debug.LogError($"[PropLibraryBuilder] {a.name}: mesh {lod.mesh} missing from {a.fbx}");
                        errors++;
                        continue;
                    }
                    // map each submesh's FBX material (named after the Blender slot) to the generated material
                    var embedded = mf.GetComponent<MeshRenderer>().sharedMaterials;
                    var subs = new Material[mf.sharedMesh.subMeshCount];
                    for (int i = 0; i < subs.Length; i++)
                    {
                        string slot = i < embedded.Length && embedded[i] != null ? SlotName(embedded[i].name) : null;
                        subs[i] = slot != null && materials.TryGetValue(slot, out var pm) ? pm : materials.Values.First();
                    }
                    lods.Add(new PropLibrary.Lod { mesh = mf.sharedMesh, materials = subs });
                }
                entries.Add(new PropLibrary.Entry
                {
                    name = a.name, kind = a.kind, variant = a.variant, lods = lods.ToArray(),
                    radius = a.extents.radius, top = a.extents.top, bottom = a.extents.bottom, hang = a.hang,
                });
            }

            var library = AssetDatabase.LoadAssetAtPath<PropLibrary>(LibraryPath);
            if (library == null)
            {
                library = ScriptableObject.CreateInstance<PropLibrary>();
                AssetDatabase.CreateAsset(library, LibraryPath);
            }
            library.entries = entries.OrderBy(e => e.name, StringComparer.Ordinal).ToArray();
            EditorUtility.SetDirty(library);
            AssetDatabase.SaveAssets();

            for (int k = 0; k < PropRegistry.Count; k++)
            {
                int have = entries.Count(e => e.kind == PropRegistry.Name(k));
                if (have != PropRegistry.Get(k).Variants)
                    Debug.LogWarning($"[PropLibraryBuilder] {PropRegistry.Name(k)}: {have} variants built, registry expects {PropRegistry.Get(k).Variants}");
            }
            Debug.Log($"[PropLibraryBuilder] {entries.Count} props, {errors} errors -> {LibraryPath}");
            return library;
        }

        /// <summary>Embedded material names can carry Blender's ".001" suffixes.</summary>
        static string SlotName(string material)
        {
            int dot = material.IndexOf('.');
            return dot > 0 ? material.Substring(0, dot) : material;
        }

        static Material PropMaterial(ManifestAsset a, Slot slot, (Texture2DArray albedo, Texture2DArray normal, Texture2DArray mask) arrays)
        {
            string dir = $"{PropModelPostprocessor.ModelsFolder}/{a.category}/Materials";
            Directory.CreateDirectory(dir);
            string path = $"{dir}/{a.name}_{slot.name}.mat";
            var shader = Shader.Find("Voxelwild/Prop");
            if (shader == null) throw new Exception("shader Voxelwild/Prop not found");
            var m = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (m == null)
            {
                m = new Material(shader);
                AssetDatabase.CreateAsset(m, path);
            }
            else if (m.shader != shader) m.shader = shader;

            m.enableInstancing = true;
            m.SetTexture("_AlbedoArray", arrays.albedo);
            m.SetTexture("_NormalArray", arrays.normal);
            m.SetTexture("_MaskArray", arrays.mask);
            var bakedNormal = string.IsNullOrEmpty(a.textures?.normal) ? null : AssetDatabase.LoadAssetAtPath<Texture2D>(a.textures.normal);
            var bakedMask = string.IsNullOrEmpty(a.textures?.mask) ? null : AssetDatabase.LoadAssetAtPath<Texture2D>(a.textures.mask);
            m.SetTexture("_BakedNormal", bakedNormal);
            m.SetTexture("_BakedMask", bakedMask);
            m.SetFloat("_HasBakedNormal", bakedNormal != null ? 1f : 0f);
            m.SetFloat("_HasBakedMask", bakedMask != null ? 1f : 0f);

            int layer = 0;
            if (!string.IsNullOrEmpty(slot.layer))
            {
                if (Enum.TryParse(slot.layer, out TextureLayer l)) layer = (int)l;
                else Debug.LogError($"[PropLibraryBuilder] {a.name}.{slot.name}: unknown texture layer '{slot.layer}'");
            }
            m.SetFloat("_Layer", layer);
            m.SetFloat("_MossLayer", (int)TextureLayer.Moss);
            m.SetFloat("_Mapping", slot.mapping == "triplanar" ? 0f : slot.mapping == "uv" ? 1f : 2f);
            m.SetFloat("_Tiling", slot.tiling);
            m.SetFloat("_Moss", slot.moss);
            var t = slot.tint != null && slot.tint.Length >= 3 ? slot.tint : new[] { 1f, 1f, 1f };
            m.SetVector("_Tint", new Vector4(t[0], t[1], t[2], 1f));     // a linear multiplier, not an sRGB colour
            m.SetFloat("_Roughness", slot.roughness > 0 ? slot.roughness : 1f);
            m.SetFloat("_EdgeWear", a.category == "Rocks" || a.category == "Cave" ? 0.25f : 0.1f);
            m.SetFloat("_Foliage", slot.foliage ? 1f : 0f);
            m.SetFloat("_Cull", slot.foliage ? (float)UnityEngine.Rendering.CullMode.Off : (float)UnityEngine.Rendering.CullMode.Back);
            EditorUtility.SetDirty(m);
            return m;
        }
    }
}
