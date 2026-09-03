# Claude 桌面端自愈型中文汉化工具包 (Claude Chinese Toolkit)

<p align="center">
  <a href="https://github.com/yiheng8023/claude-chinese/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/yiheng8023/claude-chinese/ci.yml?branch=main&label=CI&logo=github" alt="CI Status"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/releases/latest"><img src="https://img.shields.io/github/v/release/yiheng8023/claude-chinese?color=blue&label=Release" alt="Latest Release"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/releases"><img src="https://img.shields.io/github/downloads/yiheng8023/claude-chinese/total?style=flat&color=3388ff&logo=github&label=Downloads" alt="Total Downloads"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/stargazers"><img src="https://img.shields.io/github/stars/yiheng8023/claude-chinese?style=flat&logo=github&color=ffaa00" alt="GitHub Stars"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/network/members"><img src="https://img.shields.io/github/forks/yiheng8023/claude-chinese?style=flat&logo=github&color=grey" alt="GitHub Forks"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D16.x-brightgreen?logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform Support">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/yiheng8023/claude-chinese?color=green" alt="License"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>

专为 Anthropic **Claude Desktop** 桌面客户端（Windows MSIX / Win32 / macOS / Linux）打造的高性能、可逆式中文本地化工具包。基于官方原生 i18n 架构打造增量挂载与自愈工程体系，实现全量 UI 界面汉化与版本更新自动自愈。

---

## 🌟 核心特性与设计哲学

- 🛡️ **可逆式增量挂载与纯净兜底 (Incremental Overlay & Fallback)**：基于官方原版 `en-US` 进行增量合并，**绝不粗暴覆盖原版英文字典**。当官方更新引入全新词条时自动回退英文，彻底拆除“更新即白屏”的隐患。
- 🕊️ **官方中文自动检测与优雅让位 (Graceful Yield)**：内置官方多语言与原生 JS 白名单自动嗅探，当 Anthropic 官方未来原生支持中文时，工具包将秒级识别并自动优雅让位。
- 🧬 **自愈与抗漂移 (Self-Healing & Drift-Resistant)**：内置版本漂移检测引擎 (`npm run scan:drift`)，官方发版更新后秒级检测新增与废弃词条，彻底终结更新后满世界找新补丁的痛点。
- 🎯 **全量 HashKey 界面覆盖**：覆盖全量 18,900+ 核心词条（包含完整的 Cowork 协同画布、权限审批流、Claude Code 模式、模型规格选择器与设置面板）。
- 🔒 **严格的 ICU 语法与 AST 变量防火墙**：严格防护 `{count, plural...}`, `{apps}`, `{folderName}` 等变量插值与规格参数（如 `1M`, `128k`, `MCP`, `DeepSeek` 等），确保任务流执行永不卡死。
- 🪟 **最小特权原则与 MSIX 专属适配**：严格遵循安全边界，仅对当前用户赋予必要文件修改权限，杜绝全局 Users 组高危赋权。

---

## 🗺️ 架构与演进路线图 (Architecture & Roadmap)

本项目采用分阶段演进架构：

```mermaid
graph TD
    User((开发者 / 用户)) --> ClaudeApp[Claude Desktop 客户端]
    
    subgraph Mode1 ["【已上线】客户端宿主 UI 汉化 (Host UI Localization)"]
        ClaudeApp --> ShellLayer["Shell 壳层 (550+ 词条)"]
        ClaudeApp --> WebUILayer["Ion-Dist Web UI (18,900+ 词条)"]
        ClaudeApp --> DynamicLayer["Dynamic 思考模型特性"]
    end
    
    subgraph Mode2 ["【规划中 / Roadmap】智能体扩展生态 (Agent Suite)"]
        ClaudeApp -.-> MCP["MCP Server 中文工程协议"]
        ClaudeApp -.-> Rules["中文交互与代码注释规则"]
        ClaudeApp -.-> Switcher["1P 官方账号 / 3P 第三方网关 (DeepSeek) 切换"]
    end
```

1. **维度 A：客户端宿主全量本地化 (Host UI Localization - 已就绪)**：
   - 彻底汉化客户端所有原生菜单、系统托盘、Cowork 协同任务画布、审批流弹窗、设置与输入交互。
2. **维度 B：智能体扩展生态 (MCP Agent Suite - 规划演进中)**：
   - **[计划]** 通过官方 **MCP (Model Context Protocol)** 协议接入中文工具链与本地工作流；
   - **[计划]** 适配 **CC Switch** 等路由网关，支持在官方 Claude 与第三方推理端点之间无缝切换。

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

# 2. 执行前置环境全维健康预检 (Node 弹性版本、客户端安装、进程锁定与权限)
node cli.js check

# 3. 一键安装汉化（自动执行前置预检、安全释放文件锁并完成增量挂载）
node cli.js install

# 4. 启动热重载与自愈守护进程 (编辑词库后按 Ctrl+R 秒级生效，官方更新自动自愈)
node cli.js watch

# 5. 自愈启动（自动检测版本覆盖并在需要时秒级自愈挂载后拉起客户端）
node cli.js launch

# 6. 执行上游版本文本漂移分析 (Drift Detection)
node cli.js drift

