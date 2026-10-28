/** Parse numeric product versions while preserving the original spelling for URLs. */
export function parseVersion(value) {
  if (typeof value !== 'string' || !/^\d{1,5}\.\d{1,5}\.\d{1,5}(?:\.\d{1,5})?$/.test(value)) return null;
  const parts = value.split('.').map(Number);
  return parts.every(p => p <= 65534) ? [...parts, ...Array(4 - parts.length).fill(0)] : null;
}
export function compareVersions(a, b) {
  const x = parseVersion(a), y = parseVersion(b);
  if (!x || !y) throw new Error('Invalid product version');
  for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}
export function validateConfig(config) {
  if (!config || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.repository) || !/^[A-Za-z0-9_.-]+$/.test(config.releaseBranch) || config.channel !== 'stable' || config.runtimeIdentifier !== 'win-x64') throw new Error('Unsupported release configuration');
  return config;
}
export function publicStableReleases(value) {
  if (!Array.isArray(value)) throw new Error('Invalid release response');
  return value.filter(r => r && r.draft === false && r.prerelease === false && typeof r.tag_name === 'string' && Array.isArray(r.assets));
}
function assetUrl(asset, release, config) {
  const prefix = `https://github.com/${config.repository}/releases/download/${encodeURIComponent(release.tag_name)}/`;
  const expected = prefix + encodeURIComponent(asset.name);
  if (asset.browser_download_url !== expected || asset.state !== 'uploaded' || !Number.isSafeInteger(asset.size) || asset.size <= 0) throw new Error('Invalid release asset');
  return expected;
}
function digest(asset) { return typeof asset.digest === 'string' && /^sha256:[a-f0-9]{64}$/i.test(asset.digest) ? asset.digest.slice(7).toUpperCase() : null; }
/** Installer discovery is deliberately independent of whichever Release GitHub calls latest. */
export function selectInstaller(releases, config) {
  const candidates = [];
  for (const release of releases) {
    const match = /^(?:v|setup-stable-win-x64-)(\d+\.\d+\.\d+(?:\.\d+)?)$/.exec(release.tag_name);
    if (!match || !parseVersion(match[1])) continue;
    const installers = release.assets.filter(a => a.name === 'PulseLink-Setup.exe');
    if (installers.length !== 1) continue;
    const installer = installers[0];
    try {
      const url = assetUrl(installer, release, config);
      const checksum = release.assets.find(a => a.name === 'PulseLink-Setup.exe.sha256');
      let checksumUrl = null;
      if (checksum) checksumUrl = assetUrl(checksum, release, config);
      candidates.push({kind:'setup', version:match[1], url, size:installer.size, sha256:digest(installer), checksumUrl, publishedAt:release.published_at, minimumVersion:null});
    } catch { /* Never offer a partial or malformed installer asset. */ }
  }
  candidates.sort((a, b) => compareVersions(b.version, a.version));
  return candidates[0] || null;
}
/** Cached metadata is a download hint, never a replacement for installer verification. */
export function readDownloadSnapshot(snapshot, config) {
  if (!snapshot || snapshot.schemaVersion !== 1 || snapshot.repository !== config.repository || snapshot.channel !== config.channel || snapshot.runtimeIdentifier !== config.runtimeIdentifier || !Number.isFinite(Date.parse(snapshot.generatedAt)) || Date.parse(snapshot.generatedAt) > Date.now() + 300000) throw new Error('Invalid download snapshot');
  const releases = publicStableReleases(snapshot.releases);
  const setup = selectInstaller(releases, config);
  const cached = pkg => pkg ? {...pkg, cachedAt:snapshot.generatedAt} : null;
  return {setup:cached(setup)};
}
