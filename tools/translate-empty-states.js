/**
 * 注入连接器空白态引导及高频界面空状态词条
 */
const fs = require('fs');
const path = require('path');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));

console.log('正在注入连接器空白态引导及高频空状态词条...');

const batchTranslations = {
  // 用户最新截图中的连接器空白态引导
  '7hng1JcsbU': '连接你团队的工具，解锁 Claude 的更多潜能。<link>了解更多</link>',

  // 常见空白态与空列表
  '/Mv5EgfQ/0': '此项目中尚无文件',
  '/YM9FZ0d0p': '尚无分组。分组可让管理员一次为多位成员分配相同角色。',
  '1n84bD3e9J': '没有匹配“{search}”的成员。',
  '2A8U5xflLL': '没有匹配的文件。',
  '2ZpsMlzJ+h': '暂无成员',
  '2imyRJj1En': '此处没有可推荐的连接器。请浏览全部以查找，或继续操作。',
  '2vHRPu8DQ1': '未连接任何 GitHub App 安装。',
  '+SixL9gZEo': '在目前加载的频道中未找到匹配项。',

  // 常见重试与失败提示
  '+eSHJVUYuV': '无法发送你的请求。请重试。',
  '+mWkyd8TPj': '无法忽略该请求。请重试。',
  '+skq8xGva/': '无法添加该技能。请重试。',
  '/8e0dnRw0I': '出现问题。请稍后重试。',
  '/LdcqSrt0d': '无法移除部分分组支出限额。请重试。',
  '0Uz3+Ds9vL': '无法保存项目设置。请从项目设置中重试。',
  '0sTSw3aePz': '无法开始录制。请重试。',
  '0wgreI27UH': '无法开始聊天。请重试。',
  '13cI4hZRf5': '无法加载分配给你的频道。请重试。',
  '162kF7agK1': '请稍后重试。',
  '1AoInAm51s': '无法复制会话 ID。请重试。',
  '1dXeDZHdnM': '无法卸载该插件。请重试。',
  '1fRYbb5YXw': '无法分析该证书。请重试。',
  '2jQRpDRw/X': '无法移除该仓库。请重试。',
  '2FpF0GgCOs': '请在每周限额重置后重试。',

  // 引导与说明链接
  '/79dwa2C+/': '启用企业合规 API 访问以审计你组织的数据。<learnMoreLink>了解更多</learnMoreLink>',
  '/9X+FWRSSe': '使用额度来支付超出套餐限额的使用量，以及用于拥有独立限额的产品（如 Claude Design）。<link>了解更多</link>',
  '/Ya5z/8UtM': '每位团队成员的 Claude 都能记住他们过去对话中的上下文。记忆对每个人保持私密。<a>了解更多</a>',
  '/uNRZlm2Pe': '社区连接器经过了自动化审查，但未经 Anthropic 官方验证。我们无法控制其提供的工具，也无法保证它们能按预期工作或不发生变化，因此请仅连接你信任的开发者。<a>了解更多</a>。',
  '14c/QurJSL': '你提交到 <dirLink>目录</dirLink> 的 Claude Code 和 Cowork 插件。审核通过的插件可供任何人在市场中安装。<docsLink>了解更多</docsLink>',
  '1YUA7DnK8J': '未通过远程控制连接到 {machineName}。<link>了解更多</link>'
};

let count = 0;
for (const [k, v] of Object.entries(batchTranslations)) {
  ionZh[k] = v;
  count++;
}

fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2), 'utf8');
console.log(`✅ 成功注入 ${count} 条连接器空白态引导与空状态词条！`);
