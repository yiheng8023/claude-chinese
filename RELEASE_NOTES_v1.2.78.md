### 🌟 Claude 桌面端自愈型中文汉化套件 v1.2.78 (Upstream v2.31226.0.0 Architecture Adaptation)

#### 1. 上游最新客户端 (v2.31226.0.0) 架构级全面同步适配
- **跟进官方 2.31226 构建跨越式升级**：
  - 上游客户端构建号由 `2.26454.2.0` 正式迈向 **`2.31226.0.0`**（MSIX 包：`Claude_2.31226.0.0_x64__pzs8sxrjxfjjc`）；
  - 官方重点推进了 Claude 5.5 模型家族深度联动、Cowork 协同任务直接生成/导出文档、第三方 MCP 服务快速导入及远程 SSH 开发支持；
  - 本项目坚守稳健演进铁律，版本克制平稳递进至 **v1.2.78**，实现对新版客户端的无缝兼容。

#### 2. 外壳层 (Shell) 词条基准扩容与 32 项全新核心特性出版级汉化
- **外壳基准扩充至 801 词条**：
  - 官方外壳基线字典 `dict/en-US.base.json` 完整同步至最新的 801 条，外壳汉化库 `dict/zh-CN.json` 同步扩容至 **1,100 条**；
  - 新增 **32 项**关键功能特性的全量 ICU 结构级出版汉化，涵盖：
    1. **技能上传与管理 (Skill Upload & Management)**：`Upload skill`、`Upload this skill to Claude?`、`Customize › Skills` 等技能同步流；
    2. **第三方 MCP 导入迁移 (MCP Migration & Third-Party Import)**：从第三方客户端快速发现并导入 MCP 服务器、启动环境及参数同步；
    3. **SSH 远程会话连接重连与配置修复 (SSH Remote Session Fixes)**：`Match host` / `Match originalhost`、`StrictHostKeyChecking accept-new` 与密钥确认指导；
    4. **工作树与端口站点授权安全审批 (Worktree & Allowed Sites Authorization)**：直接位于项目父级端口下的站点自动化操作安全确认；
    5. **多用户设置统一变更提示**。

#### 3. 核心界面高频盲点全量攻坚与 1M 长文档收录
- **精准闭环高频操作界面汉化缺失**：
  1. **账号弹出菜单**：`Learn more` ➔ `了解更多`，`Your privacy choices` ➔ `您的隐私选择`；
  2. **功能设置**：`Opt into the new Chat and Cowork unified view` ➔ `加入全新对话与 Cowork 统一视图`；
  3. **外观设置**：侧边栏与主标题 `Appearance` ➔ `外观`；
  4. **模型与网关配置**：`Use 1M wherever it’s available` ➔ `尽可能使用 1M 上下文`，副标题及选项描述全量汉化；
  5. **1M 架构长文档收录**：新增收录关于 1M Token 上下文窗口、网关发现标记与 `supports1m` 的全景折叠深度长文档，长文档总数扩增至 **149 篇**。

#### 4. 极速注入引擎与 AST 语法防火墙全绿通过
- **新版 JS Bundle 拓扑自适应**：
  - 针对 `2.31226.0.0` 全新变异编译的 JS 资源 Bundle（`cd30666f2-BLBAqZUT.js` 等），极速剪枝探针（Fast Substring Guard）与拓扑反向引用引擎精准命中，0 漏判；
  - 真实客户端 Bundle 的 Node.js ESM AST 语法防火墙扫描 100% PASS，杜绝任何黑屏隐患；
  - 完整继承 149 篇折叠长文档与 30,166 条 Web UI 核心词库，未翻译新增词条由官方英文优雅纯净兜底。

#### 5. 全局一致性 8 大防退化门禁 0 缺陷
- **8 大一致性体检全部 PASS**：`npm run audit` 针对全站词条的 Effort 推理强度、审批模式、动作词、ICU 结构、HTML 标签对称性、Fork/Branch 概念隔离、Diff/Change 概念隔离及状态机枚举巡检保持 **0 警告、0 缺陷**；
- **全平台测试与事前兼容矩阵全线绿灯**：`npm test` 5 大套件与 `npm run test:matrix` 事前兼容矩阵 100% 满分通过。
