const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const heldLocks = new Set();

/** Serialize synchronous launch/recovery/patch requests across toolkit checkouts. */
function withLaunchLock(action, lock = path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'claude-chinese', 'launch.lock')) {
  lock = path.resolve(lock);
  if (heldLocks.has(lock)) return action();
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  try { fs.mkdirSync(lock); }
  catch (error) {
    if (error.code === 'EEXIST') {
      throw new Error(`启动锁已存在：可能有其他启动器正在处理，或上次启动异常终止。未修改客户端。请等待；若持续出现，请确认没有启动器或安装操作后移除此目录：${lock}`);
    }
    throw error;
  }
  const owner = path.join(lock, 'owner.json');
  const record = JSON.stringify({ pid: process.pid, token: crypto.randomUUID() });
  try { fs.writeFileSync(owner, record, { flag: 'wx' }); }
  catch (error) {
    try { fs.rmdirSync(lock); } catch {}
    throw error;
  }
  heldLocks.add(lock);
  try { return action(); }
  finally {
    heldLocks.delete(lock);
    if (fs.readFileSync(owner, 'utf8') !== record) throw new Error('启动锁状态已变化，已保留现场，请检查其他启动器。');
    fs.unlinkSync(owner);
    fs.rmdirSync(lock);
  }
}

module.exports = { withLaunchLock };
