using Unity.Mathematics;
using UnityEngine;
using UnityEngine.InputSystem;
using Voxelwild.Player;
using Voxelwild.World;

namespace Voxelwild.Diagnostics
{
    /// <summary>
    /// Developer overlay (IMGUI): F3 statistics, or just the frame rate when the setting asks for it. F1 hides every HUD, this one and the
    /// game HUD (Voxelwild.UI.GameHud, which draws the crosshair, hotbar and inventory).
    /// </summary>
    public sealed class DebugHud : MonoBehaviour
    {
        [SerializeField] VoxelWorld world;
        [SerializeField] PlayerController player;
        [SerializeField] BlockInteractor interactor;
        [SerializeField] Voxelwild.Rendering.DayNightCycle dayNight;
        [SerializeField] Voxelwild.Rendering.QualityManager quality;
        [SerializeField] Voxelwild.Rendering.WeatherSystem weather;
        [SerializeField] bool showStats;

        public bool Hidden { get; set; }

        float _smoothedDt = 1f / 60f;
        float _worstDt;
        float _worstResetTime;
        Texture2D _white;
        GUIStyle _label;

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
        }

        string Clock()
        {
            if (dayNight == null) return "time -";
            float h = dayNight.TimeOfDay * 24f;
            var st = dayNight.State;
            return $"day {(int)dayNight.Days}  {(int)h:00}:{(int)(h % 1f * 60f):00}{(dayNight.Paused ? " (paused)" : "")}  " +
                   $"sun {st.SunElevationDeg:0}°  moon {st.MoonIllumination * 100f:0}%";
        }

        string WeatherLine()
        {
            if (weather == null || weather.Model == null) return "weather -";
            var m = weather.Model;
            string fall = m.Params.Precipitation > 0.05f ? (weather.Cold ? " snowing" : " raining") : "";
            return $"weather {m.Current}{fall}{(weather.Covered ? " (under cover)" : "")}  wet {m.Wetness * 100f:0}%  " +
                   $"puddles {m.Puddles * 100f:0}%  snow {m.SnowCover * 100f:0}%";
        }

        void OnGUI()
        {
            if (Hidden) return;
            EnsureStyles();

            if (!player.Spawned) return;   // the game HUD shows the loading screen

            if (!showStats)
            {
                if (Voxelwild.Gameplay.SettingsStore.Current.showFps)
                    GUI.Label(new Rect(12, 8, 200, 24), $"{1f / _smoothedDt:0} fps", _label);
                return;
            }
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
                $"props drawn {world.PropsDrawn} of {world.PropsLoaded}  water cells pending {world.WaterPending}\n" +
                $"{Clock()}  quality {(quality != null ? quality.Current.Name : "-")}\n" +
                $"{WeatherLine()}\n" +
                $"target {target}\n" +
                "<size=12>WASD move · Space jump (double-tap: fly) · Ctrl sprint · Shift descend · F fly\n" +
                "LMB break/mine · RMB place/eat · 1-9/scroll select · E inventory · F5 save · Esc release mouse · F3 stats · F1 hide HUD\n" +
                "T +1 hour (Shift: −1) · P pause time · F4 quality preset · Y next weather</size>";
            GUI.color = new Color(0, 0, 0, 0.45f);
            GUI.DrawTexture(new Rect(8, 8, 640, 256), _white);
            GUI.color = Color.white;
            GUI.Label(new Rect(16, 12, 628, 252), text, _label);
        }
    }
}
