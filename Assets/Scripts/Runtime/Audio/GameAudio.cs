using System.Collections.Generic;
using System.Threading.Tasks;
using Unity.Mathematics;
using UnityEngine;
using Voxelwild.Gameplay;
using Voxelwild.Player;
using Voxelwild.Rendering;
using Voxelwild.World;

namespace Voxelwild.Audio
{
    /// <summary>
    /// All game sound. The clips come from <see cref="SoundSynth"/>, which runs on a worker thread at startup.
    /// One-shots (footsteps by surface, mining, breaking, placing, splashes, pickups, damage) play on a pool of
    /// 3D voices; the ambience beds (wind, rain, birds by day, crickets at night, cave drone, underwater) are 2D
    /// loops whose volumes follow the weather, the time of day and where the player is: under open sky,
    /// under cover, deep underground or with their head under water. Thunder follows each lightning flash after
    /// a delay set by its distance. Without a player (the main menu) only wind and birds play.
    /// </summary>
    [DefaultExecutionOrder(60)]
    public sealed class GameAudio : MonoBehaviour
    {
        [SerializeField] PlayerController player;
        [SerializeField] VoxelWorld world;
        [SerializeField] BlockInteractor interactor;
        [SerializeField] PlayerSurvival survival;
        [SerializeField] ItemEntities items;
        [SerializeField] WeatherSystem weather;
        [SerializeField] DayNightCycle dayNight;
        [SerializeField] int voices = 16;
        [SerializeField] float stepDistance = 2.1f;

        const int Variants = 4;
        static readonly int SurfaceCount = System.Enum.GetValues(typeof(Surface)).Length;

        public static GameAudio Instance { get; private set; }

        /// <summary>Raw samples, made off the main thread.</summary>
        sealed class Bank
        {
            public float[][] Steps, Breaks, Hits, Places;   // [surface * Variants + variant]
            public float[][] ThunderNear, ThunderFar, Splash, Hurt;
            public float[] Pop, Click;
            public float[][] Beds;
        }

        Task<Bank> _building;
        bool _ready;
        AudioClip[] _steps, _breaks, _hits, _places, _thunderNear, _thunderFar, _splash, _hurt;
        AudioClip _pop, _click;
        readonly List<AudioClip> _allClips = new List<AudioClip>();

        AudioSource[] _pool;
        int _nextVoice;
        AudioSource _ui;
        AudioSource[] _beds;
        AudioLowPassFilter _rainFilter;

        float _stepAccum;
        float3 _lastFeet;
        bool _haveLastFeet;
        int _rng = 1;
        readonly List<(float at, bool near)> _thunder = new List<(float, bool)>();

        void Awake()
        {
            Instance = this;
            _building = Task.Run(Synthesize);
            _pool = new AudioSource[voices];
            for (int i = 0; i < voices; i++)
            {
                var go = new GameObject("Voice" + i);
                go.transform.SetParent(transform, false);
                var s = go.AddComponent<AudioSource>();
                s.playOnAwake = false;
                s.spatialBlend = 1f;
                s.rolloffMode = AudioRolloffMode.Logarithmic;
                s.minDistance = 1.5f;
                s.maxDistance = 48f;
                s.dopplerLevel = 0f;
                _pool[i] = s;
            }
            _ui = gameObject.AddComponent<AudioSource>();
            _ui.playOnAwake = false;
            _ui.spatialBlend = 0f;
            _ui.ignoreListenerPause = true;   // menus click while the game is paused
        }

