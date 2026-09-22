# Claude Chinese Toolkit v1.2.65 发布说明 (Release Notes)

🎉 本次版本针对最新升级的 **Claude Desktop v2.2553.13.0** 进行深层闭环清剿，彻底歼灭【定时任务】与【例行程序】核心下拉菜单中遗漏的 `Set up manually` 英文残留，并顺藤摸瓜将该模块核心渲染骨架中潜在的 **250 处深层暗堡词条一并全歼**，全库校验词条总数扩充至 **21,153 条**！

---

## 🚀 核心更新与修复细节 (Key Highlights & Fixes)

### 1. 定时任务下拉核心痛点斩首 (Zero Missing Dropdown)
- **手动设置选项**：精准补齐 `cPrOxQ4nP2` ➔ `Set up manually` 汉化为 **`手动设置`**，与 `使用 Claude 创建` 彻底对齐；
- **定时与重复**：汉化 `1rQBje0k5s` (`Schedule` ➔ **`定时`**)、`wJlbTdvZ2R` (`Repeats` ➔ **`重复`**)、`zJnjBGJ/n0` (`Manual only` ➔ **`仅手动`**)；
- **动作执行**：汉化 `v+MsvNCgFi` (`Run now` ➔ **`立即运行`**)、`2CmZLoU0AR` (`New run` ➔ **`新建运行`**)、`BktjB9Ihds` (`Starting task` ➔ **`正在启动任务`**)。

### 2. 调度周期与执行频率全枚举覆盖 (Frequency & Cadence)
- 完整汉化所有定时频率选项：
  - `wD8Ous9ZeJ`：`Hourly` ➔ **`每小时`**
  - `HraNOyuwOv`：`Daily` ➔ **`每天`**
  - `28mGU1EgCU`：`Weekdays` ➔ **`工作日`**
  - `VyMwPuhp0v`：`Weekly` ➔ **`每周`**

### 3. 任务与例行程序状态/设备标签 (Status & Devices)
- **运行状态**：汉化 `On hold` (已搁置)、`Paused` (已暂停)、`Auto-disabled` (自动禁用)、`Local` (本地)、`Scheduled time passed` (已过预定时间)；
- **计算机归属**：汉化 `Now runs in the cloud` (现在在云端运行)、`Only on this computer` (仅在此计算机上)、`This computer` (此计算机)、`Your computer` (您的计算机)、`Asleep or app closed` (处于休眠状态或应用已关闭)。

### 4. 底层错误、重试与解绑原因深度汉化 (Failure Explanations)
- 地毯式汉化因计算机休眠断开、组织禁用远程控制、订阅暂停、仓库授权失效、Slack 访问丢失等 **30 余种底层状态原因与警告弹窗**，杜绝任何突发英文报错。

---

## 🛡️ 工业级质量门禁 (Quality Assurance)
- **有效总词条数**：跃升至 **21,153 条**（Shell 705 + Ion 核心 20,400 + Dynamic 动态 48）；
- **ICU AST 防火墙**：全量 250 处新增词条语法结构、大括号对称与变量引用 100% PASS；
- **自动化回归测试**：还原闭环、防降级自愈、智能体会话自杀防御拦截 100% 绿灯。

---

## 📦 安装与使用 (Installation)

### Windows 用户 (极速安装)
进入项目根目录，右键 **`install.bat`** ➔ 选择 **“以管理员身份运行”** 即可。

> **💡 温馨提示**：在 Windows 控制台（cmd）运行期间，若鼠标不小心点击了黑色窗口导致出现 `选择 管理员:...` 文本冻结状态，只需按下 **空格键 (Space)** 或 **回车键 (Enter)** 即可立即解冻并飞速完成安装！
