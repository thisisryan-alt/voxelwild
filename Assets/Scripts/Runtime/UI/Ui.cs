using System;
using UnityEngine;
using UnityEngine.UIElements;
using Voxelwild.Audio;

namespace Voxelwild.UI
{
    /// <summary>
    /// Shared UI Toolkit building blocks in the Voxelwild style: square corners, black panels at 45–80% under
    /// white text, a one-pixel white edge at 14%, and pale gold (#ffed99) as the only accent (hover, focus,
    /// selection). Everything is styled inline so no USS has to be kept in sync with code.
    /// </summary>
    public static class Ui
    {
        public static readonly Color Panel = new Color(0f, 0f, 0f, 0.45f);
        public static readonly Color PanelStrong = new Color(0f, 0f, 0f, 0.8f);
        public static readonly Color Accent = new Color(1f, 0.93f, 0.6f);
        public static readonly Color Edge = new Color(1f, 1f, 1f, 0.14f);
        public static readonly Color Muted = new Color(1f, 1f, 1f, 0.6f);
        public static readonly Color Danger = new Color(0.88f, 0.29f, 0.24f);

        public static VisualElement Fill(VisualElement e)
        {
            e.style.position = Position.Absolute;
            e.style.left = 0;
            e.style.top = 0;
            e.style.right = 0;
            e.style.bottom = 0;
            return e;
        }

        /// <summary>A centred window column.</summary>
        public static VisualElement Window(float width)
        {
            var w = new VisualElement();
            w.style.width = width;
            w.style.backgroundColor = PanelStrong;
            Padding(w, 24);
            Border(w, 1, Edge);
            return w;
        }

        public static Label Title(string text, int size = 22)
        {
            var l = new Label(text);
            l.style.fontSize = size;
            l.style.unityFontStyleAndWeight = FontStyle.Bold;
            l.style.color = Color.white;
            l.style.marginBottom = 14;
            return l;
        }

        public static Label Text(string text, int size = 13, Color? color = null)
        {
            var l = new Label(text);
            l.style.fontSize = size;
            l.style.color = color ?? Muted;
            l.style.whiteSpace = WhiteSpace.Normal;
            return l;
        }

        /// <summary>A flat button with a gold edge on hover; clicks play the UI sound.</summary>
        public static Button Button(string text, Action onClick, bool primary = false, Color? fill = null)
        {
            var b = new Button(() => { GameAudio.Instance?.PlayUi(); onClick(); }) { text = text };
            b.style.height = 40;
            b.style.marginLeft = b.style.marginRight = 0;
            b.style.marginTop = 0;
            b.style.marginBottom = 8;
            b.style.fontSize = 15;
            b.style.unityFontStyleAndWeight = primary ? FontStyle.Bold : FontStyle.Normal;
            b.style.color = primary ? Color.black : Color.white;
            var normal = fill ?? (primary ? Accent : Panel);
            b.style.backgroundColor = normal;
            b.style.borderTopLeftRadius = b.style.borderTopRightRadius = b.style.borderBottomLeftRadius = b.style.borderBottomRightRadius = 0;
            Border(b, 1, primary ? Accent : Edge);
            b.RegisterCallback<MouseEnterEvent>(_ =>
            {
                Border(b, 1, Accent);
                if (!primary) b.style.backgroundColor = new Color(1f, 1f, 1f, 0.08f);
            });
            b.RegisterCallback<MouseLeaveEvent>(_ =>
            {
                Border(b, 1, primary ? Accent : Edge);
                b.style.backgroundColor = normal;
            });
            return b;
        }

        public static void Enable(Button b, bool on)
        {
            b.SetEnabled(on);
            b.style.opacity = on ? 1f : 0.4f;
        }

        public static Slider Slider(string label, float low, float high, float value, Action<float> changed)
        {
            var s = new Slider(label, low, high) { value = value };
            StyleField(s);
            s.RegisterValueChangedCallback(e => changed(e.newValue));
            return s;
        }

        public static Toggle Toggle(string label, bool value, Action<bool> changed)
        {
            var t = new Toggle(label) { value = value };
            StyleField(t);
            t.RegisterValueChangedCallback(e => { GameAudio.Instance?.PlayUi(); changed(e.newValue); });
            return t;
        }

        public static TextField Field(string label, string value, int maxLength)
        {
            var f = new TextField(label) { value = value, maxLength = maxLength };
            StyleField(f);
            return f;
        }

        /// <summary>A row with a label and a ◀ value ▶ chooser.</summary>
        public static VisualElement Chooser(string label, Func<string> current, Action<int> step)
        {
            var row = new VisualElement();
            row.style.flexDirection = FlexDirection.Row;
            row.style.alignItems = Align.Center;
            row.style.marginBottom = 8;
            var l = Text(label, 14, Color.white);
            l.style.width = 180;
            row.Add(l);
            var value = Text(current(), 14, Accent);
            value.style.width = 140;
            value.style.unityTextAlign = TextAnchor.MiddleCenter;
            var prev = SmallButton("◀", () => { step(-1); value.text = current(); });
            var next = SmallButton("▶", () => { step(1); value.text = current(); });
            row.Add(prev);
            row.Add(value);
            row.Add(next);
            return row;
        }

        static Button SmallButton(string text, Action onClick)
        {
            var b = Button(text, onClick);
            b.style.width = 36;
            b.style.height = 30;
            b.style.marginBottom = 0;
            return b;
        }

        static void StyleField(VisualElement f)
        {
            f.style.marginBottom = 10;
            f.style.marginLeft = f.style.marginRight = 0;
            var label = f.Q<Label>();
            if (label != null)
            {
                label.style.color = Color.white;
                label.style.fontSize = 14;
                label.style.minWidth = 180;
            }
        }

        public static void Border(VisualElement e, float w, Color c)
        {
            e.style.borderTopWidth = e.style.borderBottomWidth = e.style.borderLeftWidth = e.style.borderRightWidth = w;
            e.style.borderTopColor = e.style.borderBottomColor = e.style.borderLeftColor = e.style.borderRightColor = c;
        }

        public static void Padding(VisualElement e, float p)
        {
            e.style.paddingTop = e.style.paddingBottom = e.style.paddingLeft = e.style.paddingRight = p;
        }
    }
}
