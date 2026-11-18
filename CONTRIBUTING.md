# 贡献指南 (Contributing Guide)

感谢您对 **Claude-Chinese** 项目的关注与支持！我们欢迎社区提交 Issue、翻译校对与功能 Pull Request。

---

## 🛠️ 参与贡献工作流

### 1. 提交新词条或校对翻译
* **词库结构说明**：
  * `dict/zh-CN.json`：负责 Electron Shell 原生菜单、托盘与虚拟机会话等词条。
  * `dict/ion-zh-CN.json`：负责 Web UI 核心界面、设置、文件预览与各位置的右键菜单。
  * `dict/dynamic-zh-CN.json`：负责模型思考（Thinking）、扩展推理（Extended reasoning）等模型特性。
  * `dict/long-docs-zh-CN.json`：以完整英文正文为键，翻译第三方推理等页面的折叠说明。
  * `dict/scoped-ui-zh-CN.json`：审核过的硬编码 UI 文案和校验提示，仅替换指定模块的原始源码上下文，不是全局词语替换表。
  * 当前词库数量与宿主适配范围见 [README.md](README.md)，累计词条数不代表当前所有共享 Web 资源的汉化率。

* **词条翻译与边界规范**：
  1. **沿用官方资源键与原文**：不要改写既有资源键。宿主更新后先核对当前键和引用；长文档正文变化时新增对应的完整原文键，保留仍需兼容的旧条目。
  2. **严禁破坏 ICU 占位符**：保留所有形如 `{count, plural...}`, `{apps}`, `{folderName}`, `{percentage}` 的变量与复数格式。
  3. **按语境选择术语**。保留 `MCP`、`Claude`、`DeepSeek`、`API`、`CLI`、`JSON`、`URL`、`SSH`、`OAuth`、`BLE`、`QEMU` 等名称。模型输入与输出使用 `Token`，认证凭据使用“令牌”，配置键和命令按原文保留。`Plan` 在权限菜单里译为“计划”，在计费界面译为“套餐”。Code 的 `Routines` 与 `Scheduled tasks` 指同一功能时统一为“定时任务”。
  4. **规格与单位规范**：上下文窗口（如 `128k`, `1M`, `3M`）严禁翻译为时间单位（如“1个月”）。

---

### 2. 运行自动化测试与全维度质量审计

在提交 PR 前，请确保本地全量测试 100% 通过：

```bash
# 运行核心字典完整性与 ICU 防火墙测试
npm test

# 核对兼容矩阵、完整折叠正文和依赖安全
npm run test:matrix
npm run audit
npm run audit:deps

# 运行上游版本漂移检测
npm run scan:drift
```

宿主维护还需核查官方产品日志、桌面发布接口和应用内日志，并在真实客户端检查普通菜单、会话与分组右键菜单、输入框、正文选区、文件树和预览编辑器。没有宿主的 CI 会使用隔离快照；通过快照测试不能代替真实界面验证。补充译文时保留人工校对的术语、配置键、代码示例和链接。

`npm run audit:ui` 校验 `test/fixtures/desktop-ui-6.6395.json` 与 `test/fixtures/desktop-ui-5.11492.json` 中已审核模块的全部消息。6.6395 快照沿用与 5.11492 快照相同的消息记录。维护快照时，从原版归档解析实际组件，用 `tools/ui-coverage.js` 的 `collectMessages` 同时提取真实 descriptor 和英文表键引用，并处理未收入英文表的 ID。无 ID 的 descriptor 需要单独审核源码上下文。核对源码指纹、模块消息集合、保留英文的理由及限定补丁上下文后，再运行完整测试和实机验收。覆盖数字仅适用于所列模块。运行时模型说明须核对真实来源与界面，并保留用户自定义模型标识和内容。

---

### 3. Pull Request 提交规范

1. Fork 本仓库并基于 `main` 分支创建功能分支（如 `feat/optimize-cowork-translations`）；
2. 遵循清晰的 Git 提交信息规范（如 `feat: ...`, `fix: ...`, `docs: ...`）；
3. 确保所有自动化断言测试通过后发起 Pull Request。
