/**
 * 修复审计发现的各项问题
 */
const fs = require('fs');
const path = require('path');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));

console.log('正在修复 1M 上下文规格与审计问题...');

// 1. 修复 1M 误翻为 1个月
ionZh['1uz/I31pXU'] = '1M';

// 2. 修复 qI54ltfccK 串词
ionZh['qI54ltfccK'] = '删除并重新添加连接器以编辑自定义 OAuth 客户端 ID。';

// 3. 修复 0gPrDsqmMz span 标签错位
ionZh['0gPrDsqmMz'] = '<span1>正在以身份加入：</span1> <span2>{email}</span2>';

fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2), 'utf8');
console.log('✅ dict/ion-zh-CN.json 修复完成！');
