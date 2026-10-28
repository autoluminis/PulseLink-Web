import {validateConfig, publicStableReleases, selectInstaller, readDownloadSnapshot} from './release-core.mjs?v=installer-only-1';
const status = document.getElementById('release-status');
const title = document.getElementById('package-title');
const purpose = document.getElementById('package-purpose');
const metadata = document.getElementById('package-metadata');
const link = document.getElementById('package-download');
const copy = document.getElementById('copy-checksum');
const checksum = document.getElementById('checksum-download');
const refresh = document.getElementById('refresh-release');
let state = {setup:null, setupError:false};
let started = false;
let loading = false;
const cacheKey = 'pulselink-download-snapshot-v1';
function sizeText(size) { return (size / 1024 / 1024).toFixed(1) + ' MB'; }
function render() {
  title.textContent = 'Windows 首次安装';
  purpose.textContent = '适用于尚未部署 PulseLink 的计算机，下载完整安装 EXE，由向导完成部署与初始化。';
  link.hidden = true; link.removeAttribute('href'); metadata.hidden = true; copy.hidden = true; checksum.hidden = true; checksum.removeAttribute('href');
  refresh.disabled = loading;
  if (loading && !state.setup) { status.textContent = '正在读取官方发布信息…'; return; }
  if (state.setupError) { status.textContent = state.setupError; return; }
  const pkg = state.setup;
  if (!pkg) { status.textContent = '官方仓库尚无可用的首次安装程序。'; return; }
  const pieces = ['版本 ' + pkg.version, sizeText(pkg.size)];
  if (pkg.publishedAt && Number.isFinite(Date.parse(pkg.publishedAt))) pieces.push('发布于 ' + new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(pkg.publishedAt)));
  metadata.textContent = pieces.join(' · '); metadata.hidden = false;
  status.textContent = '已找到公开发行的安装程序。';
  if (pkg.cachedAt) status.textContent = `使用缓存下载地址（记录于 ${new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short'}).format(new Date(pkg.cachedAt))}），可能不是最新版本。${loading ? '正在检查最新发布…' : '在线查询暂不可用，可下载此版本或重新检查。'}`;
  link.href = pkg.url; link.textContent = '下载首次安装程序 ↓'; link.hidden = false;
  copy.hidden = !pkg.sha256;
  copy.textContent = '复制 SHA-256';
  if (pkg.checksumUrl) { checksum.href = pkg.checksumUrl; checksum.hidden = false; }
}
async function fetchJson(url, optional = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const requestUrl = new URL(url, location.href);
    const response = await fetch(requestUrl, {signal:controller.signal, credentials:requestUrl.origin === location.origin ? 'same-origin' : 'omit', cache:'no-store', headers:{Accept:'application/json'}});
    if (optional && response.status === 404) return null;
    if (!response.ok) { const error = new Error('Release request failed'); error.httpStatus = response.status; error.isLocal = requestUrl.origin === location.origin; throw error; }
    return await response.json();
  } finally { clearTimeout(timer); }
}
async function fetchReleases(config) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const suffix = page === 1 ? '' : '&page=' + page;
    const chunk = await fetchJson(`https://api.github.com/repos/${config.repository}/releases?per_page=100${suffix}`);
    if (!Array.isArray(chunk)) throw new Error('Invalid release page');
    all.push(...chunk);
    if (chunk.length < 100) return all;
  }
  // An incomplete listing must not be mistaken for a confirmed absence of installers.
  throw new Error('Release listing exceeds the inspection limit');
}
function failureText(error, source) {
  if (error?.isLocal && [401, 403].includes(error.httpStatus)) return '站点配置需要有效登录，请刷新页面后重新检查。';
  if (error?.httpStatus === 403 || error?.httpStatus === 429) return source + '暂时拒绝请求或达到访问额度，请稍后重试，或查看官方发布记录。';
  if (error?.name === 'AbortError') return source + '读取超时，请重新检查，或直接查看官方发布记录。';
  if (error?.httpStatus) return source + '读取失败（HTTP ' + error.httpStatus + '），请重新检查。';
  return source + '暂时无法读取或核对，请检查网络并重试，或查看官方发布记录。';
}
async function load() {
  if (loading) return;
  started = true; loading = true; render();
  try {
    const config = validateConfig(await fetchJson(new URL('release-config.json', location.href)));
    let cached = {setup:null};
    let cacheDate = 0;
    function useCache(snapshot) {
      const parsed = readDownloadSnapshot(snapshot, config);
      if (Date.parse(snapshot.generatedAt) < cacheDate) return;
      cached = parsed; cacheDate = Date.parse(snapshot.generatedAt);
      state = {...parsed, setupError:false}; render();
    }
    try { useCache(JSON.parse(localStorage.getItem(cacheKey))); } catch { /* Storage may be disabled or invalid. */ }
    const [releaseResult] = await Promise.allSettled([
      fetchReleases(config),
      fetchJson(new URL('download-snapshot.json', location.href), true).then(snapshot=>{try {useCache(snapshot);}catch{ /* Bad snapshots never supply links. */ }})
    ]);
    state = {setup:null, setupError:false};
    let releases = null;
    if (releaseResult.status === 'fulfilled') {
      try { releases = publicStableReleases(releaseResult.value); state.setup = selectInstaller(releases, config); }
      catch (error) { state.setupError = failureText(error, '安装包发布信息'); }
    } else if (cached.setup && !(releaseResult.reason instanceof SyntaxError)) state.setup = cached.setup;
    else state.setupError = failureText(releaseResult.reason, '安装包发布 API');
    if (releaseResult.status === 'fulfilled') {
      try {
        const snapshot = {schemaVersion:1,repository:config.repository,channel:config.channel,runtimeIdentifier:config.runtimeIdentifier,generatedAt:new Date().toISOString(),releases:releaseResult.value};
        readDownloadSnapshot(snapshot, config);
        localStorage.setItem(cacheKey, JSON.stringify(snapshot));
      } catch { /* Do not persist incomplete metadata; storage failure cannot break downloads. */ }
    }
  } catch (error) { const message = failureText(error, '站点下载配置'); state = {setup:null, setupError:message}; }
  finally { loading = false; render(); }
}
refresh.addEventListener('click', load);
copy.addEventListener('click', async () => {
  const sha = state.setup?.sha256;
  if (!sha) return;
  try { await navigator.clipboard.writeText(sha); copy.textContent = '已复制 ✓'; }
  catch { copy.textContent = '复制未成功'; }
});
// Resolve both download types immediately, including when arriving via a deep link.
load();
