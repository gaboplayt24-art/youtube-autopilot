import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ownerThumbnails} from '../src/packaging/thumbnails';
test('owner-supplied bible-long-001 thumbnails are pinned by their SHA-256',()=>{
 const owner=ownerThumbnails.parse(JSON.parse(readFileSync('data/scripts/bible-long-001-owner-thumbnails.json','utf8')));
 assert.deepEqual(owner.variants.map(v=>v.variant),['A','B','C']);
 for(const v of owner.variants)assert.equal(createHash('sha256').update(readFileSync(v.path)).digest('hex'),v.sha256);
});
test('an owner thumbnail set needs exactly three variants',()=>{assert.throws(()=>ownerThumbnails.parse({runId:'r',approvedBy:'owner',variants:[]}));});
