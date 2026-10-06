/**
 * Claude Desktop v2.19675.1.0 ➔ claude-chinese v1.2.74 一键同步与词库增量生成器
 */
const fs = require('fs');
const path = require('path');
const { extractVariables, validatePair } = require('./icu-validator');

const repoRoot = path.resolve(__dirname, '..');
const officialEnPath = 'C:\\Program Files\\WindowsApps\\Claude_2.19675.1.0_x64__pzs8sxrjxfjjc\\app\\resources\\en-US.json';
const localEnBasePath = path.join(repoRoot, 'dict/en-US.base.json');
const localZhPath = path.join(repoRoot, 'dict/zh-CN.json');
const ionZhPath = path.join(repoRoot, 'dict/ion-zh-CN.json');

console.log('=== 执行 v1.2.74 增量同步与全量词库校验 ===');

// 1. 同步外壳层 (Shell Layer)
if (fs.existsSync(officialEnPath)) {
  const officialEn = JSON.parse(fs.readFileSync(officialEnPath, 'utf8'));
  const localZh = JSON.parse(fs.readFileSync(localZhPath, 'utf8'));

  const shellNewTranslations = {
    "+n5D2xZZFm": "将为此计算机开启 Remote Control。",
    "7jWoL6f3Kl": "Claude 处于打开状态时，您其他设备上的会话可以按照您的批准设置，在您的 Remote Control 列表中的文件夹内读取和编辑文件以及运行命令。这些会话读取或运行的内容会发送给 Anthropic。您可以随时在设置中关闭此功能。",
    "8M0NdU+pKJ": "{count, plural, one {由 Claude Code 自动列出的其他 # 个文件夹将从该列表中移除；} other {由 Claude Code 自动列出的其他 # 个文件夹将从该列表中移除；}}您自行添加的文件夹会保留。您可以在设置中重新添加文件夹。",
    "ImJHPVqkfz": "从您的手机或 claude.ai 启动的会话可以按照您的审批设置，在此文件夹中读取和编辑文件以及运行命令。此电脑上的 Claude Code 也会将此文件夹视为受信任文件夹。",
    "UC4ufyu6D6": "允许",
    "Ur9IgNnVXB": "允许",
    "VmfBJuPPlH": "取消",
    "aZynSqBUGv": "{count, plural, one {无法从快速输入附加文件；将发送不含该文件的消息。} other {无法从快速输入附加 # 个文件；将发送不含这些文件的消息。}}",
    "cQEzKX5AfQ": "Claude Code",
    "jMRk/qAVDT": "{count, plural, one {无法从快速输入附加文件，因此未发送任何内容。请检查该文件是否仍在原位置，且为小于 {maxFileMb} MB 的文件。} other {无法从快速输入附加 # 个文件，因此未发送任何内容。请检查这些文件是否仍在原位置，且每个都是小于 {maxFileMb} MB 的文件。}}",
    "jO7VoK4TtU": "新建侧边对话",
    "kae00Hq579": "更新 Claude 以在此电脑上使用此模型。",
    "lgdk9O3SjM": "此电脑上的 Claude Code 也会将此文件夹视为受信任文件夹。",
    "sVuKeGaV54": "要通过您的手机和 claude.ai 使用此文件夹吗？",
    "uc60dif05B": "允许云端会话无需询问即可在这台电脑上运行命令？",
    "x9PJxSK6R7": "在自动模式下，来自您云端会话的命令将在这台电脑上运行，不会每次都询问您。您在这台电脑上的拒绝规则和钩子仍然适用。您之后可以在设置 › Claude Code 中更改此项。"
  };

  for (const [k, zhText] of Object.entries(shellNewTranslations)) {
    const enText = officialEn[k];
    const res = validatePair(k, enText, zhText);
    if (!res.valid) {
      console.error(`Shell validation failed for key [${k}]:`, res.errors);
      process.exit(1);
    }
  }

  Object.assign(localZh, shellNewTranslations);
  fs.writeFileSync(localEnBasePath, JSON.stringify(officialEn, null, 2) + '\n', 'utf8');
  fs.writeFileSync(localZhPath, JSON.stringify(localZh, null, 2) + '\n', 'utf8');
  console.log(`✅ 外壳层词典同步就绪 (基线: ${Object.keys(officialEn).length}, 中文: ${Object.keys(localZh).length})`);
}

