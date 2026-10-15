import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {StorageProvider} from '../src/providers/interfaces';
import {verifyDeliveryLedger} from '../scripts/verify-delivery-ledger';
import {supabaseProjectUrl} from '../src/database/storage';
function memory():StorageProvider{
 const data=new Map<string,unknown>();
 return {create:async(k,v)=>{if(data.has(k))return false;data.set(k,v);return true;},get:async k=>data.get(k),put:async(k,v)=>{data.set(k,v);},list:async()=>[]};
}
test('delivery probe exercises real reservation semantics in an isolated namespace',async()=>{
 const storage=memory();await storage.create('upload-bible-angels-001',{state:'uploaded',videoId:'preserve'});
 const result=await verifyDeliveryLedger(storage,'123-1');assert.equal(result.verified,true);assert.equal(result.postsCreated,0);
 assert.deepEqual(await storage.get('upload-bible-angels-001'),{state:'uploaded',videoId:'preserve'});
 await assert.rejects(verifyDeliveryLedger(storage,'123-1'),/already exists/);
 await assert.rejects(verifyDeliveryLedger(storage,'upload-bible-angels-001'),/execution ID/);
});
test('broken uniqueness or lost writes fail the probe rather than claiming publication readiness',async()=>{
 await assert.rejects(verifyDeliveryLedger({...memory(),create:async()=>true},'123-2'),/Duplicate reservation/);
 await assert.rejects(verifyDeliveryLedger({...memory(),get:async()=>null},'123-3'),/readback differs/);
 const storage=memory();await assert.rejects(verifyDeliveryLedger({...storage,put:async()=>{}},'123-4'),/Updated ledger readback/);
});
test('a pasted REST endpoint resolves to the project root before SDK path construction',()=>{
 for(const value of ['https://example.supabase.co','https://example.supabase.co/','https://example.supabase.co/rest/v1','https://example.supabase.co/rest/v1/pipeline_artifacts?select=key'])assert.equal(supabaseProjectUrl(value),'https://example.supabase.co');
 for(const value of ['http://example.supabase.co','https://example.supabase.co.evil.invalid','https://user:password@example.supabase.co','https://supabase.com/dashboard/project/example'])assert.throws(()=>supabaseProjectUrl(value));
});
