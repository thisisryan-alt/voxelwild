using System;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;
using Voxelwild.Gameplay;

namespace Voxelwild.UI
{
    /// <summary>
    /// The title screen (MainMenu scene): continue the last world, pick or create a world, an unsaved creative
    /// sandbox, settings, quit. The background is the real sky turning slowly at golden hour. Command-line runs
    /// (-vwCapture, -vwWorld) skip straight to the World scene, which reads the arguments itself.
    /// </summary>
    [RequireComponent(typeof(UIDocument))]
    public sealed class MainMenu : MonoBehaviour
    {
        public const string WorldScene = "World";

        [SerializeField] Transform cameraRig;
        [SerializeField] float turnDegreesPerSecond = 1.2f;

        VisualElement _root, _page;

        void Awake()
        {
            // only on first launch: GameSession marks the command line read, so quitting to the title stays here
            var args = System.Environment.GetCommandLineArgs();
            if (!WorldLaunch.CommandLineRead && (Array.IndexOf(args, "-vwCapture") >= 0 || Array.IndexOf(args, "-vwWorld") >= 0))
                SceneManager.LoadScene(WorldScene);
        }

        void OnEnable()
        {
            _root = GetComponent<UIDocument>().rootVisualElement;
            UnityEngine.Cursor.lockState = CursorLockMode.None;
            UnityEngine.Cursor.visible = true;
            Time.timeScale = 1f;
            AudioListener.pause = false;
            AudioListener.volume = SettingsStore.Current.masterVolume;
            ShowTitle();
        }

        void Update()
        {
            if (cameraRig != null) cameraRig.Rotate(0f, turnDegreesPerSecond * Time.deltaTime, 0f, Space.World);
        }

        VisualElement Page(bool centred)
        {
            _root.Clear();
            _page = Ui.Fill(new VisualElement());
            _page.style.backgroundColor = new Color(0f, 0f, 0f, centred ? 0.45f : 0.15f);
            if (centred)
            {
                _page.style.justifyContent = Justify.Center;
                _page.style.alignItems = Align.Center;
            }
            _root.Add(_page);
            return _page;
        }

        // ------------------------------------------------------------------ pages

        void ShowTitle()
        {
            var page = Page(centred: false);
            var column = new VisualElement();
            column.style.position = Position.Absolute;
            column.style.left = 96;
            column.style.bottom = 96;
            column.style.width = 360;

            var title = new Label("VOXELWILD");
            title.style.fontSize = 64;
            title.style.unityFontStyleAndWeight = FontStyle.Bold;
            title.style.color = Color.white;
            title.style.letterSpacing = 8;
            column.Add(title);
            var tag = Ui.Text("A living voxel wilderness", 16, new Color(1, 1, 1, 0.75f));
            tag.style.marginBottom = 32;
            column.Add(tag);

            var worlds = SaveFolders.List(WorldLaunch.SavesRoot);
            if (worlds.Count > 0) column.Add(Ui.Button($"Continue: {worlds[0]}", () => Play(worlds[0]), primary: true));
            column.Add(Ui.Button("Worlds", ShowWorlds, primary: worlds.Count == 0));
            column.Add(Ui.Button("Creative sandbox (not saved)", () => { WorldLaunch.Sandbox(); Launch("Generating sandbox"); }));
            column.Add(Ui.Button("Settings", () => { var p = Page(true); p.Add(SettingsView.Build(null, ShowTitle)); }));
            column.Add(Ui.Button("Quit", Quit));
            page.Add(column);

            var version = Ui.Text($"v{Application.version}", 12);
            version.style.position = Position.Absolute;
            version.style.right = 16;
            version.style.bottom = 12;
            page.Add(version);
        }

        void ShowWorlds()
        {
            var page = Page(centred: true);
            var w = Ui.Window(640);
            w.Add(Ui.Title("Worlds"));
            var list = new ScrollView();
            list.style.maxHeight = 420;
            list.style.marginBottom = 12;
            var worlds = SaveFolders.List(WorldLaunch.SavesRoot);
            if (worlds.Count == 0) list.Add(Ui.Text("No worlds yet.", 14));
            foreach (var name in worlds) list.Add(WorldRow(name));
            w.Add(list);
            w.Add(Ui.Button("Create new world", ShowCreate, primary: true));
            w.Add(Ui.Button("Back", ShowTitle));
            page.Add(w);
        }

