using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using Unity.Mathematics;

namespace Voxelwild.Gameplay
{
    /// <summary>
    /// On-disk storage for edited sections: one file per region of 16×16 columns
    /// (<c>regions/r.{x}.{z}.bin</c>), each holding the run-length-encoded sections the player changed, in the same
    /// run format as <see cref="Voxelwild.World.ModifiedChunkStore"/> (run length, block id pairs).
    ///
    /// Format (little-endian): "VWRG", int32 version, int32 count, then per section int32 x, y, z, int32 pair count
    /// and the ushort pairs. Reads check the magic, version and that every section decodes to exactly one section of
    /// voxels, so a truncated or foreign file fails loudly instead of corrupting the world. Engine-free.
    /// </summary>
    public static class RegionFile
    {
        public const int Version = 1;
        public const int RegionColumns = 16;
        static readonly byte[] Magic = Encoding.ASCII.GetBytes("VWRG");

        public static int2 RegionOf(int3 section) =>
            new int2((int)math.floor(section.x / (float)RegionColumns), (int)math.floor(section.z / (float)RegionColumns));

        public static string FileName(int2 region) => $"r.{region.x}.{region.y}.bin";

        public static void Write(Stream stream, IEnumerable<KeyValuePair<int3, ushort[]>> sections)
        {
            var list = new List<KeyValuePair<int3, ushort[]>>(sections);
            // stable order: identical worlds produce identical files
            list.Sort((a, b) => a.Key.y != b.Key.y ? a.Key.y.CompareTo(b.Key.y)
                              : a.Key.z != b.Key.z ? a.Key.z.CompareTo(b.Key.z) : a.Key.x.CompareTo(b.Key.x));
            using var w = new BinaryWriter(stream, Encoding.UTF8, leaveOpen: true);
            w.Write(Magic);
            w.Write(Version);
            w.Write(list.Count);
            foreach (var kv in list)
            {
                w.Write(kv.Key.x);
                w.Write(kv.Key.y);
                w.Write(kv.Key.z);
                w.Write(kv.Value.Length / 2);
                foreach (ushort u in kv.Value) w.Write(u);
            }
        }

        public static Dictionary<int3, ushort[]> Read(Stream stream, int sectionVolume)
        {
            using var r = new BinaryReader(stream, Encoding.UTF8, leaveOpen: true);
            var magic = r.ReadBytes(4);
            if (magic.Length != 4 || magic[0] != Magic[0] || magic[1] != Magic[1] || magic[2] != Magic[2] || magic[3] != Magic[3])
                throw new InvalidDataException("not a Voxelwild region file");
            int version = r.ReadInt32();
            if (version != Version) throw new InvalidDataException($"region file version {version}, expected {Version}");
            int count = r.ReadInt32();
            if (count < 0 || count > 1 << 20) throw new InvalidDataException($"bad section count {count}");
            var result = new Dictionary<int3, ushort[]>(count);
            for (int i = 0; i < count; i++)
            {
                var key = new int3(r.ReadInt32(), r.ReadInt32(), r.ReadInt32());
                int pairs = r.ReadInt32();
                if (pairs <= 0 || pairs > sectionVolume) throw new InvalidDataException($"section {key}: bad run count {pairs}");
                var runs = new ushort[pairs * 2];
                long total = 0;
                for (int k = 0; k < runs.Length; k++)
                {
                    runs[k] = r.ReadUInt16();
                    if ((k & 1) == 0) total += runs[k];
                }
                if (total != sectionVolume) throw new InvalidDataException($"section {key}: runs cover {total} voxels, expected {sectionVolume}");
                result[key] = runs;
            }
            return result;
        }
    }

    /// <summary>Where worlds live on disk: <c>{root}/{safe name}/</c> with world.json and regions/. Engine-free.</summary>
    public static class SaveFolders
    {
        public const string WorldFile = "world.json";
        public const string RegionsFolder = "regions";

        /// <summary>A file-system-safe folder name for a world name (letters, digits, space, - and _).</summary>
        public static string SafeName(string name)
        {
            var sb = new StringBuilder();
            foreach (char c in (name ?? "").Trim())
                sb.Append(char.IsLetterOrDigit(c) || c == ' ' || c == '-' || c == '_' ? c : '_');
            string s = sb.ToString().Trim();
            if (s.Length == 0) s = "World";
            return s.Length > 48 ? s.Substring(0, 48) : s;
        }

        public static string WorldDirectory(string root, string name) => Path.Combine(root, SafeName(name));

        /// <summary>The name itself if no world uses its folder yet, otherwise "name 2", "name 3", ... (always a SafeName).</summary>
        public static string UniqueName(string root, string name)
        {
            string baseName = SafeName(name);
            if (baseName.Length > 42) baseName = baseName.Substring(0, 42).TrimEnd();
            string candidate = baseName;
            for (int i = 2; Directory.Exists(Path.Combine(root, candidate)); i++) candidate = $"{baseName} {i}";
            return candidate;
        }

        /// <summary>
        /// The seed typed on the new-world screen: a number is used as is, any other text is hashed (FNV-1a) so
        /// words make repeatable worlds too. Null when the field is blank (pick a random seed).
        /// </summary>
        public static uint? SeedFromText(string text)
        {
            text = (text ?? "").Trim();
            if (text.Length == 0) return null;
            if (uint.TryParse(text, out uint n)) return n;
            uint h = 2166136261u;
            foreach (char c in text) { h ^= c; h *= 16777619u; }
            return h;
        }

        /// <summary>Names of the saved worlds under root (folders that contain world.json), most recent first.</summary>
        public static List<string> List(string root)
        {
            var worlds = new List<(string name, DateTime time)>();
            if (!Directory.Exists(root)) return new List<string>();
            foreach (var dir in Directory.GetDirectories(root))
            {
                var file = Path.Combine(dir, WorldFile);
                if (File.Exists(file)) worlds.Add((Path.GetFileName(dir), File.GetLastWriteTimeUtc(file)));
            }
            worlds.Sort((a, b) => b.time.CompareTo(a.time));
            return worlds.ConvertAll(w => w.name);
        }

        /// <summary>Writes a file atomically: to a temporary file first, then moved over the old one.</summary>
        public static void WriteAtomic(string path, Action<Stream> write)
        {
            Directory.CreateDirectory(Path.GetDirectoryName(path));
            string tmp = path + ".tmp";
            using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write)) write(fs);
            // swap in one step where the file system allows it, so a crash leaves the old or the new file
            if (File.Exists(path))
            {
                try { File.Replace(tmp, path, null); return; }
                catch (PlatformNotSupportedException) { File.Delete(path); }
            }
            File.Move(tmp, path);
        }
    }
}
