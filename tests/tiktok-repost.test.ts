import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {repostConfig,repostSlots} from '../src/social/repost-shorts';
test('TikTok reposts are spaced daily at the configured hour, at least an hour ahead',()=>{
 const slots=repostSlots(2,'23:00',24,new Date('2026-10-16T22:30:00Z'));
 assert.deepEqual(slots,['2026-10-17T23:00:00.000Z','2026-10-18T23:00:00.000Z']);
 assert.equal(repostSlots(1,'23:00',24,new Date('2026-10-16T03:00:00Z'))[0],'2026-10-16T23:00:00.000Z');
});
test('the repost list names each reviewed YouTube Short once',()=>{
 const config=repostConfig.parse(JSON.parse(readFileSync('config/tiktok-reposts.json','utf8')));
 assert.equal(new Set(config.items.map(i=>i.runId)).size,config.items.length);
});
