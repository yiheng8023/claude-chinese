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
  * 当前词库数量与宿主适配范围见 [README.md](README.md)，累计词条数不代表当前所有共享 Web 资源的汉化率。

* **词条翻译与边界规范**：
  1. **沿用官方资源键与原文**：不要改写既有资源键。宿主更新后先核对当前键和引用；长文档正文变化时新增对应的完整原文键，保留仍需兼容的旧条目。
  2. **严禁破坏 ICU 占位符**：保留所有形如 `{count, plural...}`, `{apps}`, `{folderName}`, `{percentage}` 的变量与复数格式。
  3. **保留专业技术专有名词**：`MCP`, `Claude`, `DeepSeek`, `API`, `CLI`, `Token`, `JSON`, `URL`, `SSH`, `OAuth`, `BLE`, `QEMU` 等保持英文原样。
  4. **规格与单位规范**：上下文窗口（如 `128k`, `1M`, `3M`）严禁翻译为时间单位（如“1个月”）。

---

### 2. 运行自动化测试与全维度质量审计

在提交 PR 前，请确保本地全量测试 100% 通过：

```bash
# 运行核心字典完整性与 ICU 防火墙测试
npm test

# 运行全维度一致性与质量审计工具
node tools/comprehensive-audit.js

# 核对兼容矩阵、完整折叠正文和依赖安全
npm run test:matrix
npm run audit
npm run audit:deps

# 运行上游版本漂移检测
npm run scan:drift
```

宿主维护还需核查官方产品日志、桌面发布接口和应用内日志，并在真实客户端检查普通菜单、会话与分组右键菜单、输入框、正文选区、文件树和预览编辑器。没有宿主的 CI 会使用隔离快照；通过快照测试不能代替真实界面验证。补充译文时保留人工校对的术语、配置键、代码示例和链接。

---

### 3. Pull Request 提交规范

1. Fork 本仓库并基于 `main` 分支创建功能分支（如 `feat/optimize-cowork-translations`）；
2. 遵循清晰的 Git 提交信息规范（如 `feat: ...`, `fix: ...`, `docs: ...`）；
3. 确保所有自动化断言测试通过后发起 Pull Request。
