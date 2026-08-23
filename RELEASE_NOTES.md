# 🚀 Claude-Chinese v1.0.0 首个正式自愈型汉化发行版

专为 **Claude Desktop** 桌面客户端（Windows MSIX / Win32 / macOS / Linux）打造的高性能、非侵入式中文本地化工具包。

---

## 🌟 核心特性与亮点

- 🛡️ **非侵入式双层注入架构**：
  - **外壳层 (Shell)**：覆盖 550+ 官方基础词条（系统托盘、原生菜单、虚拟机会话）。
  - **Web UI 渲染层 (Ion-Dist)**：覆盖 18,900+ 核心界面词条（Cowork 协同画布、权限审批流、Claude Code、会话看板）。
  - **Dynamic 特性**：覆盖 47 条模型思考（Thinking）与扩展推理（Extended thinking）特性。
- ⚡ **前端 JS 语言白名单自动注册**：突破官方仅硬编码部分语言的限制，自动在打包 JS 中注册 `zh-CN` 支持。
- 🔒 **严格的 ICU AST 语法防火墙**：
  - 100% 保护 `{count, plural...}`, `{apps}`, `{folderName}` 等变量与复数插值；
  - 严格保持 `1M`, `128k`, `3M` 等模型上下文规格规范，绝不误翻。
- 🪟 **MSIX / WindowsApps 专属适配**：内置 UAC 自动提权与 Windows ACL 权限管理，轻松解决系统保护目录无法写入的问题。
- 🧬 **版本漂移检测器 (Drift Detector)**：支持 `npm run scan:drift`，官方发版更新后秒级检测新增与废弃词条。
- 🔌 **完美兼容第三方模型路由**：全面支持 **CC Switch + DeepSeek** 等 3P 推理环境下的 `cowork + code` 混合模式。

---

## 📦 安装与使用指南

### Windows（推荐）
1. 下载下方附件中的 **`claude-chinese-v1.0.0.zip`** 并解压；
2. 右键以管理员身份运行 **`install.bat`**；
3. 重启 Claude 客户端（若未自动切换，可在左下角 `Language` 中选择 **中文 (简体)**）。

### macOS / Linux
```bash
./install.sh
```

---

## 🧪 质量保证
- 全套端到端自动化断言测试通过（`npm test`）；
- 全维度 HTML 标签、ICU 占位符及专有名词审计通过（`npm run audit`）。
