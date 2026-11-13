const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const asar = require('@electron/asar');
const { packAsarSync } = require('../core/patcher');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-asar-deps-'));
const source = path.join(root, 'source with spaces 中文{literal,root}[directory]');
const archive = path.join(root, 'payload.asar');
const extracted = path.join(root, 'extracted');
const contents = new Map([
  ['package.json', Buffer.from('{"name":"fixture"}')],
  ['.hidden/config.json', Buffer.from('{"hidden":true}')],
  ['assets/中文名称/file with spaces.js', Buffer.from('const greeting="你好";')],
  ['native/win x64/addon.node', Buffer.from([0, 1, 2, 255])],
  ['native/子目录/helper.dll', Buffer.from([7, 8, 9, 0])],
  ['native/子目录/addon.node', Buffer.from('same basename, stays packed')],
  ['native/keep.txt', Buffer.from('must stay packed')]
]);
const unpacked = ['native/win x64/addon.node', 'native/子目录/helper.dll'].sort();
const nativePath = name => path.join(...name.split('/'));

try {
  for (const [name, content] of contents) {
    const target = path.join(source, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  // Windows symlink creation requires a machine-specific privilege. Unix CI
  // covers this branch without changing system policy or following user links.
  const link = 'package-link.json';
  if (process.platform !== 'win32') fs.symlinkSync('package.json', path.join(source, link));

  packAsarSync(source, archive, { unpack: `{${unpacked.map(name => '**/' + name).join(',')}}` });
  const files = asar.listPackage(archive).map(name => name.replace(/^[/\\]/, '').replace(/\\/g, '/'))
    .filter(name => !asar.statFile(archive, nativePath(name), false).files).sort();
  const expected = [...contents.keys(), ...(process.platform !== 'win32' ? [link] : [])].sort();
  assert.deepEqual(files, expected, 'The archive must retain every file and no extra entries');
  assert.deepEqual(files.filter(name => asar.statFile(archive, nativePath(name), false).unpacked).sort(), unpacked,
    'Multiple exact unpacked paths must retain their layout');
  for (const [name, content] of contents) assert.deepEqual(asar.extractFile(archive, nativePath(name)), content, name);
  asar.extractAll(archive, extracted);
  for (const [name, content] of contents) assert.deepEqual(fs.readFileSync(path.join(extracted, name)), content, name);
  if (process.platform !== 'win32') {
    assert(fs.lstatSync(path.join(extracted, link)).isSymbolicLink());
    assert.deepEqual(fs.readFileSync(path.join(extracted, link)), contents.get('package.json'));
  }
  console.log('PASS: ASAR file inventory, literal glob/hidden/Unicode/spaced paths, multiple unpacked files and byte-exact extraction');
  console.log(process.platform === 'win32' ? 'SKIP: symlink fixture requires Unix (covered by macOS/Linux CI)' : 'PASS: ASAR symlink round trip');
} finally {
  asar.uncacheAll();
  fs.rmSync(root, { recursive: true, force: true });
}
