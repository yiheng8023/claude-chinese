$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding
$request = [Console]::In.ReadToEnd() | ConvertFrom-Json
# WScript.Shell.Save converts the filename through the system ANSI code page.
# Use the native Unicode interfaces for both link properties and persistence.
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
class ClaudeShellLink { }

[ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IClaudeShellLinkW {
    void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder value, int capacity, IntPtr findData, uint flags);
    void GetIDList(out IntPtr value);
    void SetIDList(IntPtr value);
    void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder value, int capacity);
    void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string value);
    void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder value, int capacity);
    void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string value);
    void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder value, int capacity);
    void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string value);
    void GetHotkey(out short value);
    void SetHotkey(short value);
    void GetShowCmd(out int value);
    void SetShowCmd(int value);
    void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder value, int capacity, out int index);
    void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string value, int index);
    void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string value, uint reserved);
    void Resolve(IntPtr window, uint flags);
    void SetPath([MarshalAs(UnmanagedType.LPWStr)] string value);
}

public static class ClaudeShortcut {
    public static string[] Read(string output) {
        object instance = new ClaudeShellLink();
        try {
            ((IPersistFile)instance).Load(output, 0);
            var link = (IClaudeShellLinkW)instance;
            var target = new StringBuilder(32768);
            var arguments = new StringBuilder(32768);
            var directory = new StringBuilder(32768);
            var icon = new StringBuilder(32768);
            int iconIndex;
            link.GetPath(target, target.Capacity, IntPtr.Zero, 4);
            link.GetArguments(arguments, arguments.Capacity);
            link.GetWorkingDirectory(directory, directory.Capacity);
            link.GetIconLocation(icon, icon.Capacity, out iconIndex);
            return new[] { target.ToString(), arguments.ToString(), directory.ToString(), icon.ToString(), iconIndex.ToString() };
        } finally { Marshal.FinalReleaseComObject(instance); }
    }

    public static string[] Save(string output, string target, string directory, bool backupEnabled) {
        object instance = new ClaudeShellLink();
        try {
            var file = (IPersistFile)instance;
            if (File.Exists(output)) {
                file.Load(output, 0);
                string backup = output + ".before-claude-chinese.bak";
                if (backupEnabled && !File.Exists(backup)) File.Copy(output, backup, false);
            }
            var link = (IClaudeShellLinkW)instance;
            if (File.Exists(output)) {
                var icon = new StringBuilder(32768);
                int iconIndex;
                link.GetIconLocation(icon, icon.Capacity, out iconIndex);
                if (icon.Length == 0) {
                    var originalTarget = new StringBuilder(32768);
                    link.GetPath(originalTarget, originalTarget.Capacity, IntPtr.Zero, 4);
                    string originalPath = originalTarget.ToString();
                    if (String.Equals(Path.GetExtension(originalPath), ".exe", StringComparison.OrdinalIgnoreCase) && File.Exists(originalPath))
                        link.SetIconLocation(originalPath, 0);
                }
            }
            link.SetPath(target);
            link.SetArguments("");
            link.SetWorkingDirectory(directory);
            link.SetDescription("Claude 中文启动器：检测待注册更新并按需重新汉化");
            file.Save(output, true);
        } finally { Marshal.FinalReleaseComObject(instance); }
        var saved = Read(output);
        if (!String.Equals(saved[0], target, StringComparison.OrdinalIgnoreCase) || saved[1] != "" ||
            !String.Equals(saved[2], directory, StringComparison.OrdinalIgnoreCase))
            throw new IOException("快捷方式保存后校验失败。");
        return saved;
    }
}
'@
$saved = [ClaudeShortcut]::Save($request.output, $request.target, $request.root, $request.backup -ne $false)
@{output=$request.output;target=$saved[0];workingDirectory=$saved[2];iconPath=$saved[3];iconIndex=$saved[4]} | ConvertTo-Json -Compress
