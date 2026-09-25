using System;
using System.Collections.Generic;
using System.IO;
using Unity.Mathematics;
using UnityEngine;
using UnityEngine.InputSystem;
using Voxelwild.Player;
using Voxelwild.Rendering;
using Voxelwild.World;

namespace Voxelwild.Gameplay
{
    /// <summary>What to play: set by the main menu (or the command line) before the World scene loads.</summary>
    public static class WorldLaunch
    {
        /// <summary>World to load or create; null plays an unsaved creative sandbox (editor Play, tests, captures).</summary>
        public static string WorldName;
        public static bool CreateNew;
        public static uint NewSeed = 20260924;
        public static GameMode NewMode = GameMode.Survival;
        /// <summary>The -vw command-line options apply to the first World load only.</summary>
        public static bool CommandLineRead;

        public static void Load(string name) { WorldName = name; CreateNew = false; }
        public static void Create(string name, uint seed, GameMode mode) { WorldName = name; CreateNew = true; NewSeed = seed; NewMode = mode; }
        public static void Sandbox() { WorldName = null; CreateNew = false; }

        /// <summary>Folder holding every saved world.</summary>
        public static string SavesRoot => Path.Combine(Application.persistentDataPath, "saves");
    }

    [Serializable]
    public sealed class SlotSave { public int slot; public int item; public int count; public int durability; }

    [Serializable]
    public sealed class PlayerSave
    {
        public float x, y, z, yaw, pitch;
        public float spawnX, spawnY, spawnZ;
        public float health = SurvivalStats.MaxHealth, hunger = SurvivalStats.MaxHunger, saturation = 5f, air = SurvivalStats.MaxAir;
        public int selected;
        public SlotSave[] slots = Array.Empty<SlotSave>();
    }

    [Serializable]
    public sealed class WorldSaveData
    {
        public int version = 1;
        public string name;
        public uint seed;
        public string mode = nameof(GameMode.Survival);
        public double days = 1.35;
        public string weather = nameof(WeatherKind.Clear);
        public string created;
        public float playSeconds;
        public PlayerSave player = new PlayerSave();
        /// <summary>Removed prop anchors as x, y, z triples.</summary>
        public int[] removedProps = Array.Empty<int>();
    }

