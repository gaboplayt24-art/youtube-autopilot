import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PORTRAIT_QA_FAILED} from '../src/social/clips';
test('only the per-clip portrait QA failure is skipped; at least three passing clips are still required',async()=>{
 const src=await readFile('src/social/clips.ts','utf8');
 assert.ok(PORTRAIT_QA_FAILED.test("Portrait QA failed; publication blocked"));
 assert.ok(!PORTRAIT_QA_FAILED.test('Missing or changed approved illustration'));
 assert.match(src,/if\(clips\.length<3\)throw/);
 assert.match(src,/if\(!report\.passed\)throw Error\('Portrait QA failed; publication blocked'\)/);
});
