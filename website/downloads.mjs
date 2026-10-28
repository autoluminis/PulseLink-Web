const status = document.getElementById('release-status');
const metadata = document.getElementById('package-metadata');
const link = document.getElementById('package-download');
const copy = document.getElementById('copy-checksum');
const checksum = document.getElementById('checksum-download');
const refresh = document.getElementById('refresh-release');
const source = document.querySelector('.package-source');
const releaseRecord = document.querySelector('.release-tools a');
const cacheKey = 'pulselink-setup-release-v1';
let setup = null;
let loading = false;

function sizeText(size) { return `${(size / 1024 / 1024).toFixed(1)} MB`; }
function versionParts(value) { return typeof value === 'string' && /^\d{1,5}\.\d{1,5}\.\d{1,5}(?:\.\d{1,5})?$/.test(value) ? value.split('.').map(Number) : null; }
function validConfig(value) {
  if (!value || typeof value.releaseBaseUrl !== 'string' || !/^https:\/\/[^/]+\/$/.test(value.releaseBaseUrl) || value.channel !== 'stable' || value.runtimeIdentifier !== 'win-x64') throw new Error('安装发布配置无效。');
  return value;
}
function validate(index, config) {
  const version = versionParts(index?.version);
  if (index?.schemaVersion !== 1 || index.product !== 'PulseLink' || index.channel !== config.channel || index.runtimeIdentifier !== config.runtimeIdentifier || !version || !Number.isSafeInteger(index.setupSize) || index.setupSize <= 0 || !/^[A-Fa-f0-9]{64}$/.test(index.setupSha256 || '')) throw new Error('安装发布索引无效。');
  const stem = `PulseLink-${index.version}-${config.runtimeIdentifier}`;
  if (index.setupFile !== `${stem}.setup.exe` || index.fullReleaseFile !== `${stem}.full-release.json` || !/^[A-Fa-f0-9]{64}$/.test(index.fullReleaseSha256 || '')) throw new Error('安装发布索引中的文件身份无效。');
  const directory = `ota/${config.channel}/${config.runtimeIdentifier}/`;
  return {...index, url: new URL(directory + index.setupFile, config.releaseBaseUrl).href, fullReleaseUrl: new URL(directory + index.fullReleaseFile, config.releaseBaseUrl).href};
}
async function getJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {signal: controller.signal, cache: 'no-store', headers: {Accept: 'application/json'}});
    if (!response.ok) { const error = new Error(`HTTP ${response.status}`); error.status = response.status; throw error; }
    return await response.json();
  } finally { clearTimeout(timer); }
}
function render(error = null, cached = false) {
  link.hidden = true; link.removeAttribute('href'); metadata.hidden = true; copy.hidden = true; checksum.hidden = true; checksum.removeAttribute('href'); refresh.disabled = loading;
  if (loading && !setup) { status.textContent = '正在读取正式安装发布信息…'; return; }
  if (!setup) { status.textContent = error || '正式发布站尚无可用的首次安装程序。'; return; }
  const published = setup.publishedAt && Number.isFinite(Date.parse(setup.publishedAt)) ? ` · 发布于 ${new Intl.DateTimeFormat('zh-CN', {timeZone:'Asia/Taipei', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(setup.publishedAt))}` : '';
  metadata.textContent = `版本 ${setup.version} · ${sizeText(setup.setupSize)}${published}`; metadata.hidden = false;
  status.textContent = cached ? '正在使用最近一次已验证的安装发布信息；请稍后重新检查。' : '已找到正式发布站提供的最新完整安装程序。';
  link.href = setup.url; link.hidden = false; copy.hidden = false;
}
async function load() {
  if (loading) return;
  loading = true; render();
  try {
    const config = validConfig(await getJson(new URL('release-config.json', location.href)));
    const directory = `ota/${config.channel}/${config.runtimeIdentifier}/`;
    const index = validate(await getJson(new URL(directory + 'latest.setup.json', config.releaseBaseUrl)), config);
    const full = await getJson(index.fullReleaseUrl);
    if (full?.Version !== index.version || full?.Runtime !== config.runtimeIdentifier || full?.Files?.[index.setupFile]?.toUpperCase() !== index.setupSha256.toUpperCase()) throw new Error('完整发布描述与安装索引不一致。');
    setup = index;
    if (source) source.textContent = `发布源：${new URL(config.releaseBaseUrl).host}`;
    if (releaseRecord) releaseRecord.href = index.fullReleaseUrl;
    try { localStorage.setItem(cacheKey, JSON.stringify(index)); } catch { /* Browser storage is optional. */ }
    render();
  } catch (error) {
    try { setup = JSON.parse(localStorage.getItem(cacheKey)); } catch { setup = null; }
    render(error?.name === 'AbortError' ? '正式发布站读取超时，请重新检查。' : '正式发布站暂时无法提供已验证的安装信息。', Boolean(setup));
  } finally { loading = false; render(); }
}
refresh.addEventListener('click', load);
copy.addEventListener('click', async () => {
  if (!setup?.setupSha256) return;
  try { await navigator.clipboard.writeText(setup.setupSha256); copy.textContent = '已复制 ✓'; }
  catch { copy.textContent = '复制未成功'; }
});
load();
