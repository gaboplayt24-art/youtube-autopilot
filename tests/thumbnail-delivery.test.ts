import {test} from 'node:test';
import assert from 'node:assert/strict';
import {thumbnailDelivery,ownerCoverHandoff} from '../src/thumbnail/delivery';
test('owner-supplied cover skips generation and never marks the episode upload-ready',()=>{
 assert.deepEqual(thumbnailDelivery('true'),{ownerSupplied:true,generate:false,state:'awaiting_owner_thumbnail'});
});
test('existing automated cover delivery is unchanged unless explicitly overridden',()=>{
 assert.deepEqual(thumbnailDelivery(undefined),{ownerSupplied:false,generate:true,state:'ready_for_private_upload'});
 assert.equal(thumbnailDelivery('false').generate,true);
 assert.throws(()=>thumbnailDelivery('yes'));
});

test('Studio handoff permits private upload while owner confirmation remains mandatory for scheduling',()=>{
 assert.deepEqual(ownerCoverHandoff('true','false'),{ownerApplies:true,maySchedule:false});assert.equal(ownerCoverHandoff('true','true').maySchedule,true);assert.equal(ownerCoverHandoff(undefined,undefined).maySchedule,true);assert.throws(()=>ownerCoverHandoff('false','true'));
});
