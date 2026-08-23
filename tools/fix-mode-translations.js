/**
 * 修复工作流模式 (Manual / Accept edits / Plan) 词条
 */
const fs = require('fs');
const path = require('path');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));

console.log('正在修复工作流模式相关词条 (Manual, Accept edits, Plan)...');

// 1. 模式名称修复
ionZh['bEP1fZ8uSe'] = '手动';
ionZh['M59JhXXku8'] = '手动';

ionZh['q2/2k27Kto'] = '接受编辑'; // 原为“进行中”

ionZh['6m12Z4ECay'] = '计划';
ionZh['fz0z4cb6fQ'] = '计划';

// 2. 模式描述与相关提示补充
ionZh['uScJvDfyGZ'] = '在进行更改前始终询问';
ionZh['uAswEIOvGS'] = '自动接受所有文件编辑';
ionZh['OjKD8Jtn5k'] = '在做出更改前创建计划';

ionZh['dW5v+wt48j'] = '“绕过权限”不可用。会话已切换至“接受编辑”模式。';
ionZh['tJmxiop6z7'] = '以 root 运行时“绕过权限”不可用。会话已切换至“接受编辑”模式。';
ionZh['wXKZOb9LHX'] = '未启用“绕过权限”模式。会话已在“接受编辑”模式下启动——请在“设置”中启用“绕过权限”以使用它。';
ionZh['oZ/Kj/LQjX'] = 'Claude 可以在这些站点上使用其浏览器工具而无需权限提示。移除站点以再次收到提示。仅在“询问”和“接受编辑”模式以及金融站点上才会针对每个站点提示。';

fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2), 'utf8');
console.log('✅ 工作流模式词条修复完成！');
