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
  assert.match(script,/latest\.setup\.json/);
  assert.match(script,/fullReleaseSha256/);
  assert.match(script,/setupSha256/);
  assert.doesNotMatch(script,/api\.github\.com/);
  assert.doesNotMatch(script,/pulselink-extension/);
});
