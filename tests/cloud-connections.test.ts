import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectCloudConnections,inspectEpisodeProgress} from '../scripts/cloud-connections';
test('missing production configuration and inventory mode never make external requests or claim readiness',async()=>{
 const unavailable=async()=>{throw Error('Network must not be used');};
 const missing=await inspectCloudConnections({},unavailable);assert.equal(missing.ready,false);assert.ok(missing.results.every(r=>r.status==='missing-configuration'));
 const inventory=await inspectCloudConnections({ZERNIO_API_KEY:'mock-only',CONNECTION_SERVICE:'zernio'},unavailable);assert.equal(inventory.ready,false);assert.equal(inventory.results[0].status,'configured-not-tested');
});
test('connection diagnosis uses only reads and keeps keys and raw account data out of the report',async()=>{
 const calls:{url:string;body:any}[]=[];
 const request:typeof fetch=async(input,init)=>{
  assert.equal(init?.redirect,'error');
  const url=String(input),body=init?.body?JSON.parse(String(init.body)):null;calls.push({url,body});
  if(url.includes('supabase.co')){assert.equal(init?.method,undefined);return new Response('[{"key":"not-exported"}]');}
  assert.equal(init?.method,undefined);assert.equal(url,'https://zernio.com/api/v1/accounts');
  return new Response(JSON.stringify({accounts:[{_id:'private-id',platform:'tiktok',isActive:true},{platform:'instagram',isActive:true}]}));
 };
 const report=await inspectCloudConnections({VERIFY_LIVE:'true',SUPABASE_URL:'https://project.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'mock-supabase-key',ZERNIO_API_KEY:'mock-zernio-key'},request);
 assert.equal(report.ready,true);assert.equal(calls.length,2);assert.doesNotMatch(JSON.stringify(report),/mock-|private-id|not-exported/);assert.deepEqual(report.results[1].platforms,['tiktok','instagram']);
 const blocked=await inspectCloudConnections({VERIFY_LIVE:'true',CONNECTION_SERVICE:'supabase',SUPABASE_URL:'https://project.supabase.co.evil.invalid',SUPABASE_SERVICE_ROLE_KEY:'mock-only'},async()=>{throw Error('Do not send keys to another domain');});assert.equal(blocked.ready,false);
});

test('invalid credentials and accounts without active destinations cannot imply publishing readiness',async()=>{
 const env={VERIFY_LIVE:'true',CONNECTION_SERVICE:'zernio',ZERNIO_API_KEY:'mock-only'};
 const denied=await inspectCloudConnections(env,async()=>new Response('private-error',{status:401}));
 assert.equal(denied.ready,false);assert.equal(denied.results[0].httpStatus,401);assert.doesNotMatch(JSON.stringify(denied),/private-error/);
 const inactive=await inspectCloudConnections(env,async()=>new Response(JSON.stringify({accounts:[{platform:'tiktok',isActive:false}]})));
 assert.equal(inactive.ready,false);assert.equal(inactive.publishingReady,false);assert.equal(inactive.results[0].status,'authenticated-no-channels');
});

test('profile review exposes only explicitly requested public handles, never tokens or account IDs',async()=>{
 const request:typeof fetch=async()=>new Response(JSON.stringify({accounts:[{_id:'private-id',platform:'tiktok',username:'@example.bible',accessToken:'private-token',isActive:true}]}));
 const env={VERIFY_LIVE:'true',CONNECTION_SERVICE:'zernio',ZERNIO_API_KEY:'mock-only'};
 const hidden=await inspectCloudConnections(env,request);assert.equal(hidden.results[0].publicProfiles,undefined);
 const shown=await inspectCloudConnections({...env,INCLUDE_PUBLIC_HANDLES:'true'},request);
 assert.deepEqual(shown.results[0].publicProfiles,[{platform:'tiktok',username:'@example.bible'}]);assert.doesNotMatch(JSON.stringify(shown),/private-id|private-token/);
});
test('episode progress reads only the approved prefix and reports decisions without inventing video approval',async()=>{
 const result=await inspectEpisodeProgress({SUPABASE_URL:'https://example.supabase.co/rest/v1',SUPABASE_SERVICE_ROLE_KEY:'mock-secret'},async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.pathname,'/rest/v1/pipeline_artifacts');assert.equal(url.searchParams.get('key'),'like.bible-angels-001-%');assert.equal(url.searchParams.get('limit'),'8');assert.equal(init?.method,undefined);assert.equal(init?.redirect,'error');
  return Response.json([{key:'bible-angels-001-native-source-review',updated_at:'2026-10-15T23:00:00Z',decision:false}]);
 });
 assert.equal(result.notFullVideoApproval,true);assert.equal(result.records[0].decision,false);assert.doesNotMatch(JSON.stringify(result),/mock-secret/);
});
