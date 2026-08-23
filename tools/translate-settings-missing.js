/**
 * 补全设置、导入导出、技能、连接器等新增界面的漏翻词条
 */
const fs = require('fs');
const path = require('path');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));

console.log('正在注入设置、技能、连接器、导入导出等漏翻词条...');

const translations = {
  // 图 1: 导入与导出
  'ZbqbfcKDqr': '导入与导出',
  'r3JVDltSqg': '此部署未启用导入。请联系你的组织管理员以将其开启。',
  'u9wPpcCpZw': '正在导入…',
  'vpuUlCJOSA': '无法移除导入',
  'w10D7LtfJj': '导入的项目将显示为 Space 空间。导入是一次性复制：此处的更改不会同步到 claude.ai，且除非再次导入，否则不会显示新的 claude.ai 活动。',
  'wmQ9uu+fDD': '你的 claude.ai 导出文件未成功导入',
  'xVu+C0rCcm': '移除此导入？',
  'y6zrr8IS0Y': '来自 claude.ai 的 .zip 文件，通常命名为 data-export-*.zip',
  'yLDwMzbiJ9': '会话是复制而非移动——你的原始历史记录保留在原地，重新导入不会产生重复项。',
  'zWvD2Koc0f': '数据导出对你的组织不可用。',
  'zfiAjwZO0V': '调试导出对此共享会话不可用。',

  // 图 2: 技能面板
  'YYwHHUrOE/': '添加技能以扩展 Claude 的功能。<link>了解更多</link>',
  'Yxz9KpHFda': '添加技能以扩展 Claude 的功能。',
  'wLV+30Gduy': '保存前请在 SKILL.md 中编写你的技能指令。',
  'wvvIc+aDc5': '技能可能包含可执行代码。使用来自未知来源的技能时请保持谨慎。',
  'wkLubrQz2W': '尝试使用其他搜索词，或浏览目录以查找新技能。',
  'xXYwIf5hTy': '为 {orgName} 替换“{skillName}”？',
  'y486fMBVj/': '允许用户创建的技能',
  'yoBlUheoyQ': '无法加载技能详情。',
  'zEEXCp9GmE': '此名称属于 Anthropic 提供的技能，因此无法被替换。请为该技能指定其他名称。',
  'zHk65p70ot': '移除技能？',

  // 图 3: 连接器面板与状态
  '/DzlBdKphm': '在会话中连接',
  'Mt0MsVHd5T': '在任务中连接',
  '95MkOWx8uw': '由 {pluginName} 插件提供',
  'SINOsFd8Yc': '由 <link>{pluginName}</link> 插件提供',
  '8nlVU8Rqkw': '此连接器由插件提供，并在你使用时连接。',
  'vJdHypyQtY': '验证连接器',
  'vcwg+TScpi': '自定义连接器',
  'wIZFIV6YhG': '热门连接器',
  'wHBVPNl6wJ': '无法加载连接器目录。请检查你的网络连接并重试。',
  'wRB/TDfAx4': '此连接器需要 OAuth 客户端凭据。请从设置中的“连接器”页面添加它，然后在此处选择它。',
  'wqu/GDgmZD': '此连接器不使用身份验证。你可以在连接器设置中阻止个别工具。',
  'x37bl481O0': '专为教师打造的 Claude 即将推出，配备教学技能和教育工作者专属连接器。',
  'y/uNbJDO4d': '我们目前在连接此连接器时遇到问题。请重试。',
  'yZawy7pg6x': '无法加载组织连接器限制。连接器显示的访问权限可能高于实际生效的权限。',
  'yrVdUWWBG2': '允许用户与组织内的其他人分享使用连接器的对话。接收者可以看到 Claude 的回答，但无法看到来自连接器的数据。',
  'u7aJDHLfPB': '此连接器无需登录即可使用。请使用“连接”来添加它。',
  'vlUCfO++rc': '实时产物 {artifactId} 使用了你尚未设置的连接器：',
  'vpaTLU73fn': '此插件使用了未为你的组织启用的连接器。请添加它们以使你的团队可以使用此插件。',
  'vPQnl5r2sD': '此处的更改会影响用户如何找到你的服务器。连接器 URL 和身份验证设置由 Anthropic 管理——请联系 {email} 进行更改。',
  'xj2IprR/xx': '你提交到连接器目录的 MCP 服务器。审核通过后，已批准的服务器将出现在 <dirLink>claude.ai/directory</dirLink> 供其他 Claude 组织安装。<docsLink>了解更多</docsLink>',
  'xzrUaa7TWR': '托管登录到 {appName} 失败——你可以从连接器设置中使用自己的账户进行连接。',

  // 插件与市场相关
  'wJdKu4JyRk': '添加此插件以试用',
  'wKar6PFb0H': '从你的组织中移除“{name}”？成员将不再看到来自此来源的插件。你稍后可以重新添加。',
  'wdyYavmamP': '插件已移除。',
  'wqeYXFSxAA': '你的组织尚未提供插件。请联系你的组织管理员以添加它们。',
  'uBenVaBX8d': '此仓库不是市场——在 .claude-plugin/marketplace.json 未找到清单。请确保添加的是市场仓库，而不是插件或无关仓库。',
  'yCVRiEnn9v': '安装或使用插件前，请确保你信任该插件。上传的插件不受 Anthropic 控制，Anthropic 无法验证它们是否能按预期工作。有关详细信息，请参见每个插件的主页。',
  'z0i3zxxwoQ': '无法加载此插件的完整详情。在加载完成前无法添加——请稍后重试。'
};

let count = 0;
for (const [k, v] of Object.entries(translations)) {
  ionZh[k] = v;
  count++;
}

fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2), 'utf8');
console.log(`✅ 成功注入 ${count} 条设置、技能、插件、连接器与导入导出汉化词条！`);