// 2. 同步 Web UI 核心层 (Ion-Dist Layer)
const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));
const webUiNewTranslations = {
  "0Q6cBdCwQw": "此{principalType, select, account {成员} other {群组}}在组织设置内，可在其所有角色中使用的模型。应用所有角色中最宽松的最大推理强度。",
  "0jxIskqsal": "一个或多个角色允许的最大推理强度高于组织对此模型的上限。请先在“编辑角色”中调低相应角色的推理强度。",
  "9+k8XLt2Sy": "最大推理强度消耗限制的速度快于高。请考虑使用较低的推理强度设置。",
  "Eq3lBkf43x": "默认推理强度",
  "LkXLnNET1T": "{level}推理强度",
  "LxWam2PPgj": "{model}的最大推理强度",
  "Oy3oQOfwwv": "角色的最大推理强度不能高于组织对此模型设定的上限。请刷新以查看组织当前的上限，然后重新打开角色并调低。",
  "S69zNbS5XI": "新会话将以此模型和推理强度开始。",
  "TEMHD/BX6K": "{count, plural, one {{modelNames} 的最大推理强度高于组织对此模型的上限。} other {{modelNames} 的最大推理强度高于组织对这些模型的上限。}}",
  "YdsHguLtpn": "Anthropic 默认推理强度",
  "a+rpXedXjS": "推理强度",
  "dGSHpoNF0M": "选择特定模型与推理强度",
  "eqD0OXlTsj": "高于此模型的最大推理强度",
  "ezwbSlCw/u": "{count, plural, one {{roleNames} 允许此模型使用更高的最大推理强度。请先在“编辑角色”中调低该角色的推理强度。} other {{roleNames} 允许此模型使用更高的最大推理强度。请先在“编辑角色”中调低这些角色的推理强度。}}",
  "fVnZ7QfpN+": "默认推理强度高于此模型的最大推理强度。",
  "h9ToPBnGNn": "选择您的组织可以使用的模型，以及它们可以运行的最高推理强度。设置最大推理强度为可选。<pricingLink>查看模型性能与定价</pricingLink>",
  "hLJA0TKR+D": "{count, plural, one {{modelNames} 的最大推理强度高于组织对此模型的上限。在此处调低，或在“模型”中提高上限。} other {{modelNames} 的最大推理强度高于组织对这些模型的上限。在此处调低，或在“模型”中提高上限。}}",
  "mQXTW9PIDv": "默认推理强度高于此模型的最大推理强度。请选择较低级别。",
  "qFC4jUT3O8": "最大推理强度",
  "tPOnof3K+b": "使用 Anthropic 默认推理强度",
  "thTO/OxW5g": "默认推理强度高于此模型的最大推理强度。请选择较低级别，或在“模型访问”中提高上限。",
  "y1DgjW4R2j": "{modelName}的最大推理强度",
  "yEACNdzLP2": "适用于每种产品的固定默认模型和推理强度。发布新模型时不会更改。",
  "z7VbR5tywS": "/fork 命令后不能带有 @-提及、其他斜杠命令、链接或行内格式，因此未发送任何内容。请将其移除。",
  "DvtBqCsgFE": "分支：读取",
  "EQ1SSulZYV": "当 Claude 向分支推送更改时，它会自动开启拉取请求 (PR) 而无需事先询问。仅适用于云端会话。",
  "N0HKBUC+wL": "进行更改将在对话中创建一个新分支。",
  "Pxh6/vjfZR": "{branch} (当前)",
  "TF/CdEwTEv": "会话及其对话将被保留。已提交的工作保留在其分支上。",
  "UH0JCRCkNG": "已提交的工作保留在其分支上。",
  "hIKVkyDob/": "这是一个细粒度令牌。同步您要同步的项目需要三项权限：Project: Read、Branch: Read 和 Repository: Read。",
  "n4nWD6rGza": "选择要在本次对话中关联的仓库和分支",
  "security/scan_scope_not_found": "此项目扫描范围内的目录不在所选分支上，因此没有任何可扫描内容。您可以选择包含该目录的分支、推送到此分支，或使用其他目录创建新项目。",
  "ueb6I/aqiQ": "无匹配分支",
  "xMN2WXVnzr": "个人、群组或项目访问令牌。旧版令牌至少需要 read_api 范围；细粒度令牌需要 Project: Read、Branch: Read 和 Repository: Read。拥有 api 范围 (旧版) 或 Webhook: Create and Delete (细粒度)，加上 Maintainer 角色，Claude 还可以自动设置推送 Webhook 以实现自动同步。存储已加密且不再显示。",
  "BeP+DnA30j": "审查差异并创建 PR",
  "dwQbNmYqs4": "无法渲染此差异",
  "/7/awkVHU7": "搜索",
  "+8k7qViPUD": "撰写邮件",
  "+AJIqlMk8E": "{group}: {name}",
  "+Ttx1MIhK8": "上一张幻灯片",
  "+uG4iJ63bM": "查看邀请",
  "/Fj2X8VOff": "打开 {channel}",
  "/HL/OPL2zK": "安装 {name}",
  "/HtPOcq/Mi": "重试同步",
  "/MJguiWvE7": "已读 · {count}",
  "/aDI296rHX": "吸管",
  "/fkwgvMqwp": "已保存到记忆",
  "/flqN3O6XS": "平滑度",
  "/jd9eE01Ei": "单元格",
  "/y7g74Konx": "其他主题",
  "0+KDB8zrSP": "促销",
  "0157BOlkJ4": "向外共享",
  "0GkRldPjYS": "收件箱管理",
  "0JZRKp4xP7": "运行于",
  "0K4S87upoI": "默认高度",
  "0KKXrHbU/8": "预算",
  "0V+pFyzdJz": "已标记",
  "0YcbKF75wc": "创建于 {when}",
  "0fC4eH/+Bw": "未标记",
  "0fQq/7/vsI": "授权已暂缓",
  "0fgAjWlP+l": "获取加载项",
  "0h9Fh2DHim": "月末结算",
  "0hD7mUGuvX": "恢复定时计划",
  "0hHYrDrHF0": "{label}:",
  "0jkWJib8YP": "额度已应用",
  "0sYAACzsEj": "评论卡片",
  "+0IuSiJihi": "这将保存插件 {pluginName} 的新版本，并将 {skillName} 替换。与您共享该插件的任何人也将获得新版本。早期版本仍可在插件的版本历史中查看。",
  "+2pQrcda/p": "仅在您组织中拥有 Claude 账户的 Slack 用户可以使用 Claude。关闭时，Slack 工作区中的任何人都可以使用。",
  "+2traRynFJ": "无法确认此学校。请仔细检查学校详情并重试。",
  "+5aPjJ+qY4": "付款还会为您所在的组织开启使用积分。",
  "+AXwD7C7aM": "您的网络设置阻止了此网站。请在<link>设置</link>中允许它。",
  "+AcRXuhwKS": "无法保存更改。您可能不再拥有访问此频道设置的权限。",
  "+CpGAcZOJ8": "技能已保存，但无法在此处加载。请重新加载页面以查看它。",
  "+CrkrGjzsm": "连接后，立即运行 {kind, select, task {任务} other {例行任务}} 或为其安排新的时间。"
};

Object.assign(ionZh, webUiNewTranslations);
fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2) + '\n', 'utf8');
console.log(`✅ Web UI 核心层词典同步就绪 (总词条数: ${Object.keys(ionZh).length})`);
console.log('🎉 全部字典同步与本地化注入完成！');
