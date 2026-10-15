import {test} from 'node:test';
import assert from 'node:assert/strict';
import {appendSupportFooter,supportConfig} from '../src/packaging/support';
const config={enabled:true,platform:'ko-fi' as const,url:'https://ko-fi.com/bibleunearthed'};
test('support link preserves facts, source URLs and disclosures; adding twice is idempotent',()=>{
 const original='An attributed explanation.\nSources: https://example.org/source\nSynthesized narration.';
 const result=appendSupportFooter(original,config);assert.ok(result.startsWith(original));assert.match(result,/optional/);assert.equal(appendSupportFooter(result,config),result);assert.equal(appendSupportFooter(original,{...config,enabled:false}),original);
});
test('support cannot substitute another creator, leak credentials in a URL or truncate sources to fit',()=>{
 assert.throws(()=>appendSupportFooter('Support https://ko-fi.com/someoneelse',config),/Different Ko-fi/);
 assert.throws(()=>appendSupportFooter('x'.repeat(4950),config),/description limit/);
 for(const url of ['https://ko-fi.com.evil.invalid/bibleunearthed','http://ko-fi.com/bibleunearthed','https://secret@ko-fi.com/bibleunearthed','https://ko-fi.com/bibleunearthed?token=secret'])assert.equal(supportConfig.safeParse({...config,url}).success,false);
});
