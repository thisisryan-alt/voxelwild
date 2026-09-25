using System.Collections.Generic;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.UIElements;
using Voxelwild.Gameplay;
using Voxelwild.Player;

namespace Voxelwild.UI
{
    /// <summary>
    /// The in-game HUD (UI Toolkit, built in code): crosshair and mining progress, the icon hotbar with counts and
    /// tool wear, health / hunger / breath in survival, toasts (held item, saved), the death screen, and the
    /// inventory screen (E or Tab) with crafting. In creative the inventory screen is a block palette.
    /// Styling follows the Voxelwild design system: square corners, black at 45% under white text, pale gold
    /// (#ffed99) as the only accent. The F3 developer overlay stays in DebugHud.
    /// </summary>
    [RequireComponent(typeof(UIDocument)), DefaultExecutionOrder(50)]   // after the player, so Esc closing the inventory isn't also read as "release the mouse"
    public sealed class GameHud : MonoBehaviour
    {
        [SerializeField] PlayerController player;
        [SerializeField] PlayerSurvival survival;
        [SerializeField] BlockInteractor interactor;
        [SerializeField] GameSession session;
        [SerializeField] ItemIcons icons;
        [SerializeField] Diagnostics.DebugHud debugHud;
        [SerializeField] World.VoxelWorld world;

        static readonly Color Panel = new Color(0f, 0f, 0f, 0.45f);
        static readonly Color PanelStrong = new Color(0f, 0f, 0f, 0.7f);
        static readonly Color Accent = new Color(1f, 0.93f, 0.6f);
        static readonly Color Edge = new Color(1f, 1f, 1f, 0.14f);
        static readonly Color HealthColor = new Color(0.88f, 0.29f, 0.24f);
        static readonly Color HungerColor = new Color(0.85f, 0.64f, 0.25f);
        static readonly Color AirColor = new Color(0.42f, 0.72f, 0.9f);

        sealed class SlotView
        {
            public VisualElement Root;
            public Image Icon;
            public Label Count;
            public VisualElement Wear;
            public int Slot;
        }

        VisualElement _root, _hud, _vitals, _mining, _miningFill, _death, _inventory, _recipes;
        VisualElement _health, _hunger, _air, _loading, _loadingFill;
        Label _loadingDetail;
        Label _toast, _mode, _saved, _deathText;
        readonly List<SlotView> _hotbar = new List<SlotView>();
        readonly List<SlotView> _grid = new List<SlotView>();
        int _pickedSlot = -1;
        int _lastSelected = -1;
        float _toastUntil, _savedUntil;
        bool _open, _dirty = true;

        public bool InventoryOpen => _open;

        void OnEnable()
        {
            _root = GetComponent<UIDocument>().rootVisualElement;
            Build();
            survival.Inventory.Changed += MarkDirty;
            if (session != null) session.Saved += OnSaved;
        }

        void OnDisable()
        {
            survival.Inventory.Changed -= MarkDirty;
            if (session != null) session.Saved -= OnSaved;
        }

        void MarkDirty() => _dirty = true;
        void OnSaved() => _savedUntil = Time.unscaledTime + 2f;

        // ------------------------------------------------------------------ layout

