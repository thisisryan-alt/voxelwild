using System;
using System.IO;
using UnityEngine;

namespace Voxelwild.Gameplay
{
    /// <summary>
    /// The player's options, loaded once from <c>{persistentDataPath}/settings.json</c> and shared by the main menu
    /// and the World scene. Change them with <see cref="Set"/>: the file is rewritten and <see cref="Changed"/>
    /// fires so audio, the camera and the controls follow immediately.
    /// </summary>
    public static class SettingsStore
    {
        static GameSettings _current;

        public static event Action<GameSettings> Changed;

        public static string FilePath => Path.Combine(Application.persistentDataPath, "settings.json");

        public static GameSettings Current
        {
            get
            {
                if (_current == null) _current = Load();
                return _current;
            }
        }

        static GameSettings Load()
        {
            try
            {
                if (File.Exists(FilePath)) return (JsonUtility.FromJson<GameSettings>(File.ReadAllText(FilePath)) ?? new GameSettings()).Validate();
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Settings] could not read {FilePath}: {e.Message}; using defaults");
            }
            return new GameSettings();
        }

        public static void Set(GameSettings settings)
        {
            _current = settings.Clone().Validate();
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(FilePath));
                SaveFolders.WriteAtomic(FilePath, s =>
                {
                    var bytes = System.Text.Encoding.UTF8.GetBytes(JsonUtility.ToJson(_current, true));
                    s.Write(bytes, 0, bytes.Length);
                });
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Settings] could not write {FilePath}: {e.Message}");
            }
            Changed?.Invoke(_current);
        }
    }
}
