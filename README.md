# Claude 桌面端自愈型中文汉化工具包 (Claude Chinese Toolkit)

<p align="center">
  <a href="https://github.com/yiheng8023/claude-chinese/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/yiheng8023/claude-chinese/ci.yml?branch=main&label=CI&logo=github" alt="CI Status"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/releases/latest"><img src="https://img.shields.io/github/v/release/yiheng8023/claude-chinese?color=blue&label=Release" alt="Latest Release"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/releases"><img src="https://img.shields.io/github/downloads/yiheng8023/claude-chinese/total?style=flat&color=3388ff&logo=github&label=Downloads" alt="Total Downloads"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/stargazers"><img src="https://img.shields.io/github/stars/yiheng8023/claude-chinese?style=flat&logo=github&color=ffaa00" alt="GitHub Stars"></a>
  <a href="https://github.com/yiheng8023/claude-chinese/network/members"><img src="https://img.shields.io/github/forks/yiheng8023/claude-chinese?style=flat&logo=github&color=grey" alt="GitHub Forks"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D20.x%20(Rec%20%3E%3D22.12)-brightgreen?logo=node.js" alt="Node Version">
  <img src="https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey" alt="Platform Support">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/yiheng8023/claude-chinese?color=green" alt="License"></a>
</p>

<p align="center">
  <a href="README.md">简体中文</a> | <a href="README.en.md">English</a>
</p>


用于 Anthropic **Claude Desktop** 桌面客户端的可恢复中文汉化工具包（代码版本 **v1.2.91**，本轮适配 **4.4212.0**）。沿用官方 i18n 资源做增量维护，保留现有译文与术语规则。

---

## 🌟 核心特性

- **沿用原生 i18n**：增量生成中文资源，保留官方英文作为回退。
- **保留术语规则**：区分 Diff（差异）与 Change（变更）、Branch（分支）与 Fork（分叉）。配置键、模型 ID、协议名等按上下文保留英文。
- **四层词库**：外壳 1,282 项（当前英文基线 961 项）、Web UI 31,156 项、动态词库 51 项及长说明 174 篇。数量包含历史兼容条目和有意保留的英文，并非当前界面汉化率。
- **新版语言注册**：按语言映射结构匹配主进程，不依赖每次构建变化的混淆变量名；未命中时报告失败。
- **可恢复安装**：在临时目录完成双 ASAR 与主程序的准备和校验，再写入安装目录；写入异常时恢复安装前文件，保留同版本原版备份。
- **更新识别**：核对文件 SHA-256、工具版本和词库摘要。官方更新后的新文件优先，拒绝混合版本或不明修改，避免旧备份回退新版。
- **实际检查**：使用 ICU 解析器检查语法、嵌套变量、格式类型与 select 分支；允许符合中文规则的复数写法。修改过的前端及主进程 JS 均执行语法检查。
- **运行边界**：不会自动创建镜像客户端，不改动 Cowork 安装资格、CC Switch 路由或官方更新机制；运行中的客户端需要先保存工作并退出。

---

## 🗺️ 项目范围与结构

本项目专注客户端界面汉化。四层资源分别是 Shell 原生菜单、Ion/Web UI、动态模型说明与折叠长文档。第三方推理配置页面属于汉化范围；模型路由、凭据管理和账号功能继续由客户端及 CC Switch 等原有工具负责。

本轮适配目标为官网安装器安装的 Windows **4.4212.0**（系统包版本 **4.4212.0.0**）。macOS/Linux 保留既有散装资源布局支持；当前双 ASAR 与可执行程序完整性同步仅实现并验证了 Windows 路径。

---

## 📋 前置环境与要求 (Prerequisites)

1. **操作系统支持**：
   - **Windows**：Windows 10 / 11 (x64)（支持官网安装器安装的版本，不支持 Microsoft Store 分发版）
   - **macOS**：macOS 12+（Apple Silicon M 系列及 Intel 芯片）
   - **Linux**：主流发行版（x64 / ARM64）
