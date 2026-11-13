import {test} from 'node:test';
import assert from 'node:assert/strict';
import {reconcileReservation} from '../src/social/publish';
const now={fingerprint:'f2',at:'2026-11-14T22:00:00.000Z',platform:'youtube' as const,tag:'bible-nephilim-007-A'};
test('a stale reservation is reused only when provably safe',async()=>{
 assert.equal(await reconcileReservation({state:'scheduled',fingerprint:'f1',remoteId:'abc',at:now.at},now,async()=>{throw Error('unused');}),'abc');
 assert.equal(await reconcileReservation({state:'pending',fingerprint:'f1',at:now.at},now,async()=>null),'reclaim');
 assert.equal(await reconcileReservation({state:'pending',fingerprint:'f1'},now,async()=>'found1'),'found1');
 await assert.rejects(()=>reconcileReservation({state:'pending',fingerprint:'f1'},{...now,platform:'tiktok'},async()=>null),/Uncertain/);
 await assert.rejects(()=>reconcileReservation({state:'scheduled',fingerprint:'f1',remoteId:'x',at:'2026-11-20T22:00:00.000Z'},{...now,platform:'tiktok'}),/Uncertain/);
});
test('YouTube publishAt without milliseconds matches the planned slot',async()=>{
 const {sameInstant}=await import('../src/social/publish');
 assert.ok(sameInstant('2026-11-14T22:00:00Z','2026-11-14T22:00:00.000Z'));
 assert.ok(!sameInstant('2026-11-15T22:00:00Z','2026-11-14T22:00:00.000Z'));
 assert.ok(!sameInstant(null,'2026-11-14T22:00:00.000Z'));
});
