/** Register Chinese in the desktop IPC locale catalog without changing fallback. */
function patchShellLocale(content) {
  let mapCount = 0;
  const maps = /(?<![\w$])([A-Za-z_$][\w$]*)\s*=\s*\{((?:\s*(?:[A-Za-z_$][\w$]*|"[^"\\]*")\s*:\s*"[^"\\]*"\s*,?)+)\}/g;
  const patched = content.replace(maps, (match, name, entries) => {
    if (!/(?:^|,)\s*(?:en|"en")\s*:\s*"en-US"/.test(entries) ||
        !entries.includes('"de-DE"') || !entries.includes('"fr-FR"')) return match;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`new\\s+Set\\s*\\(\\s*Object\\.values\\s*\\(\\s*${escapedName}\\s*\\)\\s*\\)`).test(content)) return match;
    mapCount++;
    if (entries.includes('"zh-CN"')) return match;
    return match.slice(0, -1) + ',zh:"zh-CN","zh-CN":"zh-CN","zh-Hans":"zh-CN"}';
  });
  return { content: patched, mapCount };
}

module.exports = { patchShellLocale };