        static Bank Synthesize()
        {
            var b = new Bank();
            int n = SurfaceCount * Variants;
            b.Steps = new float[n][];
            b.Breaks = new float[n][];
            b.Hits = new float[n][];
            b.Places = new float[n][];
            for (int s = 0; s < SurfaceCount; s++)
            for (int v = 0; v < Variants; v++)
            {
                b.Steps[s * Variants + v] = SoundSynth.Footstep((Surface)s, v);
                b.Breaks[s * Variants + v] = SoundSynth.Break((Surface)s, v);
                b.Hits[s * Variants + v] = SoundSynth.Hit((Surface)s, v);
                b.Places[s * Variants + v] = SoundSynth.Place((Surface)s, v);
            }
            b.ThunderNear = new[] { SoundSynth.Thunder(1, true), SoundSynth.Thunder(2, true) };
            b.ThunderFar = new[] { SoundSynth.Thunder(3, false), SoundSynth.Thunder(4, false), SoundSynth.Thunder(5, false) };
            b.Splash = new[] { SoundSynth.Splash(0), SoundSynth.Splash(1) };
            b.Hurt = new[] { SoundSynth.Hurt(0), SoundSynth.Hurt(1) };
            b.Pop = SoundSynth.Pop();
            b.Click = SoundSynth.Click();
            var beds = System.Enum.GetValues(typeof(SoundSynth.Bed));
            b.Beds = new float[beds.Length][];
            foreach (SoundSynth.Bed bed in beds) b.Beds[(int)bed] = SoundSynth.Loop(bed, 1 + (int)bed);
            return b;
        }

        AudioClip Clip(string name, float[] data)
        {
            var c = AudioClip.Create(name, data.Length, 1, SoundSynth.SampleRate, false);
            c.SetData(data, 0);
            _allClips.Add(c);
            return c;
        }

        AudioClip[] Clips(string name, float[][] data)
        {
            var r = new AudioClip[data.Length];
            for (int i = 0; i < data.Length; i++) r[i] = Clip(name + i, data[i]);
            return r;
        }

        void Finish(Bank b)
        {
            _steps = Clips("Step", b.Steps);
            _breaks = Clips("Break", b.Breaks);
            _hits = Clips("Hit", b.Hits);
            _places = Clips("Place", b.Places);
            _thunderNear = Clips("ThunderNear", b.ThunderNear);
            _thunderFar = Clips("ThunderFar", b.ThunderFar);
            _splash = Clips("Splash", b.Splash);
            _hurt = Clips("Hurt", b.Hurt);
            _pop = Clip("Pop", b.Pop);
            _click = Clip("Click", b.Click);

            _beds = new AudioSource[b.Beds.Length];
            for (int i = 0; i < b.Beds.Length; i++)
            {
                var go = new GameObject("Bed" + (SoundSynth.Bed)i);
                go.transform.SetParent(transform, false);
                var s = go.AddComponent<AudioSource>();
                s.clip = Clip("Bed" + (SoundSynth.Bed)i, b.Beds[i]);
                s.loop = true;
                s.spatialBlend = 0f;
                s.volume = 0f;
                s.time = (i * 1.7f) % s.clip.length;
                s.Play();
                _beds[i] = s;
            }
            _rainFilter = _beds[(int)SoundSynth.Bed.Rain].gameObject.AddComponent<AudioLowPassFilter>();
            _rainFilter.cutoffFrequency = 22000f;
            _ready = true;
        }

        void OnEnable()
        {
            if (interactor != null)
            {
                interactor.Broken += OnBroken;
                interactor.Placed += OnPlaced;
                interactor.MiningHit += OnHit;
            }
            if (items != null) items.PickedUp += OnPickedUp;
            if (survival != null) survival.Stats.Damaged += OnDamaged;
            if (player != null) player.Landed += OnLanded;
            if (weather != null) weather.Lightning += OnLightning;
        }

        void OnDisable()
        {
            if (interactor != null)
            {
                interactor.Broken -= OnBroken;
                interactor.Placed -= OnPlaced;
                interactor.MiningHit -= OnHit;
            }
            if (items != null) items.PickedUp -= OnPickedUp;
            if (survival != null) survival.Stats.Damaged -= OnDamaged;
            if (player != null) player.Landed -= OnLanded;
            if (weather != null) weather.Lightning -= OnLightning;
        }

        void OnDestroy()
        {
            if (Instance == this) Instance = null;
            foreach (var c in _allClips) if (c != null) Destroy(c);
        }

        // ------------------------------------------------------------------ events