        void Build()
        {
            _root.Clear();
            _root.pickingMode = PickingMode.Ignore;
            _hud = Fill(new VisualElement());
            _hud.pickingMode = PickingMode.Ignore;
            _root.Add(_hud);

            // crosshair: two 2 px bars, 18 px long, white at 80%
            var cross = Centered(new VisualElement(), 18, 18);
            cross.Add(Box(0, 8, 18, 2, new Color(1, 1, 1, 0.8f)));
            cross.Add(Box(8, 0, 2, 18, new Color(1, 1, 1, 0.8f)));
            _hud.Add(cross);

            _mining = Centered(new VisualElement(), 64, 4);
            _mining.style.top = new Length(50, LengthUnit.Percent);
            _mining.style.marginTop = 18;
            _mining.style.backgroundColor = Panel;
            _miningFill = Box(0, 0, 0, 4, Accent);
            _mining.Add(_miningFill);
            _hud.Add(_mining);

            // hotbar: nine 56 px slots, 4 px apart, 16 px above the bottom edge
            var bar = new VisualElement();
            bar.style.position = Position.Absolute;
            bar.style.bottom = 16;
            bar.style.left = new Length(50, LengthUnit.Percent);
            bar.style.translate = new Translate(new Length(-50, LengthUnit.Percent), 0);
            bar.style.flexDirection = FlexDirection.Row;
            for (int i = 0; i < Inventory.HotbarSize; i++)
            {
                var v = MakeSlot(i, 56);
                if (i > 0) v.Root.style.marginLeft = 4;
                _hotbar.Add(v);
                bar.Add(v.Root);
            }
            _hud.Add(bar);

            // vitals above the hotbar: health left, hunger right, breath above hunger while under water
            _vitals = new VisualElement();
            _vitals.style.position = Position.Absolute;
            _vitals.style.bottom = 16 + 56 + 8;
            _vitals.style.left = new Length(50, LengthUnit.Percent);
            _vitals.style.width = 9 * 56 + 8 * 4;
            _vitals.style.translate = new Translate(new Length(-50, LengthUnit.Percent), 0);
            _vitals.style.height = 24;
            _health = Meter(HealthColor);
            _health.style.left = 0;
            _health.style.bottom = 0;
            _hunger = Meter(HungerColor);
            _hunger.style.right = 0;
            _hunger.style.bottom = 0;
            _air = Meter(AirColor);
            _air.style.right = 0;
            _air.style.bottom = 14;
            _vitals.Add(_health);
            _vitals.Add(_hunger);
            _vitals.Add(_air);
            _hud.Add(_vitals);

            _toast = HudLabel(14, true);
            _toast.style.bottom = 16 + 56 + 40;
            _toast.style.left = new Length(50, LengthUnit.Percent);
            _toast.style.translate = new Translate(new Length(-50, LengthUnit.Percent), 0);
            _hud.Add(_toast);

            _mode = HudLabel(12, false);
            _mode.style.top = 8;
            _mode.style.right = 8;
            _hud.Add(_mode);
            _saved = HudLabel(12, true);
            _saved.style.top = 28;
            _saved.style.right = 8;
            _saved.text = "Saved";
            _saved.style.color = Accent;
            _hud.Add(_saved);

            _death = Fill(new VisualElement());
            _death.style.backgroundColor = new Color(0.35f, 0f, 0f, 0.45f);
            _deathText = HudLabel(28, true);
            _deathText.text = "You died";
            _deathText.style.position = Position.Relative;
            _deathText.style.alignSelf = Align.Center;
            _death.style.justifyContent = Justify.Center;
            _death.Add(_deathText);
            _root.Add(_death);

            BuildInventory();
            BuildLoading();
        }

        void BuildLoading()
        {
            _loading = Fill(new VisualElement());
            _loading.style.backgroundColor = new Color(0.063f, 0.071f, 0.078f);
            _loading.style.justifyContent = Justify.Center;
            _loading.style.alignItems = Align.Center;
            var title = new Label("VOXELWILD");
            title.style.fontSize = 44;
            title.style.unityFontStyleAndWeight = FontStyle.Bold;
            title.style.color = Color.white;
            title.style.letterSpacing = 6;
            _loading.Add(title);
            var what = new Label(session != null && session.Persistent ? $"Loading {session.WorldName}" : "Generating world");
            what.style.color = new Color(1, 1, 1, 0.8f);
            what.style.fontSize = 16;
            what.style.marginTop = 12;
            _loading.Add(what);
            var bar = new VisualElement();
            bar.style.width = 320;
            bar.style.height = 4;
            bar.style.marginTop = 18;
            bar.style.backgroundColor = new Color(1, 1, 1, 0.12f);
            bar.style.overflow = Overflow.Hidden;
            _loadingFill = Box(0, 0, 80, 4, Accent);
            bar.Add(_loadingFill);
            _loading.Add(bar);
            _loadingDetail = new Label();
            _loadingDetail.style.color = new Color(1, 1, 1, 0.5f);
            _loadingDetail.style.fontSize = 12;
            _loadingDetail.style.marginTop = 8;
            _loading.Add(_loadingDetail);
            _root.Add(_loading);
        }

        void UpdateLoading()
        {
            bool loading = !player.Spawned;
            _loading.style.display = loading ? DisplayStyle.Flex : DisplayStyle.None;
            if (!loading) return;
            // indeterminate: an accent block sweeping across the track
            float t = Time.unscaledTime * 0.8f % 1f;
            _loadingFill.style.left = -80 + t * 400f;
            if (world != null) _loadingDetail.text = $"{world.LoadedColumns} columns ready";
        }

