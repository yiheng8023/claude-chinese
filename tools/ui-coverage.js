/** Source-bound UI message inventory. A scoped review, never a whole-app percentage. */
const crypto = require('node:crypto');
const acorn = require('acorn');
const { validatePair } = require('./icu-validator');
const { parse: parseIcu } = require('@formatjs/icu-messageformat-parser');

const hash = source => crypto.createHash('sha256').update(source).digest('hex');
function staticText(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'TemplateLiteral' && !node.expressions.length) return node.quasis[0].value.cooked;
  return null;
}
function walk(ast, visit) {
  const stack = [ast];
  while (stack.length) {
    const node = stack.pop();
    visit(node);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) stack.push(child);
      } else if (value?.type) stack.push(value);
    }
  }
}
function collectMessages(source, catalog = {}) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true });
  const messages = new Map();
  function add(id, english) {
    if (!id || typeof english !== 'string') throw Error('Invalid source message');
    if (messages.has(id) && messages.get(id) !== english) throw Error(`Conflicting source message: ${id}`);
    if (Object.hasOwn(catalog, id) && catalog[id] !== english) throw Error(`Catalog/source disagreement: ${id}`);
    messages.set(id, english);
  }
  walk(ast, node => {
    // Real descriptors can be missing from the upstream English catalog.
    if (node.type === 'ObjectExpression') {
      const props = new Map(node.properties.filter(p => p.type === 'Property' && !p.computed)
        .map(p => [p.key.name ?? staticText(p.key), p.value]));
      const id = staticText(props.get('id')), english = staticText(props.get('defaultMessage'));
      if (english !== null) {
        if (id === null) throw Error('Unkeyed defaultMessage requires scoped UI review');
        add(id, english);
      }
    }
    const id = staticText(node);
    if (id !== null && Object.hasOwn(catalog, id)) add(id, catalog[id]);
  });
  return Object.fromEntries([...messages].sort(([a], [b]) => a.localeCompare(b, 'en')));
}

function markupSignature(text) {
  const parts = [];
  function visit(nodes, scope = '', parents = []) {
    for (const node of nodes) {
      if (node.type === 8) {
        const next = [...parents, node.value];
        parts.push(JSON.stringify([scope, next]));
        visit(node.children, scope, next);
      }
      if (node.options) for (const [key, option] of Object.entries(node.options)) {
        // Chinese needs only "other" for cardinal plurals, plus exact branches.
        if (node.type !== 6 || key === 'other' || key.startsWith('=')) visit(option.value, `${scope}/${node.value}:${key}`, parents);
      }
    }
  }
  visit(parseIcu(text, { ignoreTag: false }));
  return parts.sort().join('\n');
}

function validateReview(review, translated) {
  if (!review.sourceFiles?.length || !Object.keys(review.messages || {}).length) throw Error('Empty UI review');
  const referenced = new Set();
  for (const file of review.sourceFiles) {
    if (!/^assets\/v1\/[^/]+\.js$/.test(file.file) || !/^[a-f0-9]{64}$/.test(file.sha256) || !file.ids?.length) throw Error('Invalid UI source scope');
    for (const id of file.ids) referenced.add(id);
  }
  for (const [id, record] of Object.entries(review.messages)) {
    if (!referenced.delete(id)) throw Error(`Unreferenced UI review message: ${id}`);
    if (!Object.hasOwn(translated, id)) throw Error(`Missing UI translation: ${id}`);
    const text = translated[id];
    if (typeof text !== 'string' || !text.trim()) throw Error(`Empty UI translation: ${id}`);
    const pair = validatePair(id, record.english, text);
    if (!pair.valid) throw Error(`Invalid UI translation ${id}: ${pair.errors.join('; ')}`);
    if (text === record.english && !record.retainReason?.trim()) throw Error(`Unreviewed English fallback: ${id}`);
    if (text !== record.english && record.retainReason) throw Error(`Obsolete English exception: ${id}`);
    let visible = '';
    const nodes = [...parseIcu(text, { ignoreTag: true })];
    while (nodes.length) {
      const node = nodes.pop();
      if (node.type === 0) visible += node.value;
      if (node.options) for (const option of Object.values(node.options)) nodes.push(...option.value);
      if (node.children) nodes.push(...node.children);
    }
    if (!record.retainReason && !record.nonChineseReason && /\p{L}/u.test(visible) && !/\p{Script=Han}/u.test(visible)) {
      throw Error(`Unreviewed non-Chinese UI translation: ${id}`);
    }
    let originalMarkup;
    try { originalMarkup = markupSignature(record.english); } catch { /* Literal technical tokens such as <uuid>. */ }
    if (originalMarkup !== undefined) {
      let translatedMarkup;
      try { translatedMarkup = markupSignature(text); } catch { throw Error(`UI markup invalid: ${id}`); }
      if (originalMarkup !== translatedMarkup) throw Error(`UI markup changed: ${id}`);
    } else {
      const tags = value => [...value.matchAll(/<\/?[A-Za-z][\w-]*\s*\/?>/g)].map(m => m[0]).sort().join('|');
      if (tags(text) !== tags(record.english)) throw Error(`UI literal tokens changed: ${id}`);
    }
  }
  if (referenced.size) throw Error(`Unreviewed source messages: ${[...referenced].slice(0, 5).join(', ')}`);
  return { modules: review.sourceFiles.length, messages: Object.keys(review.messages).length,
    retainedEnglish: Object.values(review.messages).filter(x => x.retainReason).length };
}
function validateSources(review, readSource, catalog) {
  for (const record of review.sourceFiles) {
    const source = readSource(record.file);
    if (hash(source) !== record.sha256) throw Error(`UI source changed; review required: ${record.file}`);
    const actual = collectMessages(source, catalog);
    const ids = Object.keys(actual).sort();
    if (JSON.stringify(ids) !== JSON.stringify([...record.ids].sort())) throw Error(`UI message set changed: ${record.file}`);
    for (const [id, english] of Object.entries(actual)) {
      if (review.messages[id]?.english !== english) throw Error(`UI message changed: ${id}`);
    }
  }
}
module.exports = { collectMessages, validateReview, validateSources, hash };