        int Variant() => (_rng = (_rng * 1103515245 + 12345) & 0x7fffffff) % Variants;
        static int Index(ushort block, int variant) => (int)Surfaces.For(block) * Variants + variant;
        static Vector3 Centre(int3 cell) => (Vector3)(float3)cell + new Vector3(0.5f, 0.5f, 0.5f);

        void OnBroken(int3 cell, ushort block)
        {
            if (_ready) Play(_breaks[Index(block, Variant())], Centre(cell), 0.9f, UnityEngine.Random.Range(0.92f, 1.06f));
        }

        void OnPlaced(int3 cell, ushort block)
        {
            if (_ready) Play(_places[Index(block, Variant())], Centre(cell), 0.8f, UnityEngine.Random.Range(0.95f, 1.08f));
        }

        void OnHit(int3 cell, ushort block)
        {
            if (_ready) Play(_hits[Index(block, Variant())], Centre(cell), 0.55f, UnityEngine.Random.Range(0.95f, 1.1f));
        }

        void OnPickedUp(ushort item)
        {
            if (_ready) Play2D(_pop, 0.35f, UnityEngine.Random.Range(0.9f, 1.15f));
        }

        void OnDamaged(float amount, DamageCause cause)
        {
            if (_ready) Play2D(_hurt[Variant() % _hurt.Length], math.saturate(0.5f + amount * 0.1f), 1f);
        }

        void OnLanded(float height, bool water)
        {
            if (!_ready) return;
            if (water)
            {
                if (height > 1f) Play(_splash[Variant() % _splash.Length], player.Body.Position, math.saturate(0.3f + height * 0.08f), 1f);
                return;
            }
            if (height < 1.1f) return;
            ushort under = BlockUnder(player.Body.Position);
            if (under != BlockId.Air) Play(_steps[Index(under, Variant())], player.Body.Position, math.saturate(0.5f + height * 0.1f), 0.8f);
        }

        void OnLightning()
        {
            // most strikes are some way off: the sound arrives seconds later, darker and softer
            bool near = UnityEngine.Random.value < 0.3f;
            _thunder.Add((Time.time + (near ? UnityEngine.Random.Range(0.15f, 0.8f) : UnityEngine.Random.Range(1.5f, 4.5f)), near));
        }

        // ------------------------------------------------------------------ playback

        public void PlayUi()
        {
            if (_ready) Play2D(_click, 0.6f, 1f);
        }

        void Play(AudioClip clip, Vector3 at, float volume, float pitch)
        {
            var s = _pool[_nextVoice];
            _nextVoice = (_nextVoice + 1) % _pool.Length;
            s.transform.position = at;
            s.clip = clip;
            s.volume = volume * SettingsStore.Current.effectsVolume;
            s.pitch = pitch;
            s.Play();
        }

        void Play2D(AudioClip clip, float volume, float pitch)
        {
            _ui.pitch = pitch;
            _ui.PlayOneShot(clip, volume * SettingsStore.Current.effectsVolume);
        }

        ushort BlockUnder(float3 feet)
        {
            var c = (int3)math.floor(feet - new float3(0, 0.05f, 0));
            ushort b = world.GetBlockOrAir(c);
            if (b != BlockId.Air) return b;
            // on an edge: the body overhangs, so look at the neighbours it rests on
            for (int dx = -1; dx <= 1; dx++)
            for (int dz = -1; dz <= 1; dz++)
            {
                b = world.GetBlockOrAir(c + new int3(dx, 0, dz));
                if (BlockRegistry.Get(b).Has(BlockFlags.Solid)) return b;
            }
            return BlockId.Air;
        }

        // ------------------------------------------------------------------ frame

