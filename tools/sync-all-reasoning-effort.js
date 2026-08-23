/**
 * 全局同步与锁定“推理强度”权威体系 (Sync Reasoning Effort Standard)
 */
const fs = require('fs');
const path = require('path');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const dynZhPath = path.join(__dirname, '../dict/dynamic-zh-CN.json');

const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));
const dynZh = JSON.parse(fs.readFileSync(dynZhPath, 'utf8'));

console.log('=== 全局同步与锁定“推理强度”权威术语体系 ===\n');

// 1. Dynamic 字典全量对齐
dynZh['VKZ/U8vAsk'] = '推理强度';
dynZh['HoZQmASaw3'] = '极高';
dynZh['Zk4EtKw26K'] = '最高';
dynZh['Xft0R8xbIB'] = '低';
dynZh['U0mtsR78v2'] = '中等';
dynZh['Xads8RoR+/'] = '默认';
dynZh['vv9L/MN3/H'] = '高';
dynZh['dapWFrcWv4'] = '更高的推理强度意味着更详尽深入的回答，但耗时更长且更快消耗使用额度。';

// 2. Ion-Dist 字典全量对齐
ionZh['VKZ/U8vAsk'] = '推理强度';
ionZh['EYOanHZfsA'] = '打开推理强度选择器';
ionZh['iEfZH5cyl6'] = '关于推理强度';
ionZh['pFMU2mFHxt'] = '关于推理强度级别';
ionZh['3EaeMr9hCZ'] = '更改推理强度？';
ionZh['l713aZ7Oim'] = '允许的最高推理强度级别';
ionZh['zJgTnkFmfK'] = '模型访问权限和最高推理强度级别';
ionZh['TRhvKflygs'] = '更高的推理强度意味着更详尽深入的回答，但耗时更长且更快消耗使用额度。';
ionZh['dapWFrcWv4'] = '更高的推理强度意味着更详尽深入的回答，但耗时更长且更快消耗使用额度。';
ionZh['2AytZgJTCj'] = '，最高推理强度 {cap}，按右箭头更改';
ionZh['7WkvzNBqWd'] = '最高推理强度可能会消耗过多 Token 导致触及限额。建议考虑使用较低的推理强度设置。';
ionZh['Inr/xtNSsX'] = '更高的推理强度可发现更多内容，但耗时更长且成本更高。';
ionZh['uYLQ5lDLZu'] = '使用模型选择器旁的滑块选择推理强度';
ionZh['waSR82Iwd2'] = '无法应用推理强度的更改。你可以重试。';
ionZh['zELfAL6AAI'] = '你的下一次回复会更慢，并使用更多 Token。此任务已按当前推理强度级别缓存。切换到 <bold>{targetLabel}</bold> 表示在你下一条消息时会重新读取完整历史记录。';

ionZh['477I0ggSYe'] = '低';
ionZh['ovJ26CKo4Q'] = '中等';
ionZh['AxMhQrcUDC'] = '高';
ionZh['kDEj60CmLq'] = '极高';
ionZh['HoZQmASaw3'] = '极高';
ionZh['kkjl2vQekD'] = '最高';
ionZh['Zk4EtKw26K'] = '最高';

fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2), 'utf8');
fs.writeFileSync(dynZhPath, JSON.stringify(dynZh, null, 2), 'utf8');

console.log('✅ “推理强度”体系已 100% 全局同步锁定！');
