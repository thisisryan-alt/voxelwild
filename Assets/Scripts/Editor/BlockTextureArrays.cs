using System;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace Voxelwild.EditorTools
{
    /// <summary>
    /// Packs the scanned PBR maps listed in SourceArt/Textures/block_layers.json into three flipbook
    /// atlases that Unity imports as Texture2DArrays:
    ///   BlockAlbedo_Array  RGB = colour, A = opacity if the set has one, else height   (sRGB)
    ///   BlockNormal_Array  RGB = OpenGL tangent-space normal                          (linear)
    ///   BlockMask_Array    R = AO, G = roughness, B = metallic, A = emission          (linear)
    /// Sources: 'ambientCG' scans (tools/fetch_ambientcg.py) and 'generated' sets (tools/generate_textures.py).
    /// Layer i sits in grid cell (i % columns, i / columns), counted from the top-left, which is the
    /// order Unity uses when slicing a flipbook into array layers.
    /// </summary>
    public static class BlockTextureArrays
    {
        public const string ManifestPath = "SourceArt/Textures/block_layers.json";
        public const string OutputFolder = "Assets/Art/Textures/Blocks";
        public const string AlbedoPath = OutputFolder + "/BlockAlbedo_Array.png";
        public const string NormalPath = OutputFolder + "/BlockNormal_Array.png";
        public const string MaskPath = OutputFolder + "/BlockMask_Array.png";
        const int MaxColumns = 6;

        [Serializable]
        public class LayerEntry
        {
            public string name;
            public string source;
            public string id;
        }

        [Serializable]
        public class Manifest
        {
            public int resolution;
            public LayerEntry[] layers;
        }

        public static Manifest LoadManifest() =>
            JsonUtility.FromJson<Manifest>(File.ReadAllText(ManifestPath));

        public static (int columns, int rows) GridFor(int layerCount)
        {
            int cols = Math.Min(MaxColumns, layerCount);
            return (cols, (layerCount + cols - 1) / cols);
        }

        [MenuItem("Voxelwild/Art/Build Block Texture Arrays")]
        public static void Build()
        {
            var manifest = LoadManifest();
            int res = manifest.resolution;
            int n = manifest.layers.Length;
            var (cols, rows) = GridFor(n);
            int w = cols * res, h = rows * res;

            var albedo = new Color32[w * h];
            var normal = new Color32[w * h];
            var mask = new Color32[w * h];

            for (int i = 0; i < n; i++)
            {
                var layer = manifest.layers[i];
                string dir = Path.Combine("SourceArt/Textures", layer.source, layer.id);
                if (!Directory.Exists(dir))
                    throw new DirectoryNotFoundException(layer.source == "generated"
                        ? $"{dir} missing - run `python tools/generate_textures.py`"
                        : $"{dir} missing - run `python tools/fetch_ambientcg.py`");

                var color = Load(dir, "_Color", res, required: true, fallback: Color.magenta);
                var height = Load(dir, "_Displacement", res, required: false, fallback: Color.gray);
                var nrm = Load(dir, "_NormalGL", res, required: true, fallback: new Color(0.5f, 0.5f, 1f));
                var ao = Load(dir, "_AmbientOcclusion", res, required: false, fallback: Color.white);
                var rough = Load(dir, "_Roughness", res, required: true, fallback: Color.white);
                var metal = Load(dir, "_Metalness", res, required: false, fallback: Color.black);
                var emission = Load(dir, "_Emission", res, required: false, fallback: Color.black);
                bool hasOpacity = HasMap(dir, "_Opacity");
                var opacity = hasOpacity ? Load(dir, "_Opacity", res, required: true, fallback: Color.white) : null;

                int cellX = (i % cols) * res;
                int cellY = (rows - 1 - i / cols) * res;   // pixel rows start at the bottom
                for (int y = 0; y < res; y++)
                for (int x = 0; x < res; x++)
                {
                    int s = x + y * res;
                    int d = (cellX + x) + (cellY + y) * w;
                    var c = color[s];
                    albedo[d] = new Color32(c.r, c.g, c.b, hasOpacity ? opacity[s].r : height[s].r);
                    var nn = nrm[s];
                    normal[d] = new Color32(nn.r, nn.g, nn.b, 255);
                    mask[d] = new Color32(ao[s].r, rough[s].r, metal[s].r, emission[s].r);
                }
                Debug.Log($"[BlockTextureArrays] layer {i} {layer.name} <- {layer.id}");
            }

            Directory.CreateDirectory(OutputFolder);
            Write(AlbedoPath, albedo, w, h);
            Write(NormalPath, normal, w, h);
            Write(MaskPath, mask, w, h);
            AssetDatabase.Refresh();
            foreach (var p in new[] { AlbedoPath, NormalPath, MaskPath })
                AssetDatabase.ImportAsset(p, ImportAssetOptions.ForceUpdate);
            Debug.Log($"[BlockTextureArrays] built {n} layers at {res}px ({cols}x{rows} grid)");
        }

        static bool HasMap(string dir, string suffix)
        {
            foreach (var f in Directory.GetFiles(dir))
                if (Path.GetFileNameWithoutExtension(f).EndsWith(suffix, StringComparison.OrdinalIgnoreCase)) return true;
            return false;
        }

        static Color32[] Load(string dir, string suffix, int res, bool required, Color fallback)
        {
            string file = null;
            foreach (var f in Directory.GetFiles(dir))
                if (Path.GetFileNameWithoutExtension(f).EndsWith(suffix, StringComparison.OrdinalIgnoreCase)) file = f;

            if (file == null)
            {
                if (required) throw new FileNotFoundException($"{dir}: no *{suffix} map");
                var fill = new Color32[res * res];
                Color32 c = fallback;
                for (int i = 0; i < fill.Length; i++) fill[i] = c;
                return fill;
            }

            var tex = new Texture2D(2, 2, TextureFormat.RGBA32, false, linear: true);
            tex.LoadImage(File.ReadAllBytes(file));
            if (tex.width != res || tex.height != res) tex = Resize(tex, res);
            var px = tex.GetPixels32();
            UnityEngine.Object.DestroyImmediate(tex);
            return px;
        }

        static Texture2D Resize(Texture2D src, int res)
        {
            var rt = RenderTexture.GetTemporary(res, res, 0, RenderTextureFormat.ARGB32, RenderTextureReadWrite.Linear);
            Graphics.Blit(src, rt);
            var prev = RenderTexture.active;
            RenderTexture.active = rt;
            var dst = new Texture2D(res, res, TextureFormat.RGBA32, false, linear: true);
            dst.ReadPixels(new Rect(0, 0, res, res), 0, 0);
            dst.Apply();
            RenderTexture.active = prev;
            RenderTexture.ReleaseTemporary(rt);
            UnityEngine.Object.DestroyImmediate(src);
            return dst;
        }

        static void Write(string path, Color32[] pixels, int w, int h)
        {
            var tex = new Texture2D(w, h, TextureFormat.RGBA32, false, linear: true);
            tex.SetPixels32(pixels);
            tex.Apply();
            File.WriteAllBytes(path, tex.EncodeToPNG());
            UnityEngine.Object.DestroyImmediate(tex);
        }
    }

    /// <summary>Import settings for the generated block atlases: sliced into Texture2DArrays.</summary>
    public sealed class BlockTextureArrayImporter : AssetPostprocessor
    {
        void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(BlockTextureArrays.OutputFolder + "/") || !assetPath.EndsWith("_Array.png")) return;
            var ti = (TextureImporter)assetImporter;
            ti.GetSourceTextureWidthAndHeight(out int w, out int h);
            int res = BlockTextureArrays.LoadManifest().resolution;

            ti.textureType = TextureImporterType.Default;
            var settings = new TextureImporterSettings();
            ti.ReadTextureSettings(settings);
            settings.textureShape = TextureImporterShape.Texture2DArray;
            settings.flipbookColumns = Mathf.Max(1, w / res);
            settings.flipbookRows = Mathf.Max(1, h / res);
            ti.SetTextureSettings(settings);
            ti.sRGBTexture = assetPath.Contains("Albedo");
            ti.alphaSource = TextureImporterAlphaSource.FromInput;
            ti.alphaIsTransparency = false;
            ti.mipmapEnabled = true;
            ti.mipmapFilter = TextureImporterMipFilter.KaiserFilter;
            ti.anisoLevel = 8;
            ti.filterMode = FilterMode.Trilinear;
            ti.wrapMode = TextureWrapMode.Repeat;
            ti.maxTextureSize = 16384;
            ti.textureCompression = TextureImporterCompression.CompressedHQ;
            ti.isReadable = false;
            // alpha-tested foliage keeps its coverage in distant mips instead of thinning out
            ti.mipMapsPreserveCoverage = assetPath.Contains("Albedo");
            ti.alphaTestReferenceValue = 0.5f;
            ti.streamingMipmaps = false;
        }
    }
}