        void Update()
        {
            if (!_ready)
            {
                if (_building.IsCompleted)
                {
                    if (_building.IsFaulted) { Debug.LogException(_building.Exception); enabled = false; return; }
                    Finish(_building.Result);
                }
                else return;
            }

            for (int i = _thunder.Count - 1; i >= 0; i--)
            {
                if (Time.time < _thunder[i].at) continue;
                var set = _thunder[i].near ? _thunderNear : _thunderFar;
                Play2D(set[UnityEngine.Random.Range(0, set.Length)], _thunder[i].near ? 1f : 0.7f, UnityEngine.Random.Range(0.9f, 1.05f));
                _thunder.RemoveAt(i);
            }

            Footsteps();
            Ambience();
        }

        void Footsteps()
        {
            if (player == null || !player.Spawned) return;
            var feet = player.Body.Position;
            if (!_haveLastFeet) { _lastFeet = feet; _haveLastFeet = true; }
            float moved = math.length((feet - _lastFeet).xz);
            _lastFeet = feet;
            if (moved > 3f) return;   // teleport or respawn
            bool swimming = player.InWater && !player.Body.Grounded;
            if (player.Flying || (!player.Body.Grounded && !swimming)) { _stepAccum = stepDistance * 0.6f; return; }
            _stepAccum += moved;
            float stride = swimming ? stepDistance * 1.6f : player.Sprinting ? stepDistance * 1.25f : stepDistance;
            if (_stepAccum < stride) return;
            _stepAccum = 0f;
            ushort under = swimming ? BlockId.Water : BlockUnder(feet);
            if (under == BlockId.Air) return;
            if (player.InWater && !swimming) under = BlockId.Water;   // wading
            Play(_steps[Index(under, Variant())], feet, swimming ? 0.35f : 0.45f, UnityEngine.Random.Range(0.92f, 1.08f));
        }

        void Ambience()
        {
            float ambience = SettingsStore.Current.ambienceVolume;
            var p = weather != null ? weather.Model.Params : WeatherModel.Presets[0];
            float sun = dayNight != null ? dayNight.State.SunElevationDeg : 30f;
            float day = math.smoothstep(-2f, 8f, sun);
            float night = 1f - math.smoothstep(-10f, -3f, sun);

            float open = 1f, deep = 0f, altitude = 0.5f;
            bool underwater = false, covered = false;
            if (player != null && world != null && player.Spawned)
            {
                var eye = player.EyePosition;
                int? top = world.GetHeightmap((int)math.floor(eye.x), (int)math.floor(eye.z));
                float depth = top.HasValue ? top.Value + 1 - eye.y : 0f;
                covered = depth > 0f;
                deep = math.saturate((depth - 4f) / 10f);
                open = covered ? math.lerp(0.45f, 0f, deep) : 1f;
                altitude = math.saturate((eye.y - VoxelConstants.SeaLevel) / 90f);
                underwater = player.HeadInWater;
            }

            float rain = p.Precipitation * (weather != null && weather.Cold ? 0f : 1f);
            float wind = math.saturate(0.25f + p.WindStrength * 2.2f + altitude * 0.4f) * math.lerp(0.25f, 1f, open);
            float calm = math.saturate(1f - rain * 1.5f - p.WindStrength * 1.5f);

            float dry = underwater ? 0.12f : 1f;
            Set(SoundSynth.Bed.Wind, wind * 0.5f * dry);
            Set(SoundSynth.Bed.Rain, rain * math.lerp(0.35f, 0.8f, open) * (1f - deep) * dry);
            Set(SoundSynth.Bed.Birds, day * calm * open * (1f - altitude * 0.6f) * 0.45f * dry);
            Set(SoundSynth.Bed.Crickets, night * calm * open * 0.3f * dry);
            Set(SoundSynth.Bed.Cave, deep * 0.6f * dry);
            Set(SoundSynth.Bed.Underwater, underwater ? 0.7f : 0f);
            _rainFilter.cutoffFrequency = Mathf.MoveTowards(_rainFilter.cutoffFrequency, covered ? 1400f : 22000f, 40000f * Time.unscaledDeltaTime);

            void Set(SoundSynth.Bed bed, float target)
            {
                var s = _beds[(int)bed];
                s.volume = Mathf.MoveTowards(s.volume, target * ambience, 0.5f * Time.unscaledDeltaTime);
            }
        }
    }
}