2. **Node.js 基础运行环境**：
   - 系统中需安装 **Node.js (推荐 >= 22.12.0 LTS，最低兼容 >= 20.x)** 及附带的 **npm**。
   - 验证方式：在终端运行 `node -v`。若未安装，请前往 [Node.js 官方网站](https://nodejs.org/) 下载安装 LTS 版本。
   - ⚠️ **引擎依赖兼容性声明 (Compatibility Note)**：
     - **推荐基线（零警告原生支持）**：**Node.js ≥ 22.12.0**（如 Node 22 LTS 或 Node 24+）。项目底层核心打包依赖 `@electron/asar` 声明 `engines.node: ">=22.12.0"`，在 Node 22+ 下可获得零引擎警告（`EBADENGINE`）的最佳体验；
     - **兼容状态说明**：CI 包含 **Node.js 20.x**，但安装依赖时可能提示 `EBADENGINE`；启用 `engine-strict=true` 时可能阻断安装。Node 20 的 CI 结果不代表所有较早小版本均兼容，建议优先使用 Node 22.12+。
3. **已安装 Claude Desktop 客户端**：
   - 确保本机已安装官方 Claude 桌面客户端。
   - ⚠️ **Windows 分发渠道兼容性说明 (Important)**：
     - **支持渠道**：支持从 Claude 官网（[claude.com/download](https://claude.com/download)）下载的 `.exe` 安装器。**安装器本身也可能部署 MSIX 到 WindowsApps**，不能仅凭扩展名或目录判定分发渠道。
     - **不支持渠道**：**暂不支持**从 Microsoft Store（微软应用商店）分发的 MSIX / AppX 版本。检测器会区分官网包 `Claude` 与商店包 `AnthropicPBC.Claude`，并拒绝向商店包写入。

---

补丁会修改 ASAR 及 Windows 主程序内的完整性记录，**原发布者数字签名会因此失效**，安全软件或设备策略可能拒绝此操作。本项目保留 Electron Fuse 4，不关闭系统防护；无法写入时不创建第二个客户端。正常写入异常已覆盖回滚测试，断电或外部进程同时写入不属于已验证的回滚保证。请保留原版备份。

如果重启后仍显示英文，请在客户端的语言选择中选择“中文（简体）”；工具会保留已有语言偏好。

安装依赖使用 `npm ci`，此步骤不再自动修改已安装的 Claude；汉化请显式运行 `node cli.js install` 或 `npm run patch`。

本轮在官网 **4.4212.0** 上实测，“帮助 → 检查更新”正常返回“您正在运行最新版本”。此前版本的 Squirrel 报错未在此版本复现；汉化不替换官方更新器。若更新后汉化被覆盖，退出客户端后重新运行 `launch.bat` 或安装脚本。

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

# 4. 可选：监听资源与词库变化（运行中不强制退出客户端；ASAR 更新后需重启）
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
# 运行全套自动化测试套件（含完整 ASAR 生命周期与失败回滚回归）
npm test

# 运行 AST 语法完整性与黑屏崩溃拦截专项测试
npm run test:ast

# 运行事前上游兼容矩阵与代码拓扑变异测试
npm run test:matrix

# 运行全维度本地化一致性与 ICU 专有名词审计
npm run audit
```

- **核心字典完整性 (`test/verify-dict.js`)**：验证基础字典结构无缺失、无空值（961 项当前外壳基线）。
- **ICU 语法防火墙 (`test/test-icu.js`)**：检查消息语法，并在可读取宿主时对照真实英文校验变量和分支。未安装宿主时明确标记跳过英文对照。
- **生命周期还原闭环 (`test/test-restore-cycle.js`)**：验证真实安装 -> 状态判定 -> 双重安装幂等 -> 干净还原 -> 原版回退全流程，包含官方静默升级防版本回退专项断言。
- **跨平台宿主无参探测与沙盒实测 (`test/test-cross-platform-live.js`)**：在真实 Ubuntu / macOS / Windows runner 上验证 0 参数路径探测与跨平台布局注入。
- **AST 语法防火墙与黑屏拦截 (`test/test-ast-syntax.js`)**：本机有安装时读取当前全部前端 JS，并检查所有被修改文件；CI 无宿主时使用合成样本。语法通过不替代实际启动验证。
- **事前兼容矩阵与代码拓扑变异测试 (`tools/upstream-compatibility-matrix.js` / `npm run test:matrix`)**：模拟打包混淆变异（变量置换、箭头函数、Object.assign 降级），在代码发布前完成代码拓扑韧性压力断言。
- **全维度本地化一致性审计 (`tools/ultimate-consistency-audit.js` / `npm run audit`)**：全面体检思考强度、审批工作流、动作动词、Fork(分叉)与Branch(分支)隔离、Diff(差异)与Change(变更)隔离、以及原生状态机动作词与状态枚举完整性（8 大专项体检），确保 0 HTML 标签不对称、0 ICU 变量偏差与 0 术语冲突。

---

安装后运行 `npm run verify:client` 可只读核对真实 ASAR、主程序、原版备份、英文原始字节和熔丝状态。此命令不能替代真实界面检查。

## 🔄 自动化演进闭环 (Self-Evolving Pipeline)

```mermaid
flowchart LR
    A[官方新版本推送] -->|提取 Diff| B[漂移分析器 scan:drift]
    B -->|新增增量词条| C[AI 增量翻译与 ICU 校验]
    C -->|验证通过词库| D[双层智能注入引擎]
    D -->|自愈式挂载| E[客户端中文界面与保留英文回退]
```

---

## 📁 仓库结构 (Repository Structure)

```text
claude-chinese/
├── .github/
│   └── workflows/
│       ├── ci.yml                    # 全平台 (Windows/macOS/Linux) CI 自动化测试流水线
│       └── upstream-matrix-sentinel.yml # 上游事前兼容矩阵与混淆变异碰撞每日巡检哨兵
├── dict/                             # 核心汉化词库
│   ├── zh-CN.json                    # Shell 壳层汉化词典 (1,282 词条)
│   ├── ion-zh-CN.json                # Web/Ion 核心 UI 词典 (31,156 词条)
│   ├── long-docs-zh-CN.json          # 全景折叠长文档与企业级深度说明词典 (174 篇)
│   └── dynamic-zh-CN.json            # 动态特性与推理占位符词典
├── core/                             # 核心注入与架构引擎
│   ├── patcher.js                    # 拓扑多签名长文档引擎、JS 白名单与出厂基线自愈
│   ├── msix-detector.js              # MSIX 容器探测与跨平台多布局解析
│   ├── permissions.js                # Windows ACL 权限安全授予与提权工具
│   └── preflight.js                  # 前置环境全维健康预检器 (Node/客户端/进程锁)
├── test/                             # 自动化全真回归测试套件
│   ├── verify-dict.js                # 字典语法与完整性断言
│   ├── test-icu.js                   # 全量 31,000+ 词条 ICU 占位符与专有名词保护断言
│   ├── test-restore-cycle.js         # 安装、还原生命周期与官方静默升级防降级断言
│   ├── test-cross-platform-live.js   # 跨平台无参系统路径探测与沙盒注入实测
│   └── test-ast-syntax.js            # AST 语法完整性与黑屏死屏拦截断言
├── tools/                            # 自动化工程与事前兼容工具链
│   ├── upstream-compatibility-matrix.js # 上游多版本事前兼容矩阵与混淆变异碰撞测试引擎
│   ├── drift-detector.js             # 上游版本文本差量提取与漂移检测器 (scan:drift)
│   ├── comprehensive-audit.js        # 全维度本地化质量与技术枚举保护审计 (audit)
│   ├── ultimate-consistency-audit.js # 全局术语、ICU 变量与 HTML 对称性深度体检
│   └── compile-zh-dict.js            # 官方原版基准增量合并与编译工具
├── docs/assets/sponsoring/           # 赞助与社区资产
├── cli.js                            # 跨平台生命周期命令行管理入口
├── install.bat / install.sh          # 一键安装脚本
├── launch.bat                        # 自愈启动脚本
├── uninstall.bat / uninstall.sh      # 一键还原脚本
├── package.json                      # 项目配置与 npm scripts
├── LICENSE                           # MIT 开源许可证
└── README.md / README.en.md          # 中英双语说明文档
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

[![Star History Chart](https://api.star-history.com/svg?repos=yiheng8023/claude-chinese&type=Date)](https://star-history.com/#yiheng8023/claude-chinese&Date)

---

## ⚠️ 免责声明与合规说明 (Disclaimer & Compliance)

1. **非官方项目**：本项目为社区发起的开源本地化辅助工具，**非 Anthropic 官方产品**，与 Anthropic, PBC 及其关联公司无官方从属或背书关系。
2. **商标声明**：`Claude`, `Anthropic`, `DeepSeek` 等相关商标、产品名称及版权均归其各自所有者所有。
3. **合法使用**：本项目仅供个人学习、技术研究及中文本地化辅助使用。本项目**绝不分发**任何官方专有二进制资产，所有修改均在用户本地客户端合法完成。
4. **安全与隐私**：本项目**绝不包含**任何形式的遥测上报、网络后门或用户凭据读取逻辑。代码 100% 开源透明。

---

## 📄 开源协议

本项目基于 [MIT License](LICENSE) 协议开源。
