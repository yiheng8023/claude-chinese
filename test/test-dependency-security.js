const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { setImmediate: nextTurn } = require('node:timers/promises');

// Resolve the copies ASAR actually loads, including glob's own minimatch.
const fromAsar = createRequire(require.resolve('@electron/asar'));
const fromGlob = createRequire(fromAsar.resolve('glob'));
const { glob } = fromAsar('glob');

async function checkCancellation() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-glob-abort-'));
  let pending = 0;
  try {
    for (let index = 0; index < 4; index++) {
      const dir = path.join(root, `branch${index}`, 'child');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'file.txt'), 'fixture');
    }
    const controller = new AbortController();
    const reason = new Error('controlled cancellation');
    let reads = 0;
    const countedFs = {
      ...fs,
      readdir(...args) {
        const firstRead = ++reads === 1;
        pending++;
        const callback = args.pop();
        fs.readdir(...args, (error, entries) => {
          if (firstRead) controller.abort(reason);
          try { callback(error, entries); } finally { pending--; }
        });
      }
    };
    await assert.rejects(glob('**/*', { cwd: root, fs: countedFs, signal: controller.signal }), error => error === reason);
    // Drain the small fixture's callbacks before measuring or removing files.
    do { await nextTurn(); } while (pending);
    assert.equal(reads, 1, 'GHSA-3g3m-2fjr-6pw4: abort must stop further directory reads');

    const alreadyAborted = new AbortController();
    alreadyAborted.abort(reason);
    await assert.rejects(glob('**/*', { cwd: root, fs: countedFs, signal: alreadyAborted.signal }), error => error === reason);
    await nextTurn();
    assert.equal(reads, 1, 'An already aborted walk must perform no directory reads');
  } finally {
    do { await nextTurn(); } while (pending);
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function checkPatternLimit() {
  for (const [name, load] of [['ASAR', fromAsar], ['glob', fromGlob]]) {
    const { Minimatch, minimatch } = load('minimatch');
    // Bounded variant of the upstream preprocessing regression: the old
    // dependency produces 256 rows despite the caller's limit of 64.
    const pattern = Array(8).fill('**/../a/b').join('/');
    let matcher;
    try { matcher = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 64 }); }
    catch (error) {
      assert.match(error.message, /optimizationLevel 2: too many patterns from '\*\*\/\.\.'/,
        `${name}: only explicit expansion-limit rejection is acceptable`);
    }
    if (matcher) assert(matcher.set.length <= 64, `${name}: GHSA-g3hv-75wg-m249 preprocessing must respect the expansion limit`);

    const ordinary = new Minimatch('**/../a/b/**/../c/d', { optimizationLevel: 2 });
    assert.equal(ordinary.match('../a/b/../c/d'), true);
    assert.equal(ordinary.match('x/a/b/y/c/d'), true);
    assert.equal(minimatch('native/中文目录/addon.node', '**/*.{node,dll}', { matchBase: true }), true);
    assert.equal(minimatch('native/中文目录/addon.txt', '**/*.{node,dll}', { matchBase: true }), false);
  }
}

function checkWildcardCompileWork() {
  for (const [name, load] of [['ASAR', fromAsar], ['glob', fromGlob]]) {
    const { Minimatch } = load('minimatch');
    const parts = 1024;
    const pattern = Array(parts).fill('*').join('/');
    const join = Array.prototype.join;
    let joinedParts = 0;
    // Count whole-pattern joining work rather than relying on CPU-time limits.
    // GHSA-cf2h-pxjq-68xw repeatedly joins the full row for each wildcard.
    Array.prototype.join = function (...args) {
      if (this.length >= parts) joinedParts += this.length;
      return Reflect.apply(join, this, args);
    };
    try {
      const matcher = new Minimatch(pattern);
      assert.equal(matcher.set.length, 1);
    } finally { Array.prototype.join = join; }
    assert(joinedParts <= parts * 16, `${name}: long wildcard patterns must not repeatedly join whole rows (${joinedParts} parts)`);
  }
}

function checkIgnoreExpansionLimit() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-ignore-limit-'));
  try {
    fs.writeFileSync(path.join(root,'file.txt'),'fixture');
    const { globSync } = fromAsar('glob');
    const payload = Array.from({length:14},(_,i)=>'**/../x'+i+'/y'+i).join('/');
    const limitError = /optimizationLevel 2: too many patterns/;
    assert.throws(()=>globSync(payload,{cwd:root,platform:'posix'}),limitError);
    assert.throws(()=>globSync('*',{cwd:root,platform:'posix',ignore:[payload]}),limitError,
      'GHSA-qxr8-q827-836c: ignore patterns must enforce the same expansion limit');
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
}

(async () => {
  const failures = [];
  for (const [name, check] of [['glob cancellation', checkCancellation], ['minimatch preprocessing', checkPatternLimit], ['wildcard compile work', checkWildcardCompileWork], ['ignore expansion limit', checkIgnoreExpansionLimit]]) {
    try { await check(); console.log(`PASS: ${name}`); }
    catch (error) { failures.push(error); console.error(`FAIL: ${name}: ${error.message}`); }
  }
  assert.equal(failures.length, 0, 'Dependency security regressions must all pass');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