        void BuildInventory()
        {
            _inventory = Fill(new VisualElement());
            _inventory.style.backgroundColor = new Color(0, 0, 0, 0.35f);
            _inventory.style.justifyContent = Justify.Center;
            _inventory.style.alignItems = Align.Center;

            var window = new VisualElement();
            window.style.flexDirection = FlexDirection.Row;
            window.style.backgroundColor = PanelStrong;
            SetPadding(window, 16);

            var left = new VisualElement();
            left.Add(Title(survival.Creative ? "Blocks" : "Inventory"));
            var gridBox = new VisualElement();
            gridBox.style.width = 9 * 52 + 8 * 4;
            gridBox.style.flexDirection = FlexDirection.Row;
            gridBox.style.flexWrap = Wrap.Wrap;
            // backpack rows first, hotbar at the bottom, as players expect
            for (int row = 0; row < 4; row++)
            for (int col = 0; col < 9; col++)
            {
                int slot = row < 3 ? Inventory.HotbarSize + row * 9 + col : col;
                var v = MakeSlot(slot, 52);
                v.Root.style.marginRight = col < 8 ? 4 : 0;
                v.Root.style.marginBottom = row == 2 ? 14 : 4;
                int s = slot;
                v.Root.RegisterCallback<ClickEvent>(_ => OnSlotClicked(s));
                _grid.Add(v);
                gridBox.Add(v.Root);
            }
            left.Add(gridBox);
            var hint = HudLabel(12, false);
            hint.style.position = Position.Relative;
            hint.style.marginTop = 6;
            hint.text = "Click a slot, then another, to move or swap · E / Tab / Esc close";
            left.Add(hint);
            window.Add(left);

            var right = new VisualElement();
            right.style.marginLeft = 20;
            right.style.width = 300;
            right.Add(Title(survival.Creative ? "Palette" : "Crafting"));
            var scroll = new ScrollView();
            scroll.style.height = 4 * 56 + 20;
            _recipes = scroll.contentContainer;
            right.Add(scroll);
            window.Add(right);

            _inventory.Add(window);
            _inventory.style.display = DisplayStyle.None;
            _root.Add(_inventory);
        }

        void RebuildRecipes()
        {
            _recipes.Clear();
            if (survival.Creative)
            {
                foreach (var def in ItemRegistry.All)
                {
                    if (def.Kind != ItemKind.Block) continue;
                    ushort id = def.Id;
                    _recipes.Add(RecipeRow(id, def.Name, "click: put in the selected hotbar slot", true,
                        () => survival.Inventory[survival.Inventory.Selected] = ItemStack.Of(id, 64)));
                }
                return;
            }
            foreach (var r in Recipes.All)
            {
                var recipe = r;
                var parts = new List<string>();
                foreach (var (item, count) in r.Inputs) parts.Add($"{count} {ItemRegistry.Name(item)}");
                bool can = Recipes.CanCraft(survival.Inventory, recipe);
                string label = r.Output.Count > 1 ? $"{r.Output.Count} × {r.Name}" : r.Name;
                _recipes.Add(RecipeRow(r.Output.Item, label, string.Join(" + ", parts), can, () => Recipes.Craft(survival.Inventory, recipe)));
            }
        }

        VisualElement RecipeRow(ushort item, string title, string detail, bool enabled, System.Action action)
        {
            var row = new VisualElement();
            row.style.flexDirection = FlexDirection.Row;
            row.style.alignItems = Align.Center;
            row.style.marginBottom = 4;
            SetPadding(row, 4);
            row.style.backgroundColor = Panel;
            row.style.opacity = enabled ? 1f : 0.45f;
            var img = new Image { image = icons != null ? icons.Get(item) : null, scaleMode = ScaleMode.ScaleToFit };
            img.style.width = 32;
            img.style.height = 32;
            row.Add(img);
            var text = new VisualElement();
            text.style.marginLeft = 8;
            var t = new Label(title);
            t.style.color = enabled ? Accent : Color.white;
            t.style.unityFontStyleAndWeight = FontStyle.Bold;
            t.style.fontSize = 13;
            var d = new Label(detail);
            d.style.color = new Color(1, 1, 1, 0.8f);
            d.style.fontSize = 11;
            text.Add(t);
            text.Add(d);
            row.Add(text);
            if (enabled) row.RegisterCallback<ClickEvent>(_ => { action(); _dirty = true; });
            return row;
        }

