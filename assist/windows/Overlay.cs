using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Forms;
using System.Web.Script.Serialization;
using Rect = System.Windows.Rect;

internal static class Native {
    [DllImport("user32.dll")] internal static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] internal static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] internal static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    internal static extern int GetPackageFamilyName(IntPtr process, ref int length, StringBuilder family);
    [DllImport("user32.dll")] internal static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hgt, uint flags);

    internal static bool IsClaude(IntPtr window) {
        uint pid;
        GetWindowThreadProcessId(window, out pid);
        if (pid == 0) return false;
        try {
            using (var process = Process.GetProcessById((int)pid)) {
                if (!String.Equals(process.ProcessName, "Claude", StringComparison.OrdinalIgnoreCase)) return false;
                var family = new StringBuilder(128);
                var size = family.Capacity;
                return GetPackageFamilyName(process.Handle, ref size, family) == 0 &&
                    (family.ToString() == "Claude_pzs8sxrjxfjjc" || family.ToString() == "AnthropicPBC.Claude_fnn82j28hfe8t");
            }
        } catch (InvalidOperationException) { return false; }
          catch (ArgumentException) { return false; }
          catch (System.ComponentModel.Win32Exception) { return false; }
    }
}

internal sealed class Hint {
    internal Rect Bounds;
    internal Rect Owner;
    internal string Text;
    internal string English;
    internal bool Nav;
    internal bool Large;
    internal bool Menu;
}

internal sealed class Overlay : Form {
    static readonly Dictionary<string, string> Nav = new Dictionary<string, string>(StringComparer.Ordinal) {
        {"New","新建"}, {"Search","搜索"}, {"Routines","定时任务"}, {"Customize","自定义"},
        {"Projects","项目"}, {"Artifacts","产物"}, {"Scheduled tasks","定时任务"}, {"More","更多"}
    };
    static readonly HashSet<string> SetupNavigation = new HashSet<string>(StringComparer.Ordinal) {
        "Connection", "Capabilities", "Connectors", "Telemetry & updates", "Limits", "Appearance",
        "Plugins", "Egress", "Source"
    };
    static readonly Dictionary<string, string> SessionLabels = new Dictionary<string, string>(StringComparer.Ordinal) {
        {"Choose environment","选择环境"}, {"Environment: This computer","此计算机"},
        {"Files","文件"}, {"Browser","浏览器"}, {"Terminal","终端"},
        {"Prompt","描述一个任务或提问"}, {"Add","添加"}
    };
    static readonly Dictionary<string, string> MenuLabels = new Dictionary<string, string>(StringComparer.Ordinal) {
        {"File","文件"}, {"Edit","编辑"}, {"View","视图"}, {"Go","转到"}, {"Help","帮助"},
        {"View Changelog","更新日志"}, {"Troubleshooting","故障排查"}, {"Get Support","获取支持"},
        {"Usage Policy","使用政策"}, {"Privacy Policy","隐私政策"}, {"Commercial Terms","商业条款"},
        {"Claude Help","Claude 帮助"}, {"Keyboard Shortcuts","键盘快捷键"},
        {"Check for Updates…","检查更新"}, {"About Claude","关于 Claude"},
        {"New Session","新建会话"}, {"Close Window","关闭窗口"}, {"Settings","设置"},
        {"New Session in New Window","在新窗口中新建会话"}, {"New Side Chat","新建侧边会话"},
        {"Open File…","打开文件"}, {"Open Folder…","打开文件夹"},
        {"Copy","复制"}, {"Paste","粘贴"}, {"Cut","剪切"}, {"Select All","全选"},
        {"Undo","撤销"}, {"Redo","重做"}, {"Rename","重命名"}, {"Delete","删除"}, {"Archive","归档"},
        {"Open in","打开方式"}, {"Pin","置顶"}, {"Unpin","取消置顶"}, {"Mark as unread","标记为未读"},
        {"Mark as read","标记为已读"}, {"Fork","分叉"}, {"Move to section","移至分区"}, {"Move under","移到会话下"},
        {"File tree position","文件树位置"}, {"Collapse all folders","折叠所有文件夹"},
        {"File tree position Automatic","文件树位置：自动"}, {"File tree position Left","文件树位置：左侧"},
        {"File tree position Right","文件树位置：右侧"}, {"Go to file or search","转到文件或搜索"},
        {"Automatic","自动"}, {"Left","左侧"}, {"Right","右侧"},
        {"Preview tabs","预览标签页"}, {"Auto save","自动保存"}, {"Word wrap","自动换行"},
        {"Tab size","制表符宽度"}, {"Show file tree","显示文件树"},
        {"Show whitespace","显示空白字符"}, {"Indent guides","缩进参考线"},
        {"Indentation guides","缩进参考线"}, {"Allow scrolling past last line","允许滚动超过末行"},
        {"Tab key indents","Tab 键缩进"}
    };
    readonly NotifyIcon tray;
    readonly System.Windows.Forms.Timer timer;
    readonly Font font = new Font("Microsoft YaHei UI", 10, FontStyle.Regular, GraphicsUnit.Point);
    readonly Dictionary<string, string> inferenceLabels;
    Hint[] hints = new Hint[0];
    volatile bool paused;
    int busy;
    IntPtr active;
    bool activeClaude;
    int generation;
    Rectangle viewport;
    Point lastCursor;

