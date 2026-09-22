# Claude Chinese Toolkit v1.2.64 发布说明 (Release Notes)

🎉 本次版本针对最新升级的 **Claude Desktop v2.2553.13.0** 客户端展开地毯式深层审计，彻底歼灭 11 大模块共 37 处中英夹生、漏网之鱼与死角文案，词库有效条目扩充至 **20,903 条**，并通过事前混淆变异兼容矩阵与全量生命周期回归测试！

---

## 🚀 核心更新与修复细节 (Key Highlights & Fixes)

### 1. 彻底斩除中英夹生混杂 (Zero Mixed Words)
- **产物创建菜单规范化**：彻底修正遗留的夹生表述，将 `创建聊天 artifact` / `创建 Cowork artifact` 全面规范统一为 **`创建聊天产物`** 与 **`创建 Cowork 产物`**。

### 2. 设置中心与 Cowork 浏览器偏好全量补齐 (Browser Settings)
- **首选浏览器偏好**：完整汉化 `Preferred browser` ➔ `首选浏览器`、`Built-in browser` ➔ `内置浏览器`、`Open links in built-in browser` ➔ `在内置浏览器中打开链接`；
- **说明文案对齐**：完整汉化 `Claude uses this browser by default unless you ask otherwise.`、`Links open in the built-in browser instead of your default browser.`；
- **Code 浏览器能力说明**：完整汉化 Code 模式下内置浏览器预览应用、截图、快照与 DOM 检查验证的机制描述。

### 3. Code 模式侧边栏新版 HashKey 架构适配 (Code Sidebar Navigation)
- **分组依据菜单**：适配官方 2.2553.13.0 新增标准 HashKey，补齐 `Group by` ➔ `分组依据`、`Custom groups` ➔ `自定义分组`；
- **排序下拉菜单**：补齐 `Date created` ➔ `创建日期`、`Last activity` ➔ `最近活动`。

### 4. 内置浏览器视窗与更多功能操作菜单 (Built-in Preview Browser)
- **视窗操作与外链**：汉化 `Open in {browserName}` ➔ `在 {browserName} 中打开`（自动适配系统默认浏览器名称）、`Open HTML file…` ➔ `打开 HTML 文件…`；
- **变更与存储设置**：汉化 `Auto-verify changes` ➔ `自动验证变更`、`Cookies` ➔ `Cookie`、`Clear browsing data` ➔ `清除浏览数据`；
- **地址栏与配置说明**：汉化 `Type a URL` ➔ `输入网址`、`Run a server to preview your app, or enter a URL.` 以及 `Edit this list in .claude/launch.json.`。

### 5. 定时任务全景页面与预设卡片汉化 (Scheduled Tasks)
- **页面空状态**：汉化 `No scheduled tasks yet.` ➔ `暂无定时任务。`；
- **预设任务全景卡片**：完整汉化 5 大预设任务标题与深度指引说明：
  - `Daily briefing` ➔ `每日简报`（汇总日历、邮件与即时通讯待办）；
  - `Weekly review` ➔ `每周回顾`（周五本周事项全景总结）；
  - `Content ideas` ➔ `内容灵感`（每周行业资讯灵感草稿）；
  - `Monitor a topic` ➔ `追踪特定主题`（新闻与关键词动态监测）；
  - 收件箱分类与紧急事项回复起草。

### 6. 会话记录、产物工具栏与项目空状态死角补齐 (UI Consistency)
- **会话默认项**：汉化 `Make {mode} the default` ➔ `将“{mode}”设为默认`（支持 ICU 动态模式插值）；
- **产物工具栏 Tooltips**：补齐 `Search your artifacts` ➔ `搜索您的产物`、`Grid view` ➔ `网格视图`、`List view` ➔ `列表视图`；
- **项目空状态与独立按钮**：补齐 `Looking to start a project?` ➔ `想要开始一个项目吗？`，并精准补齐空状态中央独立调用的 `New project` ➔ `新建项目`（消除组件不同 Key 导致的断层）。

---

## 🛡️ 工业级质量保障 (Quality Assurance)
- **词条总数**：全量有效校验词条数扩充至 **20,903 条**（Shell 705 + Ion 核心 20,150 + Dynamic 动态 48）；
- **ICU AST 防火墙**：全量变量名结构 100% 对齐，核心专有名词受保护；
- **兼容矩阵与沙盒测试**：100% PASS，包含还原闭环、版本防降级、出厂基线自愈与进程安全保护。

---

## 📦 安装与升级 (Installation & Upgrade)

### Windows 用户 (推荐快捷方式)
进入项目根目录，右键 **`install.bat`** ➔ 选择 **“以管理员身份运行”** 即可。

### 跨平台 CLI
```bash
# 检查当前安装与补丁状态
node cli.js status

# 安装或更新中文汉化补丁
node cli.js install

# 随时物理一键还原为官方出厂英文
node cli.js restore
```
