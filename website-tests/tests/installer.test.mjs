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

test('website keeps a concise in-product purchase entry point',async()=>{
  const home = await readFile(join(website,'index.html'),'utf8');
  assert.match(home,/系统管理 → 许可证/);
  assert.match(home,/购买许可证/);
  assert.doesNotMatch(home,/配置购买入口/);
});
