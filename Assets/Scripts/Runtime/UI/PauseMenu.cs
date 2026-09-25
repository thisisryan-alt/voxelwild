using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.SceneManagement;
using UnityEngine.UIElements;
using Voxelwild.Gameplay;
using Voxelwild.Player;
using Voxelwild.Rendering;

namespace Voxelwild.UI
{
    /// <summary>
    /// Esc in the World scene: pauses the game (time and sound stop) over a dimmed view with Resume, Settings,
    /// Save, Save and quit to title, and Quit. Runs before the HUD so Esc closing the inventory doesn't also open
    /// this. Input comes back only once the mouse button that clicked Resume is released, so that click doesn't
    /// break a block.
    /// </summary>
    [RequireComponent(typeof(UIDocument)), DefaultExecutionOrder(40)]
    public sealed class PauseMenu : MonoBehaviour
    {
        public const string TitleScene = "MainMenu";

        [SerializeField] PlayerController player;
        [SerializeField] GameSession session;
        [SerializeField] GameHud hud;
        [SerializeField] QualityManager quality;

        public static bool Paused { get; private set; }

        VisualElement _root, _overlay;
        bool _resumePending;

        void OnEnable()
        {
            _root = GetComponent<UIDocument>().rootVisualElement;
            _root.pickingMode = PickingMode.Ignore;
            player.EscapeReleasesCursor = false;
        }

        void OnDisable()
        {
            if (Paused) SetPaused(false);
            player.EscapeReleasesCursor = true;
        }

        void Update()
        {
            if (_resumePending)
            {
                var mouse = Mouse.current;
                if (mouse == null || !mouse.leftButton.isPressed)
                {
                    _resumePending = false;
                    player.InputEnabled = true;
                }
            }

            var kb = Keyboard.current;
            if (kb == null || !kb.escapeKey.wasPressedThisFrame || !player.Spawned) return;
            if (hud != null && hud.InventoryOpen) return;   // the HUD closes the inventory
            if (session != null && session.Dead) return;
            SetPaused(!Paused);
        }

        void SetPaused(bool paused)
        {
            Paused = paused;
            Time.timeScale = paused ? 0f : 1f;
            AudioListener.pause = paused;
            if (paused)
            {
                player.InputEnabled = false;
                _resumePending = false;
                UnityEngine.Cursor.lockState = CursorLockMode.None;
                UnityEngine.Cursor.visible = true;
                ShowMain();
            }
            else
            {
                if (_overlay != null) _overlay.RemoveFromHierarchy();
                _overlay = null;
                _resumePending = true;
                UnityEngine.Cursor.lockState = CursorLockMode.Locked;
                UnityEngine.Cursor.visible = false;
            }
        }

        VisualElement Overlay()
        {
            if (_overlay != null) _overlay.RemoveFromHierarchy();
            _overlay = Ui.Fill(new VisualElement());
            _overlay.style.backgroundColor = new Color(0f, 0f, 0f, 0.5f);
            _overlay.style.justifyContent = Justify.Center;
            _overlay.style.alignItems = Align.Center;
            _root.Add(_overlay);
            return _overlay;
        }

        void ShowMain()
        {
            var o = Overlay();
            var w = Ui.Window(360);
            w.Add(Ui.Title("Paused"));
            if (session != null && session.Persistent) w.Add(Ui.Text($"{session.WorldName} · {session.Mode}", 13));
            var gap = new VisualElement();
            gap.style.height = 12;
            w.Add(gap);
            w.Add(Ui.Button("Resume", () => SetPaused(false), primary: true));
            w.Add(Ui.Button("Settings", ShowSettings));
            bool persistent = session != null && session.Persistent;
            if (persistent)
            {
                Button save = null;
                save = Ui.Button("Save", () => { session.Save(); save.text = "Saved"; });
                w.Add(save);
            }
            bool hasTitle = Application.CanStreamedLevelBeLoaded(TitleScene);
            if (hasTitle) w.Add(Ui.Button(persistent ? "Save and quit to title" : "Quit to title", QuitToTitle));
            w.Add(Ui.Button("Quit game", QuitGame));
            o.Add(w);
        }

        void ShowSettings()
        {
            var o = Overlay();
            o.Add(SettingsView.Build(quality, ShowMain));
        }

        void QuitToTitle()
        {
            if (session != null) session.Save();
            SetPaused(false);
            WorldLaunch.Sandbox();
            SceneManager.LoadScene(TitleScene);
        }

        void QuitGame()
        {
            if (session != null) session.Save();
#if UNITY_EDITOR
            UnityEditor.EditorApplication.isPlaying = false;
#else
            Application.Quit();
#endif
        }
    }
}
