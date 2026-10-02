### 🌟 Claude 桌面端自愈型中文汉化套件 v1.2.73 (Diff Consistency Gate & Precision Polish)

#### 1. 既有代码差异 (Diff) 标准固化与语义隔离门禁加固
- **坚守既有标准，杜绝术语退化**：
  - 本项目自始至终确立并贯彻状态对比“**差异**”（Diff）与实体行为“**变更/更改**”（Change）的出版级语义隔离规范；
  - 本次更新正式将该既有准则固化为自动化防退化门禁，在 `tools/ultimate-consistency-audit.js` 中新增【一致性检查 7】硬核审计套件；
  - 自动化巡检全库 31,000+ 词条，确保无任何将 Diff 混淆为“变更”的语义冲突，对齐诸如“查看此差异涉及的所有内容 (`j6wj7c/ElG`)”等上下文，实现全生态 100% 闭环。

#### 2. 上游最新版本 (v2.19675.0.0) 精准漏项补齐与双层闭环
- **收录文件侧边栏核心操作词条**：
  - `Filter, or ? to search in files` ➔ **`过滤，或输入 ? 在文件中搜索`**；
  - `Go to file or search` (Ctrl+P) ➔ **`前往文件或搜索`**；
- **收录“阻止非必要服务”深层网络长文档 (第 138 篇长文档)**：
  - 补齐选项说明 `iwXupWG0F3`（`Connector 图标、产物预览与 MCP Apps iframe...`）；
  - 在 `dict/long-docs-zh-CN.json` 中全景收录展开详情长段落，深入解释 Connector 图标代理、MCP Apps iframe 域名、离线拼写词典与网络出口限制规则；
- **模型推理强度选项徽标双层闭环汉化 (Recommended ➔ 推荐)**：
  - **Tier 1 - 原生动态 i18n 命名空间扩展**：在字典层收录官方 `secret:1rudtf6` 与 `dynamic:Recommended` 动态键，打通官方 `X(str, t)` 翻译管线；
  - **Tier 2 - AST / 运行时补丁硬核兜底**：在 `core/patcher.js` 中新增滑块刻度与二级菜单徽标双重拦截规则，彻底根治滑块下方与选项列表中的英文残留；
- **全量收录官方源码 27 种原生状态机进行态 (捕获 15 项深层漏译)**：
  - 源码级遍历 `c3d503148-d3_VyblI.js` 状态路由表，彻底补齐官方更新遗漏的 15 项进行中状态词条；
  - 涵盖：`正在创建文件` (`WSaR3s9y+0`)、`正在查找文件` (`gKeZD/jxpC`)、`正在搜索历史对话` (`MTgdhQxTPQ`)、`正在搜索项目知识库` (`JIsnwRlH0D`)、`正在添加记忆` (`9GA6hZ6RkN`)、`正在运行代码` (`7ZK71R9n1B`)、`正在分享文件` (`5iGwHk/pKZ`)、`正在读取页面` (`nxxRes7Qf3`)、`正在运行智能体` (`Lsex8QeaTL`)、`正在更新计划` (`6LJ9la6t+4`)、`正在提议计划` (`RxYks1LFQg`)、`正在编辑笔记本` (`YQEir3q/V5`)、`正在加载工具` (`ZgCKHNUoS+`)、`正在运行终端` (`sciEMhbXbm`)、`正在停止命令` (`Jdgq0BVjao`)，实现原生状态机 100% 穷尽闭环。

#### 3. 动态 Bundle 感知与 AST 语法防火墙升级
- **动态探测 Rolls/Vite Bundle Hash**：测试套件与注入逻辑彻底告别写死老版本文件名，自适应上游多 Bundle 变异，100% 通过 Node.js 严格 ESM AST 语法检查；
- **事前兼容矩阵与全维体检**：`npm test` 5 大套件全部 PASS，`npm run test:matrix` 12 项活跃补丁 100% 命中，8 大一致性检查全部 0 缺陷通过。
