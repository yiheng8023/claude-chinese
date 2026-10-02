### 🌟 Claude 桌面端自愈型中文汉化套件 v1.2.73 (Diff Semantic Isolation & Precision Polish)

#### 1. 代码差异 (Diff) 与文件变更 (Change) 工业级语义隔离
- **根治术语自相矛盾与精神分裂**：
  - 针对 AI 客户端中普遍存在的将 `Diff` 机械译为“变更”导致 Tab 叫“变更”、按钮叫“折叠差异/差异视图”的行业通病，建立坚不可摧的术语界限；
  - `Diff` 100% 标准化为状态对比“**差异**”（如内联差异、差异视图、文件差异、`j6wj7c/ElG` 对齐为“查看此差异涉及的所有内容”）；
  - `Change` 标准化为行为或实体集合“**变更/更改**”（如文件变更、接受更改）；
  - 在 `tools/ultimate-consistency-audit.js` 中设立【一致性检查 7】硬核自动化门禁，彻底终结术语冲突。

#### 2. 上游最新版本 (v2.19675.0.0) 精准漏项补齐
- **收录文件侧边栏核心操作词条**：
  - `Filter, or ? to search in files` ➔ **`过滤，或输入 ? 在文件中搜索`**；
  - `Go to file or search` (Ctrl+P) ➔ **`前往文件或搜索`**；
- **收录“阻止非必要服务”深层网络长文档 (第 138 篇长文档)**：
  - 补齐选项说明 `iwXupWG0F3`（`Connector 图标、产物预览与 MCP Apps iframe...`）；
  - 在 `dict/long-docs-zh-CN.json` 中全景收录展开详情长段落，深入解释 Connector 图标代理、MCP Apps iframe 域名、离线拼写词典与网络出口限制规则；
- **模型推理强度选项徽标对齐**：
  - 严格确保 `Recommended` 徽标标签规范化呈现为 **`推荐`**。

#### 3. 动态 Bundle 感知与 AST 语法防火墙升级
- **动态探测 Rolls/Vite Bundle Hash**：测试套件与注入逻辑彻底告别写死老版本文件名，自适应上游多 Bundle 变异，100% 通过 Node.js 严格 ESM AST 语法检查；
- **事前兼容矩阵与全维体检**：`npm test` 5 大套件全部 PASS，`npm run test:matrix` 活跃补丁 100% 命中，7 大一致性检查全部 0 缺陷通过。
