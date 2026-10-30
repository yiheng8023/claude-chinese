const assert = require('node:assert/strict');
const vm = require('node:vm');
const { patchShellLocale } = require('../core/shell-locale');

// The main-process IPC catalog must accept Chinese after upstream renames symbols.
for (const name of ['fwt', 'DTt', '$newMap_42']) {
  const source = `var ${name}={en:"en-US",de:"de-DE",fr:"fr-FR",id:"id-ID"};` +
    `var accepted=new Set(Object.values(${name}));var fallback="en-US";` +
    'function getInitialLocale(system){return accepted.has(system)?system:fallback}';
  const patched = patchShellLocale(source);
  assert.equal(patched.mapCount, 1);
  const context = vm.createContext({});
  vm.runInContext(patched.content, context);
  assert.equal(context.getInitialLocale('zh-CN'), 'zh-CN');
  assert.equal(context.getInitialLocale('fr-FR'), 'fr-FR');
  assert.equal(context.getInitialLocale('unknown'), 'en-US');
  assert.equal(patchShellLocale(patched.content).content, patched.content);
}
const unrelated = 'const settings={en:"en-US",secret:"not a locale map"};';
assert.equal(patchShellLocale(unrelated).content, unrelated);
assert.equal(patchShellLocale(unrelated).mapCount, 0);
console.log('PASS: shell locale selection survives symbol renaming and preserves English fallback');
