using Unity.Mathematics;
using UnityEngine;
using UnityEngine.InputSystem;
using Voxelwild.Player;
using Voxelwild.World;

namespace Voxelwild.Diagnostics
{
    /// <summary>
    /// Developer HUD (IMGUI): crosshair, a text hotbar and F3 statistics. This is a Phase 1 tool; the
    /// real game UI (icons, inventory, menus) is built in the UI phase.
    /// </summary>
    public sealed class DebugHud : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] PlayerController player;
        [SerializeField] BlockInteractor interactor;
        [SerializeField] bool showStats = true;

        public bool Hidden { get; set; }

        float _smoothedDt = 1f / 60f;
        float _worstDt;
        float _worstResetTime;
        Texture2D _white;
        GUIStyle _label, _slot, _slotSelected;

        void Update()
        {
            float dt = Time.unscaledDeltaTime;
            _smoothedDt = math.lerp(_smoothedDt, dt, 0.05f);
            _worstDt = math.max(_worstDt, dt);
            if (Time.unscaledTime > _worstResetTime) { _worstResetTime = Time.unscaledTime + 2f; _worstDt = dt; }
            var kb = Keyboard.current;
            if (kb != null && kb.f3Key.wasPressedThisFrame) showStats = !showStats;
            if (kb != null && kb.f1Key.wasPressedThisFrame) Hidden = !Hidden;
        }

        void EnsureStyles()
        {
            if (_white != null) return;
            _white = Texture2D.whiteTexture;
            _label = new GUIStyle(GUI.skin.label) { fontSize = 14, richText = true };
            _label.normal.textColor = Color.white;
            _slot = new GUIStyle(GUI.skin.box) { fontSize = 12, alignment = TextAnchor.MiddleCenter, wordWrap = true };
            _slot.normal.textColor = new Color(1, 1, 1, 0.85f);
            _slotSelected = new GUIStyle(_slot) { fontStyle = FontStyle.Bold };
            _slotSelected.normal.textColor = new Color(1f, 0.93f, 0.6f);
        }

        void OnGUI()
        {
            if (Hidden) return;
            EnsureStyles();

            if (!player.Spawned)
            {
                GUI.Label(new Rect(Screen.width / 2f - 120, Screen.height / 2f - 12, 240, 24), "<b>Generating world…</b>", _label);
                return;
            }

            // crosshair
            float cx = Screen.width / 2f, cy = Screen.height / 2f;
            GUI.color = new Color(1, 1, 1, 0.8f);
            GUI.DrawTexture(new Rect(cx - 9, cy - 1, 18, 2), _white);
            GUI.DrawTexture(new Rect(cx - 1, cy - 9, 2, 18), _white);
            GUI.color = Color.white;

            // hotbar
            const float slotW = 72, slotH = 40, gap = 4;
            int n = BlockInteractor.Hotbar.Length;
            float x0 = cx - (n * slotW + (n - 1) * gap) / 2f;
            float y0 = Screen.height - slotH - 16;
            for (int i = 0; i < n; i++)
            {
                bool sel = i == interactor.SelectedSlot;
                var r = new Rect(x0 + i * (slotW + gap), y0 - (sel ? 4 : 0), slotW, slotH);
                GUI.Box(r, $"{i + 1}\n{BlockRegistry.Name(BlockInteractor.Hotbar[i])}", sel ? _slotSelected : _slot);
            }

            if (!showStats) return;
            var p = player.Body.Position;
            string target = interactor.HasTarget
                ? $"{BlockRegistry.Name(interactor.Target.Id)} @ {interactor.Target.Block}"
                : "-";
            string text =
                $"<b>Voxelwild</b>  seed {world.Seed}\n" +
                $"{1f / _smoothedDt:0} fps  ({_smoothedDt * 1000f:0.0} ms, worst {_worstDt * 1000f:0.0} ms)\n" +
                $"pos {p.x:0.0} {p.y:0.0} {p.z:0.0}   yaw {player.Yaw:0} pitch {player.Pitch:0}\n" +
                $"{(player.Flying ? "flying" : player.InWater ? "swimming" : player.Body.Grounded ? "grounded" : "airborne")}\n" +
                $"columns {world.LoadedColumns} (generating {world.GeneratingColumns})  mesh jobs {world.MeshJobsInFlight}\n" +
                $"sections drawn {world.RenderedSections} (occlusion-culled {world.OcclusionCulledSections})  tris {world.RenderedTriangles / 1000}k  edited {world.ModifiedSections}\n" +
                $"target {target}\n" +
                "<size=12>WASD move · Space jump (double-tap: fly) · Ctrl sprint · Shift descend · F fly\n" +
                "LMB break · RMB place · 1-9/scroll select · Esc release mouse · F3 stats · F1 hide HUD</size>";
            GUI.color = new Color(0, 0, 0, 0.45f);
            GUI.DrawTexture(new Rect(8, 8, 560, 190), _white);
            GUI.color = Color.white;
            GUI.Label(new Rect(16, 12, 548, 186), text, _label);
        }
    }
}
