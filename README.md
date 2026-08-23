# Claude-Chinese (Claude 桌面端自愈型中文汉化工具包)

> 🚀 **High-performance, Non-invasive, Self-healing Chinese Localization Toolkit for Claude Desktop clients (Windows MSIX / Win32 / macOS).**

`claude-chinese` 是为 Anthropic **Claude 桌面客户端 (Claude Desktop)** 量身定制的工业级中文本地化工具包。借鉴了 **`antigravity-chinese`** 的核心架构，完美解决官方版本频繁更新、MSIX 权限封锁、动态占位符破损以及第三方模型路由（如 **CC Switch + DeepSeek** 下的 `cowork + code` 混合模式）的汉化与自愈需求。

---

## ✨ 核心特性

- 🛡️ **非侵入式架构 (Non-invasive)**：无需逆向解包 `app.asar`，直接基于官方 i18n 资源体系挂载，零性能损耗，零白屏风险。
- 🧬 **自愈与抗漂移 (Self-healing & Drift-resistant)**：内置上游版本漂移检测器 (`scan:drift`)，官方发版更新后秒级检测新增与废弃词条。
- 🎯 **100% 官方 HashKey 覆盖**：覆盖全量 550+ 官方词条（包含完整的 Cowork 协同画布、权限审批流、Claude Code 与设置面板）。
- 🔒 **严格的 ICU 语法与 AST 变量防火墙**：严格防护 `{count, plural...}`, `{apps}`, `{folderName}` 等变量插值与专有名词（`MCP`, `Artifacts`, `DeepSeek`, `API` 等），确保任务流执行永不卡死。
- 🪟 **MSIX / WindowsApps 专属适配**：深度适配 Windows MSIX 旁加载版本，提供自动提权夺权注入与静默自愈启动器。

---

## 🚀 快速开始

### 方式 1：Windows 双击一键安装（推荐）

1. 下载或克隆本项目至本地：
   ```bash
   git clone https://github.com/your-username/claude-chinese.git
   cd claude-chinese
   ```
2. 右键以管理员身份运行 **`install.bat`**；
3. 重启 Claude 桌面客户端，即可享受纯正简体中文界面！

### 方式 2：CLI 命令行交互

```bash
# 检查当前客户端与汉化状态
node cli.js status

# 一键安装汉化补丁
node cli.js install

# 还原官方英文原版
node cli.js restore

# 自愈式启动（自动检查补丁并在需要时静默修复）
node cli.js launch
```

---

## 🛠️ 上游版本漂移检测 (Drift Detection)

当官方 Claude Desktop 发布了新版本时，仅需一行命令即可分析版本变动：

```bash
npm run scan:drift
```

* 自动输出报告：`官方词条总量`、`汉化覆盖率`、`新增词条列表`、`废弃陈旧词条`；
* 详细报告将保存在 `tools/drift-report.json`。

---

## 🧪 自动化测试套件

本仓库包含严苛的自动化测试断言，确保词库结构完整、ICU 变量 100% 一致：

```bash
npm test
```

- `test/verify-dict.js`：550+ 核心词条完整性与非空断言；
- `test/test-icu.js`：ICU 占位符结构对称性与专有名词防护断言。

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。
