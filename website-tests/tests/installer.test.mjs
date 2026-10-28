import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {validateConfig, publicStableReleases, selectInstaller, readDownloadSnapshot} from '../../website/release-core.mjs';

const website=fileURLToPath(new URL('../../website/',import.meta.url));
const config=validateConfig(JSON.parse(await readFile(join(website,'release-config.json'))));

test('download snapshot supplies only a validated installation program',async()=>{
  const snapshot=JSON.parse(await readFile(join(website,'download-snapshot.json')));
  const result=readDownloadSnapshot(snapshot,config);
  assert.match(result.setup.url,/PulseLink-Setup\.exe$/);
  assert.equal(Object.hasOwn(result,'ota'),false);
  assert.throws(()=>readDownloadSnapshot({...snapshot,repository:'other/repository'},config));
});

test('installer discovery selects the newest uploaded public installer',()=>{
  const release=version=>({draft:false,prerelease:false,tag_name:'setup-stable-win-x64-'+version,assets:[{name:'PulseLink-Setup.exe',state:'uploaded',size:1,digest:'sha256:'+'a'.repeat(64),browser_download_url:`https://github.com/${config.repository}/releases/download/setup-stable-win-x64-${version}/PulseLink-Setup.exe`}]});
  assert.equal(selectInstaller(publicStableReleases([release('26.10.16.002'),release('26.10.16.010')]),config).version,'26.10.16.010');
});
