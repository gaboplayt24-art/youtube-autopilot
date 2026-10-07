import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {validatedJSON} from '../src/providers/validated-json';
test('schema feedback repairs prose issues without changing a failed quality decision',async()=>{
 let calls=0;const schema=z.object({passed:z.boolean(),issues:z.array(z.string())});
 const result=await validatedJSON({json:async<T>(instruction:string,s:z.ZodType<T>)=>{calls++;if(calls>1)assert.match(instruction,/Previous output failed schema/);return s.parse({passed:false,issues:calls===1?'Costume mismatch':['Costume mismatch']});}},'Review costume',schema);
 assert.equal(calls,2);assert.equal(result.passed,false);assert.deepEqual(result.issues,['Costume mismatch']);
});
test('schema retries are bounded and never retry an external provider outage',async()=>{
 let calls=0;const schema=z.object({passed:z.boolean()});await assert.rejects(validatedJSON({json:async<T>(_p:string,s:z.ZodType<T>)=>{calls++;return s.parse({passed:'invalid'});}},'Review',schema),z.ZodError);assert.equal(calls,3);
 calls=0;await assert.rejects(validatedJSON({json:async()=>{calls++;throw new Error('Free quota exhausted');}},'Review',schema),/Free quota/);assert.equal(calls,1);
});
