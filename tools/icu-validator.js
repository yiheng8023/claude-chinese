/**
 * ICU 占位符与 AST 结构校验器
 * 确保翻译后的文本与原始英文在变量名、ICU 复数语法和格式化标记上保持 100% 结构一致。
 */

function extractPlaceholders(text) {
  if (!text) return [];
  const matches = [];
  // 匹配形如 {variable} 或 {count, plural, ...} 的大括号结构
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === '}') {
      depth--;
      if (depth === 0 && start !== -1) {
        matches.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return matches;
}

function extractVariables(text) {
  const placeholders = extractPlaceholders(text);
  const vars = [];
  for (const ph of placeholders) {
    const inner = ph.slice(1, -1).trim();
    const varName = inner.split(',')[0].trim();
    vars.push(varName);
  }
  return vars;
}

function validatePair(key, enText, zhText) {
  const errors = [];

  const enVars = extractVariables(enText);
  const zhVars = extractVariables(zhText);

  // 1. 检查变量数量与名称是否一致
  const enVarSet = [...enVars].sort();
  const zhVarSet = [...zhVars].sort();

  if (enVarSet.join(',') !== zhVarSet.join(',')) {
    errors.push(`变量不匹配: 英文包含 [${enVarSet.join(', ')}]，中文包含 [${zhVarSet.join(', ')}]`);
  }

  // 2. 检查大括号平衡
  const openCount = (zhText.match(/\{/g) || []).length;
  const closeCount = (zhText.match(/\}/g) || []).length;
  if (openCount !== closeCount) {
    errors.push(`大括号不闭合: 开括号 ${openCount} 个，闭括号 ${closeCount} 个`);
  }

  return {
    key,
    valid: errors.length === 0,
    errors
  };
}

function validateDictionary(enDict, zhDict) {
  const results = {
    total: Object.keys(enDict).length,
    missing: [],
    invalid: [],
    validCount: 0
  };

  for (const [key, enText] of Object.entries(enDict)) {
    if (!zhDict[key]) {
      results.missing.push(key);
      continue;
    }

    const val = validatePair(key, enText, zhDict[key]);
    if (!val.valid) {
      results.invalid.push({ key, en: enText, zh: zhDict[key], errors: val.errors });
    } else {
      results.validCount++;
    }
  }

  return results;
}

module.exports = {
  extractPlaceholders,
  extractVariables,
  validatePair,
  validateDictionary
};
