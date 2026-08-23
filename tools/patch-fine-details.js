/**
 * 精修全局审查中的细节词条
 */
const fs = require('fs');
const path = require('path');

const ionZhPath = path.join(__dirname, '../dict/ion-zh-CN.json');
const ionZh = JSON.parse(fs.readFileSync(ionZhPath, 'utf8'));

// 补充与精校
ionZh['+C7l1yrItc'] = '免费赠送 {months, plural, one {# 个月} other {# 个月}} 的代码审查';
ionZh['+PRwBNUcn5'] = '仅“{orgName}”组织中的用户可以访问你分享的产物。此产物变更时，新版本将自动分享。';
ionZh['12jwPv5yxF'] = '无法重命名环境。请重试。';
ionZh['/dodrm2bvQ'] = '编辑并重试';
ionZh['+FN/DNHm9C'] = '已从目录中取消发布';
ionZh['+qUeKxfyK9'] = '没有匹配的项目';

fs.writeFileSync(ionZhPath, JSON.stringify(ionZh, null, 2), 'utf8');
console.log('✅ 细节词条精校完成！');
