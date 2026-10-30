const { parse } = require('@formatjs/icu-messageformat-parser');

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
  const vars = [];
  function walk(nodes) {
    for (const node of nodes) {
      if (node.type >= 1 && node.type <= 6) vars.push(node.value);
      if (node.options) for (const [selector, option] of Object.entries(node.options)) {
        if (node.type !== 6 || selector === 'other' || selector.startsWith('=')) walk(option.value);
      }
      if (node.children) walk(node.children);
    }
  }
  walk(parse(text || '', { ignoreTag: true }));
  return [...new Set(vars)];
}

function signature(text) {
  const parts = [];
  function walk(nodes, scope = '') {
    for (const node of nodes) {
      if (node.type >= 1 && node.type <= 6) {
        const selectors = node.options ? Object.keys(node.options).filter(key => node.type !== 6 || key === 'other' || key.startsWith('=')).sort() : null;
        parts.push(JSON.stringify([scope, node.value, node.type, node.offset || 0, selectors, node.style || null]));
      }
      if (node.options) for (const [selector, option] of Object.entries(node.options)) {
        if (node.type !== 6 || selector === 'other' || selector.startsWith('=')) walk(option.value, `${scope}/${node.value}:${selector}`);
      }
      if (node.children) walk(node.children, scope);
    }
  }
  walk(parse(text, { ignoreTag: true }));
  return [...new Set(parts)].sort().join('\n');
}

function validateSyntax(text) {
  try { parse(text, { ignoreTag: true }); return { valid: true, errors: [] }; }
  catch (error) { return { valid: false, errors: [error.message] }; }
}

function validatePair(key, enText, zhText) {
  const errors = [];

  try {
    if (signature(enText) !== signature(zhText)) errors.push('ICU 变量、格式类型或选择分支不匹配');
  } catch (error) { errors.push(`ICU 语法错误: ${error.message}`); }

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
  validateSyntax,
  validateDictionary
};
