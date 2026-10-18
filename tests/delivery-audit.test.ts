import {test} from 'node:test';
import assert from 'node:assert/strict';
import {auditDelivery,deliveryTargets} from '../src/social/delivery-audit';

const plan=deliveryTargets.parse({runId:'episode',youtube:[{role:'full',id:'fZkGQDZcmig',scheduledFor:'2026-10-17T22:00:00Z'}],tiktok:[{role:'A',id:'6ad30bfb6c4d41716f8af310',scheduledFor:'2026-10-19T23:30:00Z'}]});
const now=new Date('2026-10-18T12:00:00Z');
const videos=async()=>[{id:'fZkGQDZcmig',snippet:{title:'Angels'},status:{privacyStatus:'public',uploadStatus:'processed'},statistics:{viewCount:'10'}}];
const queued=async()=>({post:{_id:plan.tiktok[0].id,status:'scheduled',scheduledFor:plan.tiktok[0].scheduledFor,platforms:[{platform:'tiktok',status:'pending'}]}});

test('audit distinguishes a public master from a future queued TikTok without changing either',async()=>{
 const report=await auditDelivery(plan,videos,queued,now);
 assert.equal(report.healthy,true);assert.equal(report.mode,'read-only');
 assert.deepEqual(report.rows.map(r=>r.state),['public','scheduled']);
 assert.equal(report.rows[0].views,'10');
});
test('scheduled receipt alone does not prove an overdue TikTok was published',async()=>{
 const report=await auditDelivery(plan,videos,queued,new Date('2026-10-20T00:00:00Z'));
 assert.equal(report.healthy,false);assert.equal(report.rows[1].state,'overdue-scheduled');
});
test('platform failure cannot hide under a published top-level receipt',async()=>{
 const report=await auditDelivery(plan,videos,async()=>({post:{_id:plan.tiktok[0].id,status:'published',platforms:[{platform:'tiktok',status:'failed'}]}}),now);
 assert.equal(report.healthy,false);assert.equal(report.rows[1].state,'delivery-failed');
});
test('missing YouTube, wrong future schedule and API errors stay unverified',async()=>{
 assert.equal((await auditDelivery(plan,async()=>[],queued,now)).rows[0].state,'missing');
 const wrong=await auditDelivery(plan,async()=>[{id:plan.youtube[0].id,snippet:{title:'Angels'},status:{privacyStatus:'private',publishAt:'2026-10-19T00:00:00Z'}}],queued,now);
 assert.equal(wrong.rows[0].healthy,false);
 const failed=await auditDelivery(plan,videos,async()=>{throw Error('secret-containing remote error');},now);
 assert.equal(failed.rows[1].state,'unverified-api-error');assert.ok(!JSON.stringify(failed).includes('secret-containing'));
});
