/**
 * 精修推理强度梯度档位与 Tooltip 提示
 * Extra -> 极高, Max -> 最高
 */
const fs = require('fs');
const path = require('path');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const dynZhPath = path.join(__dirname, '../dict/dynamic-zh-CN.json');

const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));
const dynZh = JSON.parse(fs.readFileSync(dynZhPath, 'utf8'));

console.log('正在将推理强度档位精修为标准体系 (Extra -> 极高, Max -> 最高)...');

// 1. Dynamic 字典修复
dynZh['HoZQmASaw3'] = '极高'; // 原为“额外” (Extra)
dynZh['Zk4EtKw26K'] = '最高'; // 原为“最大” (Max)
dynZh['dapWFrcWv4'] = '更高的推理强度意味着更详尽深入的回答，但耗时更长且更快消耗限额。'; // 原为“更高努力程度...”

// 2. Ion-Dist 字典修复
ionZh['HoZQmASaw3'] = '极高';
ionZh['kDEj60CmLq'] = '极高'; // Extra high
ionZh['kkjl2vQekD'] = '最高'; // Max
ionZh['Zk4EtKw26K'] = '最高';
ionZh['dapWFrcWv4'] = '更高的推理强度意味着更详尽深入的回答，但耗时更长且更快消耗限额。';
ionZh['TRhvKflygs'] = '更高的推理强度意味着更详尽深入的回答，但耗时更长且更快消耗限额。';

fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2), 'utf8');
fs.writeFileSync(dynZhPath, JSON.stringify(dynZh, null, 2), 'utf8');

console.log('✅ 推理强度梯度档位 (低/中等/默认/极高/最高) 与 Tooltip 精修完成！');