    internal Overlay(Dictionary<string, string> inferenceLabels) {
        this.inferenceLabels = inferenceLabels;
        ShowInTaskbar = false;
        FormBorderStyle = FormBorderStyle.None;
        BackColor = Color.Magenta;
        TransparencyKey = BackColor;
        DoubleBuffered = true;
        StartPosition = FormStartPosition.Manual;
        Text = "Claude 中文界面提示";
        var entries = new ContextMenuStrip();
        var pause = entries.Items.Add("暂停中文提示");
        pause.Click += delegate { paused = !paused; pause.Text = paused ? "恢复中文提示" : "暂停中文提示"; Hide(); };
        entries.Items.Add("退出", null, delegate { Close(); });
        tray = new NotifyIcon { Icon = SystemIcons.Information, Text = Text, ContextMenuStrip = entries, Visible = true };
        timer = new System.Windows.Forms.Timer { Interval = 320 };
        timer.Tick += (sender, e) => RefreshTarget();
    }
    protected override bool ShowWithoutActivation { get { return true; } }
    protected override CreateParams CreateParams {
        get { var p = base.CreateParams; p.ExStyle |= 0x80000 | 0x20 | 0x08000000 | 0x80; return p; }
    }
    protected override void WndProc(ref Message message) {
        if (message.Msg == 0x84) { message.Result = new IntPtr(-1); return; }
        base.WndProc(ref message);
    }
    internal void Start() { var ignored = Handle; timer.Start(); }

    void RefreshTarget() {
        var foreground = Native.GetForegroundWindow();
        if (foreground != active) {
            Hide();
            active = foreground;
            activeClaude = Native.IsClaude(active);
            generation++;
        }
        if (paused || !activeClaude) { Hide(); return; }
        var cursor = Cursor.Position;
        if (Visible && cursor != lastCursor) Invalidate();
        lastCursor = cursor;
        if (Interlocked.Exchange(ref busy, 1) == 1) return;
        var target = active;
        int current = generation;
        ThreadPool.QueueUserWorkItem(delegate {
            try {
                var value = Collect(AutomationElement.FromHandle(target));
                BeginInvoke((Action)delegate {
                    if (current != generation || Native.GetForegroundWindow() != target || paused) return;
                    PaintHints(value);
                });
            } catch (ElementNotAvailableException) { ClearStale(target); }
              catch (InvalidOperationException) { ClearStale(target); }
              catch (COMException) { ClearStale(target); }
            finally { Interlocked.Exchange(ref busy, 0); }
        });
    }

    void ClearStale(IntPtr target) {
        try { BeginInvoke((Action)delegate { if (active == target) Hide(); }); }
        catch (InvalidOperationException) { }
    }