        // ------------------------------------------------------------------ frame

        void Update()
        {
            var kb = Keyboard.current;
            if (kb != null && player.Spawned && (session == null || !session.Dead) && !PauseMenu.Paused)
            {
                if (kb.eKey.wasPressedThisFrame || kb.tabKey.wasPressedThisFrame) SetOpen(!_open);
                else if (_open && kb.escapeKey.wasPressedThisFrame) SetOpen(false);
            }

            int sel = survival.Inventory.Selected;
            if (sel != _lastSelected)
            {
                _lastSelected = sel;
                var held = survival.Inventory.Held;
                _toast.text = held.IsEmpty ? "" : ItemRegistry.Name(held.Item);
                _toastUntil = Time.unscaledTime + 2f;
                _dirty = true;
            }
            if (_dirty)
            {
                _dirty = false;
                foreach (var v in _hotbar) Refresh(v, v.Slot == sel);
                if (_open)
                {
                    foreach (var v in _grid) Refresh(v, v.Slot == _pickedSlot);
                    RebuildRecipes();
                }
            }

            bool hidden = debugHud != null && debugHud.Hidden;   // F1 and screenshot captures
            _root.style.display = hidden ? DisplayStyle.None : DisplayStyle.Flex;
            UpdateLoading();
            bool alive = session == null || !session.Dead;
            _hud.style.display = player.Spawned && alive ? DisplayStyle.Flex : DisplayStyle.None;
            _death.style.display = alive ? DisplayStyle.None : DisplayStyle.Flex;
            _vitals.style.display = survival.Creative ? DisplayStyle.None : DisplayStyle.Flex;
            SetMeter(_health, survival.Stats.Health / SurvivalStats.MaxHealth);
            SetMeter(_hunger, survival.Stats.Hunger / SurvivalStats.MaxHunger);
            _air.style.display = survival.Stats.Air < SurvivalStats.MaxAir - 0.01f ? DisplayStyle.Flex : DisplayStyle.None;
            SetMeter(_air, survival.Stats.Air / SurvivalStats.MaxAir);

            float p = interactor != null ? interactor.MiningProgress : 0f;
            _mining.style.display = p > 0f ? DisplayStyle.Flex : DisplayStyle.None;
            _miningFill.style.width = 64 * Mathf.Clamp01(p);

            _toast.style.opacity = Mathf.Clamp01((_toastUntil - Time.unscaledTime) / 0.5f);
            _saved.style.opacity = Mathf.Clamp01((_savedUntil - Time.unscaledTime) / 0.5f);
            _mode.text = (session != null && session.Persistent ? session.WorldName + " · " : "") + survival.Mode;
        }

        void SetOpen(bool open)
        {
            _open = open;
            _pickedSlot = -1;
            _inventory.style.display = open ? DisplayStyle.Flex : DisplayStyle.None;
            player.InputEnabled = !open;
            UnityEngine.Cursor.lockState = open ? CursorLockMode.None : CursorLockMode.Locked;
            UnityEngine.Cursor.visible = open;
            _dirty = true;
        }

        void OnSlotClicked(int slot)
        {
            if (_pickedSlot < 0)
            {
                if (!survival.Inventory[slot].IsEmpty) _pickedSlot = slot;
            }
            else
            {
                if (slot != _pickedSlot) survival.Inventory.Move(_pickedSlot, slot);
                _pickedSlot = -1;
            }
            _dirty = true;
        }

        void Refresh(SlotView v, bool highlight)
        {
            var stack = survival.Inventory[v.Slot];
            v.Icon.image = stack.IsEmpty || icons == null ? null : icons.Get(stack.Item);
            v.Count.text = !stack.IsEmpty && stack.Count > 1 && !survival.Creative ? stack.Count.ToString() : "";
            var def = ItemRegistry.Get(stack.Item);
            bool worn = !stack.IsEmpty && def.Kind == ItemKind.Tool && stack.Durability < def.Durability;
            v.Wear.style.display = worn ? DisplayStyle.Flex : DisplayStyle.None;
            if (worn)
            {
                float f = stack.Durability / (float)def.Durability;
                v.Wear.style.width = new Length(f * 100f, LengthUnit.Percent);
                v.Wear.style.backgroundColor = Color.Lerp(HealthColor, new Color(0.55f, 0.85f, 0.4f), f);
            }
            SetBorder(v.Root, highlight ? 2 : 1, highlight ? Accent : Edge);
        }

