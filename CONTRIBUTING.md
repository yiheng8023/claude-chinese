# 贡献指南 (Contributing Guide)

感谢您对 **Claude-Chinese** 项目的关注与支持！我们欢迎社区提交 Issue、翻译校对与功能 Pull Request。

---

## 🛠️ 参与贡献工作流

### 1. 提交新词条或校对翻译
* **词库结构说明**：
  * `dict/zh-CN.json`：负责 Electron Shell 壳层原生菜单、托盘与虚拟机会话等 550+ 官方基础词条。
  * `dict/ion-zh-CN.json`：负责 Web UI 核心界面（Cowork 画布、设置、会话看板）的 18,000+ 词条。
  * `dict/dynamic-zh-CN.json`：负责模型思考（Thinking）、扩展推理（Extended reasoning）等模型特性。

* **词条翻译与边界规范**：
  1. **严禁修改 HashKey**：所有的 Key 均为官方编译生成的唯一哈希，仅修改对应的 Value 字符串。
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

# 运行上游版本漂移检测
npm run scan:drift
```

---

### 3. Pull Request 提交规范

1. Fork 本仓库并基于 `main` 分支创建功能分支（如 `feat/optimize-cowork-translations`）；
2. 遵循清晰的 Git 提交信息规范（如 `feat: ...`, `fix: ...`, `docs: ...`）；
3. 确保所有自动化断言测试通过后发起 Pull Request。