    static string AppRoute(AutomationElement window) {
        var document = window.FindFirst(TreeScope.Descendants, new AndCondition(
            new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Document),
            new PropertyCondition(AutomationElement.AutomationIdProperty, "RootWebArea")));
        object pattern;
        Uri uri;
        if (document == null || !document.TryGetCurrentPattern(ValuePattern.Pattern, out pattern) ||
            !Uri.TryCreate(((ValuePattern)pattern).Current.Value, UriKind.Absolute, out uri) ||
            uri.Scheme != "app" || uri.Host != "localhost") return "";
        return uri.AbsolutePath;
    }

    static Condition NamedControls(ControlType role, IEnumerable<string> names) {
        return new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty, role),
            new OrCondition(names.Select(name => (Condition)new PropertyCondition(AutomationElement.NameProperty, name)).ToArray()));
    }

    static bool IsInMenu(AutomationElement element) {
        var node = TreeWalker.ControlViewWalker.GetParent(element);
        for (int depth = 0; node != null && depth < 8; depth++) {
            var role = node.Current.ControlType;
            if (role == ControlType.Menu || role == ControlType.MenuBar) return true;
            if (role == ControlType.Document || role == ControlType.Window) return false;
            node = TreeWalker.ControlViewWalker.GetParent(node);
        }
        return false;
    }

    static string MenuTranslation(string name) {
        name = Regex.Replace(name, @"\s+(?:Ctrl\+|Alt\+|Shift\+|F[0-9]{1,2}$).*$", "");
        var size = Regex.Match(name, @"^Tab size (\d+)$");
        if (size.Success) return "制表符宽度 " + size.Groups[1].Value;
        string text;
        return MenuLabels.TryGetValue(name, out text) ? text : null;
    }

    Hint[] Collect(AutomationElement window) {
        var labels = new List<Hint>();
        string route = AppRoute(window);
        bool setup = route == "/setup-desktop-3p";
        bool main = route.StartsWith("/epitaxy", StringComparison.Ordinal) ||
            route.StartsWith("/cowork", StringComparison.Ordinal) || route.StartsWith("/chat", StringComparison.Ordinal);
        var roles = new List<Condition> { new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.MenuItem) };
        if (main) {
            roles.Add(NamedControls(ControlType.Button, Nav.Keys.Concat(SessionLabels.Keys)));
            roles.Add(NamedControls(ControlType.Text, new[] { "Navigation", "New session" }));
            roles.Add(new AndCondition(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit),
                new PropertyCondition(AutomationElement.NameProperty, "Prompt")));
            roles.Add(NamedControls(ControlType.CheckBox, MenuLabels.Keys));
        }
        if (setup) {
            roles.Add(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button));
            roles.Add(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Text));
            roles.Add(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.ListItem));
            roles.Add(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.RadioButton));
            roles.Add(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Hyperlink));
        }
        var cache = new CacheRequest();
        cache.Add(AutomationElement.NameProperty);
        cache.Add(AutomationElement.ControlTypeProperty);
        cache.Add(AutomationElement.BoundingRectangleProperty);
        cache.Add(AutomationElement.IsOffscreenProperty);
        using (cache.Activate()) {
            var filter = roles.Count == 1 ? roles[0] : new OrCondition(roles.ToArray());
            var nodes = window.FindAll(TreeScope.Descendants, filter);
            var navigation = main ? nodes.Cast<AutomationElement>().FirstOrDefault(
                n => n.Cached.ControlType == ControlType.Text && n.Cached.Name == "Navigation") : null;
            Rect side = Rect.Empty;
            if (navigation != null) {
                var parent = TreeWalker.ControlViewWalker.GetParent(navigation);
                while (parent != null && parent.Current.Name != "Sidebar") parent = TreeWalker.ControlViewWalker.GetParent(parent);
                if (parent != null) side = parent.Current.BoundingRectangle;
            }
            double start = navigation == null ? Double.PositiveInfinity : navigation.Cached.BoundingRectangle.Y;
            var rect = window.Current.BoundingRectangle;
            foreach (AutomationElement node in nodes) {
                var data = node.Cached;
                var area = data.BoundingRectangle;
                if (data.IsOffscreen || area.IsEmpty || area.Width < 20 || area.Height < 8) continue;
                string text;
                string name = Regex.Replace(data.Name ?? "", @"\s+", " ").Trim();
                if (setup && inferenceLabels.TryGetValue(name, out text)) {
                    bool nav = data.ControlType == ControlType.Button && SetupNavigation.Contains(name) && area.Left < rect.X + rect.Width / 3;
                    labels.Add(new Hint {Bounds=area, Owner=rect, Text=text, English=name, Nav=nav,
                        Large=name.Length >= 42 || text.Length >= 36 || data.ControlType == ControlType.ListItem});
                } else if ((main || route.Length == 0) &&
                    (data.ControlType == ControlType.MenuItem || data.ControlType == ControlType.CheckBox && IsInMenu(node))) {
                    text = MenuTranslation(name);
                    if (text != null) labels.Add(new Hint {Bounds=area, Owner=rect, Text=text, English=name, Menu=true});
                } else if (!side.IsEmpty && side.Contains(area) && area.Y >= start && area.Y < start + 180 &&
                    data.ControlType == ControlType.Button && Nav.TryGetValue(data.Name, out text)) {
                    labels.Add(new Hint {Bounds=area, Owner=rect, Text=text, English=name, Nav=true});
                } else if (main && data.ControlType == ControlType.Text && area.Y < rect.Y + 40 && name == "New session") {
                    labels.Add(new Hint {Bounds=area, Owner=rect, Text="新建会话", English=name});
                } else if (main && (data.ControlType == ControlType.Button && name != "Prompt" ||
                    data.ControlType == ControlType.Edit && name == "Prompt") &&
                    !side.IsEmpty && area.Left >= side.Right && SessionLabels.TryGetValue(name, out text)) {
                    labels.Add(new Hint {Bounds=area, Owner=rect, Text=text, English=name, Large=true});
                }
            }
        }
        return labels.GroupBy(hint => new { hint.Bounds, hint.Text }).Select(group => group.First()).Take(100).ToArray();
    }

    void PaintHints(Hint[] value) {
        if (value.Length == 0) { Hide(); return; }
        var screen = SystemInformation.VirtualScreen;
        if (Visible && viewport == screen && value.Length == hints.Length &&
            !value.Where((hint,i) => hint.Bounds != hints[i].Bounds || hint.Owner != hints[i].Owner ||
                hint.Text != hints[i].Text || hint.English != hints[i].English).Any()) return;
        hints = value;
        viewport = screen;
        if (!Visible) Show();
        Native.SetWindowPos(Handle, new IntPtr(-1), viewport.X, viewport.Y, viewport.Width, viewport.Height, 0x10 | 0x40);
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e) {
        base.OnPaint(e);
        var cursor = Cursor.Position;
        using (var background = new SolidBrush(Color.FromArgb(21,40,59))) {
            var drawn = new List<Rectangle>();
            var hover = new List<Hint>(hints.Where(h => h.Large));
            foreach (var hint in hints.Where(h => !h.Large)) {
                var r = hint.Bounds;
                var size = TextRenderer.MeasureText(e.Graphics, hint.Text, font, new Size(800, 80), TextFormatFlags.NoPadding);
                var original = TextRenderer.MeasureText(e.Graphics, hint.English, font, new Size(800, 80), TextFormatFlags.NoPadding);
                var owner = new Rectangle((int)hint.Owner.X - viewport.X, (int)hint.Owner.Y - viewport.Y,
                    (int)hint.Owner.Width, (int)hint.Owner.Height);
                int x = (int)(r.Left + Math.Min(r.Width, original.Width * 1.28) + 12) - viewport.X;
                if (hint.Nav) x = (int)r.Right - size.Width - 16 - viewport.X;
                if (hint.Menu) {
                    x = (int)r.Right + 8 - viewport.X;
                    if (x + size.Width + 10 > owner.Right) x = (int)r.Left - size.Width - 17 - viewport.X;
                }
                int y = (int)(r.Y + (r.Height - size.Height) / 2) - viewport.Y;
                var box = new Rectangle(x, y, size.Width + 10, size.Height + 2);
                if ((hint.Nav && x < r.Left + original.Width + 16 - viewport.X) ||
                    !owner.Contains(box) || drawn.Any(r2 => r2.IntersectsWith(box))) {
                    hover.Add(hint);
                    continue;
                }
                drawn.Add(box);
                e.Graphics.FillRectangle(background, box);
                TextRenderer.DrawText(e.Graphics, hint.Text, font, new Point(box.X + 5, box.Y + 1),
                    Color.FromArgb(219,235,248), TextFormatFlags.NoPadding | TextFormatFlags.NoPrefix);
            }
            bool menuOpen = hints.Any(h => h.Menu);
            var large = hover.Where(h => (!menuOpen || h.Menu) && h.Bounds.Contains(cursor.X,cursor.Y) && h.Owner.Contains(cursor.X,cursor.Y))
                .OrderBy(h => h.Bounds.Width * h.Bounds.Height).FirstOrDefault();
            if (large != null && large.Owner.Width >= 80 && large.Owner.Height >= 45) {
                var flags = TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix;
                var measured = TextRenderer.MeasureText(e.Graphics, large.Text, font,
                    new Size((int)Math.Min(420, large.Owner.Width - 30), 400), flags);
                int width = measured.Width + 16, height = measured.Height + 12;
                var x = Math.Min((int)large.Owner.Right - viewport.X - width - 8, cursor.X - viewport.X + 20);
                var y = Math.Min((int)large.Owner.Bottom - viewport.Y - height - 8, cursor.Y - viewport.Y + 28);
                var box = new Rectangle(Math.Max((int)large.Owner.Left - viewport.X + 8,x),
                    Math.Max((int)large.Owner.Top - viewport.Y + 8,y), width, height);
                e.Graphics.FillRectangle(background, box);
                box.Inflate(-7,-5);
                TextRenderer.DrawText(e.Graphics, large.Text, font, box, Color.FromArgb(219,235,248), flags);
            }
        }
    }
    protected override void Dispose(bool disposing) {
        if (disposing) { timer.Stop(); timer.Dispose(); tray.Dispose(); font.Dispose(); }
        base.Dispose(disposing);
    }

    [STAThread]
    static int Main() {
        using (var single = new Mutex(false,"Local\\ClaudeChineseHints")) {
            try { if (!single.WaitOne(0)) return 2; }
            catch (AbandonedMutexException) { }
            string profile = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "inference-profile.json");
            var labels = new JavaScriptSerializer().Deserialize<Dictionary<string,string>>(File.ReadAllText(profile));
            Native.SetProcessDpiAwarenessContext(new IntPtr(-4));
            Application.EnableVisualStyles();
            using (var overlay = new Overlay(labels)) {
                overlay.FormClosed += (sender,e) => Application.ExitThread();
                overlay.Start();
                Application.Run();
            }
            return 0;
        }
    }
}