        // ------------------------------------------------------------------ helpers

        SlotView MakeSlot(int slot, float size)
        {
            var root = new VisualElement();
            root.style.width = size;
            root.style.height = size;
            root.style.backgroundColor = Panel;
            SetBorder(root, 1, Edge);
            var icon = new Image { scaleMode = ScaleMode.ScaleToFit };
            icon.style.position = Position.Absolute;
            icon.style.left = 6;
            icon.style.top = 6;
            icon.style.right = 6;
            icon.style.bottom = 6;
            icon.pickingMode = PickingMode.Ignore;
            root.Add(icon);
            var count = new Label();
            count.style.position = Position.Absolute;
            count.style.right = 4;
            count.style.bottom = 2;
            count.style.fontSize = 12;
            count.style.unityFontStyleAndWeight = FontStyle.Bold;
            count.style.color = Color.white;
            count.pickingMode = PickingMode.Ignore;
            root.Add(count);
            var wear = new VisualElement();
            wear.style.position = Position.Absolute;
            wear.style.left = 0;
            wear.style.bottom = 0;
            wear.style.height = 3;
            wear.pickingMode = PickingMode.Ignore;
            root.Add(wear);
            return new SlotView { Root = root, Icon = icon, Count = count, Wear = wear, Slot = slot };
        }

        static VisualElement Meter(Color color)
        {
            var m = new VisualElement();
            m.style.position = Position.Absolute;
            m.style.width = 238;
            m.style.height = 10;
            m.style.backgroundColor = Panel;
            var fill = new VisualElement();
            fill.style.height = 10;
            fill.style.backgroundColor = color;
            fill.name = "fill";
            m.Add(fill);
            // ten segments, like hearts
            for (int i = 1; i < 10; i++) m.Add(Box(i * 23.8f - 1, 0, 2, 10, new Color(0, 0, 0, 0.6f)));
            return m;
        }

        static void SetMeter(VisualElement m, float f) =>
            m.Q("fill").style.width = new Length(Mathf.Clamp01(f) * 100f, LengthUnit.Percent);

        static Label Title(string text)
        {
            var l = new Label(text);
            l.style.fontSize = 14;
            l.style.unityFontStyleAndWeight = FontStyle.Bold;
            l.style.color = Color.white;
            l.style.marginBottom = 8;
            return l;
        }

        static Label HudLabel(int size, bool bold)
        {
            var l = new Label();
            l.style.position = Position.Absolute;
            l.style.fontSize = size;
            l.style.color = Color.white;
            l.style.unityFontStyleAndWeight = bold ? FontStyle.Bold : FontStyle.Normal;
            l.style.backgroundColor = Panel;
            SetPadding(l, 4);
            l.pickingMode = PickingMode.Ignore;
            return l;
        }

        static VisualElement Fill(VisualElement e)
        {
            e.style.position = Position.Absolute;
            e.style.left = 0;
            e.style.top = 0;
            e.style.right = 0;
            e.style.bottom = 0;
            return e;
        }

        static VisualElement Centered(VisualElement e, float w, float h)
        {
            e.style.position = Position.Absolute;
            e.style.left = new Length(50, LengthUnit.Percent);
            e.style.top = new Length(50, LengthUnit.Percent);
            e.style.width = w;
            e.style.height = h;
            e.style.translate = new Translate(new Length(-50, LengthUnit.Percent), new Length(-50, LengthUnit.Percent));
            e.pickingMode = PickingMode.Ignore;
            return e;
        }

        static VisualElement Box(float x, float y, float w, float h, Color c)
        {
            var e = new VisualElement();
            e.style.position = Position.Absolute;
            e.style.left = x;
            e.style.top = y;
            e.style.width = w;
            e.style.height = h;
            e.style.backgroundColor = c;
            e.pickingMode = PickingMode.Ignore;
            return e;
        }

        static void SetBorder(VisualElement e, float w, Color c)
        {
            e.style.borderTopWidth = e.style.borderBottomWidth = e.style.borderLeftWidth = e.style.borderRightWidth = w;
            e.style.borderTopColor = e.style.borderBottomColor = e.style.borderLeftColor = e.style.borderRightColor = c;
        }

        static void SetPadding(VisualElement e, float p)
        {
            e.style.paddingTop = e.style.paddingBottom = e.style.paddingLeft = e.style.paddingRight = p;
        }
    }
}
