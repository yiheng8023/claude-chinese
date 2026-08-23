# Claude 桌面端自愈型中文汉化工具包 (Claude Chinese Toolkit)

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

专为 Anthropic **Claude Desktop** 桌面客户端（Windows MSIX / Win32 / macOS / Linux）打造的高性能、非侵入式中文本地化工具包。效仿并对齐 **`antigravity-chinese`** 的工业级自愈工程体系，完美解决官方版本频繁更新、MSIX 权限封锁、动态占位符破损以及第三方模型路由（如 **CC Switch + DeepSeek** 下的 `cowork + code` 混合模式）的汉化与自愈需求。

---

## 🌟 核心特性与设计哲学

- 🛡️ **非侵入式双层注入 (Non-invasive Dual-Layer)**：无需对主程序核心二进制进行暴力开膛，直接基于官方 i18n 资源体系（`Shell 壳层` + `Ion-Dist Web UI`）与前端 JS 语言白名单进行无损挂载。
- 🧬 **自愈与抗漂移 (Self-Healing & Drift-Resistant)**：内置版本漂移检测引擎 (`npm run scan:drift`)，官方发版更新后秒级检测新增与废弃词条，彻底终结更新后满世界找新补丁的痛点。
- 🎯 **全量 HashKey 界面覆盖**：覆盖全量 18,900+ 核心词条（包含完整的 Cowork 协同画布、权限审批流、Claude Code 模式、模型规格选择器与设置面板）。
- 🔒 **严格的 ICU 语法与 AST 变量防火墙**：严格防护 `{count, plural...}`, `{apps}`, `{folderName}` 等变量插值与规格参数（如 `1M`, `128k`, `MCP`, `DeepSeek` 等），确保任务流执行永不卡死。
- 🪟 **MSIX / WindowsApps 专属适配**：深度适配 Windows MSIX 旁加载版本，提供自动提权夺权注入与静默自愈启动器。

---

## 📋 前置环境与要求 (Prerequisites)

1. **操作系统支持**：
   - **Windows**：Windows 10 / 11 (x64)（支持官方 MSIX 旁加载版与标准版）
   - **macOS**：macOS 12+（Apple Silicon M 系列及 Intel 芯片）
   - **Linux**：主流发行版（x64 / ARM64）
2. **Node.js 基础运行环境**：
   - 系统中需安装 **Node.js (>= 16.x)** 及附带的 **npm**。
   - 验证方式：在终端运行 `node -v`。若未安装，请前往 [Node.js 官方网站](https://nodejs.org/) 下载安装 LTS 版本。
3. **已安装 Claude Desktop 客户端**：
   - 确保本机已安装官方 Claude 桌面客户端。

---

## 🚀 快速开始

### 方式一：一键脚本（推荐日常使用）

#### Windows
* **一键安装**：右键以管理员身份运行 [`install.bat`](install.bat)
* **自愈启动**：双击运行 [`launch.bat`](launch.bat)（自动检测版本覆盖并重新注入后启动）
* **恢复英文**：双击运行 [`uninstall.bat`](uninstall.bat)

#### macOS / Linux
* **一键安装**：在终端运行 `./install.sh`
* **恢复英文**：在终端运行 `./uninstall.sh`

---

### 方式二：CLI 命令行管理器

```bash
# 1. 查看当前客户端及汉化状态
node cli.js status

# 2. 一键安装汉化（自动备份并完成双层注入与 JS 注册）
node cli.js install

# 3. 自愈启动（自动检测版本覆盖并在需要时秒级自愈挂载）
node cli.js launch

# 4. 执行上游版本文本漂移分析 (Drift Detection)
node cli.js drift

# 5. 一键还原回官方英文原版
node cli.js restore
```

---

## 🧪 自动化测试与质量保证 (Testing & Verification)

本项目引入严格的端到端自动化测试与全维度质量审计：

```bash
# 运行核心字典完整性与 ICU 防火墙测试
npm test

# 运行全维度一致性与质量审计工具
node tools/comprehensive-audit.js

# 运行上游版本漂移检测
npm run scan:drift
```

* **字典完整性断言 (`test/verify-dict.js`)**：验证核心字典结构无缺失、无空值。
* **ICU 语法防火墙 (`test/test-icu.js`)**：确保所有模板变量、复数分支与技术专有名词 100% 结构对称。
* **全维度质量审计 (`tools/comprehensive-audit.js`)**：自动扫描 HTML 标签闭合性、上下文规格与专有名词一致性。

---

## 🔄 自动化演进闭环 (Self-Evolving Pipeline)

```mermaid
flowchart LR
    A[官方新版本推送] -->|提取 Diff| B[漂移分析器 scan:drift]
    B -->|新增增量词条| C[AI 增量翻译与 ICU 校验]
    C -->|验证通过词库| D[双层智能注入引擎]
    D -->|自愈式挂载| E[Claude 客户端完美呈现中文]
```

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。
