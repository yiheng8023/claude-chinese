/**
 * 将 Effort（原机翻为“工作量/努力程度”）全面修正为标准的“推理强度”
 */
const fs = require('fs');
const path = require('path');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));

console.log('正在将 Effort 全面更正为标准的“推理强度”...');

// 1. 核心词条更正
ionZh['VKZ/U8vAsk'] = '推理强度'; // 原为“工作量”
ionZh['EYOanHZfsA'] = '打开推理强度选择器';
ionZh['iEfZH5cyl6'] = '关于推理强度';
ionZh['pFMU2mFHxt'] = '关于推理强度级别';
ionZh['3EaeMr9hCZ'] = '更改推理强度？';
ionZh['l713aZ7Oim'] = '允许的最高推理强度级别';
ionZh['zJgTnkFmfK'] = '模型访问权限和最高推理强度级别';

// 2. 提示与描述文本更正
ionZh['TRhvKflygs'] = '更高的推理强度意味着更详尽深入的回答，但耗时更长且更快消耗限额。';
ionZh['2AytZgJTCj'] = '，最大推理强度 {cap}，按右箭头更改';
ionZh['7WkvzNBqWd'] = '最大推理强度可能会消耗过多 Token 导致触及限额。建议考虑使用较低的推理强度设置。';
ionZh['Inr/xtNSsX'] = '更高的推理强度可发现更多内容，但耗时更长且成本更高。';
ionZh['uYLQ5lDLZu'] = '使用模型选择器旁的滑块选择推理强度';
ionZh['waSR82Iwd2'] = '无法应用推理强度的更改。你可以重试。';
ionZh['zELfAL6AAI'] = '你的下一次回复会更慢，并使用更多 Token。此任务已按当前推理强度级别缓存。切换到 <bold>{targetLabel}</bold> 表示在你下一条消息时会重新读取完整历史记录。';

// 3. 欢迎标语与空状态
ionZh['y1XRP1BJQF'] = '一切就绪！'; // 原为 missing 的 "You’re here!"

fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2), 'utf8');
console.log('✅ Effort 推理强度与相关词条修正完成！');