    /// <summary>
    /// Runs one play session of a world: applies the seed, mode and saved state before any terrain generates,
    /// saves to disk (F5, every few minutes, and on quit), and handles death and respawning. Worlds live in
    /// <c>{persistentDataPath}/saves/{name}/</c>: world.json plus region files of the edited sections.
    /// Without a chosen world (editor Play, tests, capture runs) the session is an unsaved creative sandbox,
    /// exactly as before Phase 7. Command line: -vwWorld name [-vwNew] [-vwSeed n] [-vwMode Survival|Creative] (first load only).
    /// </summary>
    [DefaultExecutionOrder(-200)]
    public sealed class GameSession : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] PlayerController player;
        [SerializeField] PlayerSurvival survival;
        [SerializeField] ItemEntities items;
        [SerializeField] DayNightCycle dayNight;
        [SerializeField] WeatherSystem weather;
        [SerializeField] float autosaveMinutes = 5f;
        [SerializeField] float respawnDelay = 2.5f;

        WorldSaveData _data;
        string _dir;
        float _nextAutosave;
        float _respawnAt = -1f;
        float3 _spawn;
        bool _spawnKnown;

        public bool Persistent => _dir != null;
        public string WorldName => _data?.name;
        public GameMode Mode => survival != null ? survival.Mode : GameMode.Creative;
        public bool Dead => _respawnAt >= 0f;
        public DateTime LastSaved { get; private set; }
        public event Action Saved;

        void Awake()
        {
            ReadCommandLine();
            if (WorldLaunch.WorldName == null)
            {
                survival.SetMode(GameMode.Creative, fillCreativeHotbar: true);
                return;
            }
            _dir = SaveFolders.WorldDirectory(WorldLaunch.SavesRoot, WorldLaunch.WorldName);
            string file = Path.Combine(_dir, SaveFolders.WorldFile);
            if (!WorldLaunch.CreateNew && File.Exists(file)) Load(file);
            else NewWorld();
        }

        static void ReadCommandLine()
        {
            if (WorldLaunch.CommandLineRead) return;
            WorldLaunch.CommandLineRead = true;
            var args = System.Environment.GetCommandLineArgs();
            if (Array.IndexOf(args, "-vwCapture") >= 0) { WorldLaunch.Sandbox(); return; }
            int w = Array.IndexOf(args, "-vwWorld");
            if (w < 0 || w + 1 >= args.Length) return;
            string name = args[w + 1];
            if (Array.IndexOf(args, "-vwNew") >= 0)
            {
                uint seed = (uint)UnityEngine.Random.Range(1, int.MaxValue);
                int s = Array.IndexOf(args, "-vwSeed");
                if (s >= 0 && s + 1 < args.Length) uint.TryParse(args[s + 1], out seed);
                var mode = GameMode.Survival;
                int m = Array.IndexOf(args, "-vwMode");
                if (m >= 0 && m + 1 < args.Length) Enum.TryParse(args[m + 1], true, out mode);
                WorldLaunch.Create(name, seed, mode);
            }
            else WorldLaunch.Load(name);
        }

        void NewWorld()
        {
            _data = new WorldSaveData
            {
                name = WorldLaunch.WorldName,
                seed = WorldLaunch.NewSeed,
                mode = WorldLaunch.NewMode.ToString(),
                created = DateTime.UtcNow.ToString("o"),
            };
            world.Seed = _data.seed;
            survival.SetMode(WorldLaunch.NewMode, fillCreativeHotbar: true);
            if (WorldLaunch.NewMode == GameMode.Survival) survival.Inventory.Clear();
            WorldLaunch.CreateNew = false;
            Save();
        }

        void Load(string file)
        {
            _data = JsonUtility.FromJson<WorldSaveData>(File.ReadAllText(file));
            world.Seed = _data.seed;
            Enum.TryParse(_data.mode, out GameMode mode);
            survival.SetMode(mode, fillCreativeHotbar: false);

            string regions = Path.Combine(_dir, SaveFolders.RegionsFolder);
            if (Directory.Exists(regions))
                foreach (var path in Directory.GetFiles(regions, "*.bin"))
                    using (var fs = File.OpenRead(path))
                        world.ImportEdits(RegionFile.Read(fs, VoxelConstants.ChunkVolume));

            var removed = new List<int3>();
            for (int i = 0; i + 2 < _data.removedProps.Length; i += 3)
                removed.Add(new int3(_data.removedProps[i], _data.removedProps[i + 1], _data.removedProps[i + 2]));
            world.ImportRemovedProps(removed);

            var p = _data.player;
            player.SpawnOverride = new float3(p.x, p.y, p.z);
            player.SpawnLook = new float2(p.yaw, p.pitch);
            _spawn = new float3(p.spawnX, p.spawnY, p.spawnZ);
            _spawnKnown = !_spawn.Equals(float3.zero);
            survival.Stats.Load(p.health, p.hunger, p.saturation, p.air);
            survival.Inventory.Clear();
            foreach (var s in p.slots)
                if (s.slot >= 0 && s.slot < Inventory.Size && ItemRegistry.Exists((ushort)s.item))
                    survival.Inventory[s.slot] = new ItemStack { Item = (ushort)s.item, Count = s.count, Durability = s.durability };
            survival.Inventory.Selected = p.selected;
        }

        void Start()
        {
            if (_data == null) return;
            if (dayNight != null) dayNight.Days = _data.days;
            if (weather != null && Enum.TryParse(_data.weather, out WeatherKind kind)) weather.Model.ForceState(kind);
            survival.Stats.Died += OnDied;
            _nextAutosave = Time.unscaledTime + autosaveMinutes * 60f;
        }

        void Update()
        {
            if (!_spawnKnown && player.Spawned)
            {
                _spawn = player.Body.Position;
                _spawnKnown = true;
            }
            if (Dead && Time.time >= _respawnAt) Respawn();
            if (!Persistent) return;
            _data.playSeconds += Time.unscaledDeltaTime;
            var kb = Keyboard.current;
            if ((kb != null && kb.f5Key.wasPressedThisFrame) || Time.unscaledTime >= _nextAutosave) Save();
        }

        void OnApplicationQuit()
        {
            if (Persistent && player.Spawned) Save();
        }

        void OnDied(DamageCause cause)
        {
            if (items != null) items.Scatter(survival.Inventory, player.Body.Position);
            player.InputEnabled = false;
            _respawnAt = Time.time + respawnDelay;
            Debug.Log($"[GameSession] died ({cause})");
        }

        void Respawn()
        {
            _respawnAt = -1f;
            survival.Stats.Reset();
            player.Respawn(_spawnKnown ? _spawn : world.FindSpawnPoint());
            player.InputEnabled = true;
        }

        /// <summary>Writes world.json and every region with edits. Safe to call any time.</summary>
        public void Save()
        {
            if (!Persistent) return;
            _nextAutosave = Time.unscaledTime + autosaveMinutes * 60f;
            if (player.Spawned)
            {
                var pos = player.Body.Position;
                var p = _data.player;
                (p.x, p.y, p.z, p.yaw, p.pitch) = (pos.x, pos.y, pos.z, player.Yaw, player.Pitch);
                (p.spawnX, p.spawnY, p.spawnZ) = (_spawn.x, _spawn.y, _spawn.z);
                (p.health, p.hunger, p.saturation, p.air) = (survival.Stats.Health, survival.Stats.Hunger, survival.Stats.Saturation, survival.Stats.Air);
                p.selected = survival.Inventory.Selected;
                var slots = new List<SlotSave>();
                foreach (var (slot, stack) in survival.Inventory.NonEmpty())
                    slots.Add(new SlotSave { slot = slot, item = stack.Item, count = stack.Count, durability = stack.Durability });
                p.slots = slots.ToArray();
            }
            if (dayNight != null) _data.days = dayNight.Days;
            if (weather != null) _data.weather = weather.Model.Current.ToString();
            var removed = new List<int>();
            foreach (var a in world.RemovedProps) { removed.Add(a.x); removed.Add(a.y); removed.Add(a.z); }
            _data.removedProps = removed.ToArray();

            var byRegion = new Dictionary<int2, List<KeyValuePair<int3, ushort[]>>>();
            foreach (var kv in world.ExportEdits())
            {
                var r = RegionFile.RegionOf(kv.Key);
                if (!byRegion.TryGetValue(r, out var list)) byRegion[r] = list = new List<KeyValuePair<int3, ushort[]>>();
                list.Add(kv);
            }
            string regions = Path.Combine(_dir, SaveFolders.RegionsFolder);
            foreach (var kv in byRegion)
                SaveFolders.WriteAtomic(Path.Combine(regions, RegionFile.FileName(kv.Key)), s => RegionFile.Write(s, kv.Value));
            SaveFolders.WriteAtomic(Path.Combine(_dir, SaveFolders.WorldFile),
                s => { var bytes = System.Text.Encoding.UTF8.GetBytes(JsonUtility.ToJson(_data, true)); s.Write(bytes, 0, bytes.Length); });
            LastSaved = DateTime.Now;
            Saved?.Invoke();
        }
    }
}
