import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {supersedeStalePrompt} from '../src/visuals/native-v4-2';

test('a source drawn under an earlier prompt is archived with its reviews, never deleted', async()=>{
 const dir=await mkdtemp(join(tmpdir(),'stale-'));
 await writeFile(join(dir,'native-a-regen1-p3-source.json'),JSON.stringify({prompt:'old'}));
 await writeFile(join(dir,'native-a-regen1-p3-source.integrity.json'),'{}');
 await writeFile(join(dir,'native-a-regen1-p3-density-QA-v4.3.json'),'{}');
 await writeFile(join(dir,'native-a-regen1-p3-prompt-QA-abc.json'),'{}');
 await writeFile(join(dir,'native-a-regen10-p3-source.json'),JSON.stringify({prompt:'other'}));
 assert.equal(await supersedeStalePrompt(dir,'native-a-regen1-p3','old'),false);
 assert.equal(await supersedeStalePrompt(dir,'native-a-regen1-p3','new'),true);
 const left=await readdir(dir);
 assert.ok(left.includes('native-a-regen1-p3-prompt-QA-abc.json'));
 assert.ok(left.includes('native-a-regen10-p3-source.json'));
 assert.ok(!left.includes('native-a-regen1-p3-source.json'));
 const [archive]=await readdir(join(dir,'superseded'));
 assert.deepEqual((await readdir(join(dir,'superseded',archive))).sort(),['native-a-regen1-p3-density-QA-v4.3.json','native-a-regen1-p3-source.integrity.json','native-a-regen1-p3-source.json']);
 assert.equal(await supersedeStalePrompt(dir,'native-missing-p3','x'),false);
});