# 7. 一键还原回官方英文原版
node cli.js restore
```

---

## 🧪 自动化测试与质量保证 (Testing & Verification)

本项目引入严格的端到端自动化测试与跨平台 CI 流水线（Windows / macOS / Ubuntu），避免人工经验验证带来的遗漏：

```bash
# 运行全套自动化测试套件（聚合 4 大核心测试套件）
npm test
```

- **核心字典完整性 (`test/verify-dict.js`)**：验证基础字典结构无缺失、无空值。
- **ICU 语法防火墙 (`test/test-icu.js`)**：确保所有模板变量、复数分支与技术专有名词 100% 结构对称。
- **生命周期还原闭环 (`test/test-restore-cycle.js`)**：验证真实安装 -> 状态判定 -> 干净还原 -> 原版回退全流程。
- **跨平台宿主无参探测与沙盒实测 (`test/test-cross-platform-live.js`)**：在真实 Ubuntu / macOS / Windows runner 上验证 0 参数路径探测与跨平台布局注入。

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

## 📁 仓库结构 (Repository Structure)

```text
claude-chinese/
├── dict/                     # 汉化词库目录
│   ├── zh-CN.json            # 核心 Shell 壳层汉化词典 (550+ 词条)
│   ├── ion-zh-CN.json        # 网页端核心 UI 词典 (18,900+ 词条)
│   └── dynamic-zh-CN.json    # 动态特性与占位符词典
├── core/                     # 注入核心模块
│   ├── patcher.js            # 补丁注入、JS 白名单注册与还原核心
│   ├── msix-detector.js      # MSIX 容器探测与跨平台路径解析
│   └── permissions.js        # Windows ACL 权限与提权工具
├── test/                     # 自动化全真回归测试套件
│   ├── verify-dict.js        # 字典完整性断言
│   ├── test-icu.js           # ICU 占位符与专有名词保护断言
│   ├── test-restore-cycle.js # 安装与还原生命周期回归测试
│   └── test-cross-platform-live.js # 跨平台无参系统路径探测实测
├── tools/                    # 文本提取、差量比对与漂移检测工具链
├── docs/assets/sponsoring/   # 赞助与支持相关资产
├── cli.js                    # 跨平台命令行生命周期管理入口
├── install.bat / install.sh  # 一键安装脚本
├── launch.bat                # 自愈启动脚本
├── uninstall.bat / uninstall.sh # 一键还原脚本
├── package.json              # 项目配置与 npm scripts
├── LICENSE                   # MIT 开源许可证
└── README.md                 # 说明文档
```

---

## 💖 自愿赞助与支持

如果 Claude 中文汉化项目对你的工作与日常开发有所帮助，并且你愿意支持本项目的持续维护、文档优化、自动化测试与版本迭代，诚挚感谢任意金额的自愿赞助。赞助完全自愿，不构成任何服务级承诺。

- **人民币赞助**：可扫描下方微信支付或支付宝收款码。
- **跨境赞助 / 其他币种**：可以使用 **[PayPal 赞助链接](https://www.paypal.com/ncp/payment/LNTF8KXGJXMZY)**。实际可用币种、付款方式与换汇以 PayPal 结算页为准。

付款前请核对结算页面显示的收款方。感谢你对开源项目的认可与支持！

<table>
  <tr>
    <td align="center"><strong>微信支付（人民币）</strong><br><img src="docs/assets/sponsoring/wechat-pay.png" alt="微信支付自愿赞助收款码" width="260"></td>
    <td align="center"><strong>支付宝（人民币）</strong><br><img src="docs/assets/sponsoring/alipay.png" alt="支付宝自愿赞助收款码" width="260"></td>
  </tr>
</table>

---

## 👥 贡献者墙 (Contributors)

诚挚感谢所有为本项目贡献代码、反馈 Bug、完善词库与文档的开发者们！

<p align="center">
  <a href="https://github.com/yiheng8023/claude-chinese/graphs/contributors">
    <img src="https://contrib.rocks/image?repo=yiheng8023/claude-chinese" alt="Contributors" />
  </a>
</p>

---

## 📈 Star 增长趋势与社区生态 (Star History)

[![Star History Chart](https://api.star-history.com/svg?repos=yiheng8023/claude-chinese,yiheng8023/antigravity-chinese&type=Date)](https://star-history.com/#yiheng8023/claude-chinese&yiheng8023/antigravity-chinese&Date)

---

## ⚠️ 免责声明与合规说明 (Disclaimer & Compliance)

1. **非官方项目**：本项目为社区发起的开源本地化辅助工具，**非 Anthropic 官方产品**，与 Anthropic, PBC 及其关联公司无官方从属或背书关系。
2. **商标声明**：`Claude`, `Anthropic`, `DeepSeek` 等相关商标、产品名称及版权均归其各自所有者所有。
3. **合法使用**：本项目仅供个人学习、技术研究及中文本地化辅助使用。本项目**绝不分发**任何官方专有二进制资产，所有修改均在用户本地客户端合法完成。
4. **安全与隐私**：本项目**绝不包含**任何形式的遥测上报、网络后门或用户凭据读取逻辑。代码 100% 开源透明。

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 协议开源。
