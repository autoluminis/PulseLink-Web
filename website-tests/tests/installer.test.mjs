import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const website=fileURLToPath(new URL('../../website/',import.meta.url));

test('website uses the formal release service for installation metadata',async()=>{
  const config=JSON.parse(await readFile(join(website,'release-config.json'),'utf8'));
  const script=await readFile(join(website,'downloads.mjs'),'utf8');
  assert.equal(config.releaseBaseUrl,'https://release.veio.cn/');
  assert.equal(config.notificationCatalogBaseUrl,'https://release.veio.cn/');
  assert.match(script,/latest\.setup\.json/);
  assert.match(script,/fullReleaseSha256/);
  assert.match(script,/setupSha256/);
  assert.doesNotMatch(script,/api\.github\.com/);
  assert.doesNotMatch(script,/pulselink-extension/);
});

test('website reads the signed plugin catalog from the formal release service',async()=>{
  const [config, script] = await Promise.all([
    readFile(join(website,'release-config.json'),'utf8'),
    readFile(join(website,'plugins.mjs'),'utf8')
  ]);
  assert.equal(JSON.parse(config).notificationCatalogBaseUrl,'https://release.veio.cn/');
  assert.match(script,/notificationCatalogBaseUrl/);
  assert.doesNotMatch(script,/pulselink-extension/);
});

test('catalog reader accepts the published v1 provider-index shape',async()=>{
  const source = await readFile(join(website,'plugin-catalog-core.mjs'),'utf8');
  const providerValidation = source.slice(source.indexOf('provider.schemaVersion === 1'), source.indexOf("'Invalid provider metadata'"));
  assert.doesNotMatch(providerValidation,/provider\.packageKind/);
  assert.match(source,/plugin\.packageKind === 'notification-plugin'/);
  assert.match(source,/parseHostVersion\(value\).*parseNumericVersion\(value, 3, 4\)/s);
});

test('website keeps a concise in-product purchase entry point',async()=>{
  const home = await readFile(join(website,'index.html'),'utf8');
  assert.match(home,/系统管理 → 许可证/);
  assert.match(home,/购买许可证/);
  assert.doesNotMatch(home,/配置购买入口/);
});

test('website directs SDK visitors to the developer page and links the current complete bundle',async()=>{
  const [home, developer] = await Promise.all([
    readFile(join(website,'index.html'),'utf8'),
    readFile(join(website,'developer.html'),'utf8')
  ]);
  const developerPage = 'https://autoluminis.github.io/PulseLink-Web/developer.html';
  const bundle = 'https://github.com/autoluminis/PulseLink-Web/releases/download/PulseLink-%E9%80%9A%E7%9F%A5%E6%8F%92%E4%BB%B6-SDK-26.10.28.008/PulseLink.NotificationPluginSdk-26.10.28.008-win-x64.zip';
  assert.match(home, new RegExp(`<a class="text-link" href="${developerPage.replace(/[./]/g, '\\$&')}">SDK 与发布说明 →</a>`));
  assert.doesNotMatch(home, /data-open-plugins="development"|development-tab|role="tablist"/);
  assert.doesNotMatch(home, new RegExp(bundle.replace(/[./]/g, '\\$&')));
  assert.match(developer, new RegExp(bundle.replace(/[./]/g, '\\$&')));
  assert.match(developer, new RegExp(`${bundle.replace(/[./]/g, '\\$&')}\\.sha256`));
  assert.match(developer, /完整 SDK 版本 26\.10\.28\.008/);
});