        VisualElement WorldRow(string folder)
        {
            string dir = Path.Combine(WorldLaunch.SavesRoot, folder);
            string file = Path.Combine(dir, SaveFolders.WorldFile);
            string detail;
            try
            {
                var data = JsonUtility.FromJson<WorldSaveData>(File.ReadAllText(file));
                var played = TimeSpan.FromSeconds(data.playSeconds);
                detail = $"{data.mode} · seed {data.seed} · day {(int)data.days} · played {(int)played.TotalHours}h {played.Minutes:00}m · " +
                         $"last saved {File.GetLastWriteTime(file):d MMM yyyy HH:mm}";
            }
            catch (Exception)
            {
                detail = "world.json could not be read";
            }

            var row = new VisualElement();
            row.style.flexDirection = FlexDirection.Row;
            row.style.alignItems = Align.Center;
            row.style.backgroundColor = Ui.Panel;
            Ui.Border(row, 1, Ui.Edge);
            Ui.Padding(row, 10);
            row.style.marginBottom = 6;
            var text = new VisualElement();
            text.style.flexGrow = 1;
            var n = Ui.Text(folder, 15, Color.white);
            n.style.unityFontStyleAndWeight = FontStyle.Bold;
            text.Add(n);
            text.Add(Ui.Text(detail, 12));
            row.Add(text);
            var play = Ui.Button("Play", () => Play(folder), primary: true);
            play.style.width = 80;
            play.style.marginBottom = 0;
            play.style.marginLeft = 8;
            row.Add(play);
            var delete = Ui.Button("Delete", () => ShowDelete(folder));
            delete.style.width = 80;
            delete.style.marginBottom = 0;
            delete.style.marginLeft = 8;
            row.Add(delete);
            return row;
        }

        void ShowCreate()
        {
            var page = Page(centred: true);
            var w = Ui.Window(560);
            w.Add(Ui.Title("New world"));
            var name = Ui.Field("World name", "New World", 40);
            w.Add(name);
            var seed = Ui.Field("Seed (blank = random)", "", 32);
            w.Add(seed);
            var mode = GameMode.Survival;
            w.Add(Ui.Chooser("Game mode", () => mode.ToString(), _ => mode = mode == GameMode.Survival ? GameMode.Creative : GameMode.Survival));
            var hint = Ui.Text("Survival: gather, craft, eat and stay alive. Creative: fly and build with every block.", 12);
            hint.style.marginBottom = 16;
            w.Add(hint);
            w.Add(Ui.Button("Create", () =>
            {
                string folder = SaveFolders.UniqueName(WorldLaunch.SavesRoot, name.value);
                uint s = SaveFolders.SeedFromText(seed.value) ?? (uint)UnityEngine.Random.Range(1, int.MaxValue);
                WorldLaunch.Create(folder, s, mode);
                Launch($"Creating {folder}");
            }, primary: true));
            w.Add(Ui.Button("Back", ShowWorlds));
            page.Add(w);
        }

        void ShowDelete(string folder)
        {
            var page = Page(centred: true);
            var w = Ui.Window(460);
            w.Add(Ui.Title($"Delete {folder}?"));
            var warn = Ui.Text("The world and everything built in it will be gone for good.", 14);
            warn.style.marginBottom = 16;
            w.Add(warn);
            var delete = Ui.Button("Delete world", () =>
            {
                try
                {
                    Directory.Delete(SaveFolders.WorldDirectory(WorldLaunch.SavesRoot, folder), true);
                }
                catch (Exception e)
                {
                    Debug.LogWarning($"[MainMenu] could not delete {folder}: {e.Message}");
                }
                ShowWorlds();
            }, fill: Ui.Danger);
            w.Add(delete);
            w.Add(Ui.Button("Cancel", ShowWorlds, primary: true));
            page.Add(w);
        }

        // ------------------------------------------------------------------ actions

        void Play(string folder)
        {
            WorldLaunch.Load(folder);
            Launch($"Loading {folder}");
        }

        void Launch(string message)
        {
            var page = Page(centred: true);
            page.style.backgroundColor = new Color(0.063f, 0.071f, 0.078f);
            page.Add(Ui.Title(message, 20));
            SceneManager.LoadSceneAsync(WorldScene);   // async so this message gets drawn while the scene loads
        }

        static void Quit()
        {
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }
    }
}
