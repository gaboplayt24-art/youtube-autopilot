import {test} from 'node:test';
import assert from 'node:assert/strict';
import {completePrimaryEvidence} from '../src/research';
import {factcheck} from '../src/factcheck';
import type {LLMProvider} from '../src/providers/interfaces';
const url='https://example.org/primary';
const old='This selected excerpt establishes the subject but omits the precise words needed for one assertion.';
const quote='And the rain was upon the earth forty days and forty nights.';
const paragraph='12 '+quote;
const base={topic:'Source coverage',summary:'A selected excerpt is not the complete primary passage.',sources:[{url,title:'Selected source',excerpt:old}]};
const requirements={urls:[url],anchors:[{url,quote}]};
test('required primary text restores omitted evidence from fetched bytes, with digest and no model quotes',async()=>{
 const enriched=await completePrimaryEvidence(base,requirements,[url],async()=>new Response(`<title>Primary source</title><p>${old}</p><p>12 And the rain was upon the earth forty days and forty nights.</p><p>Another sufficiently long source paragraph about the subject, with Noah&#39;s name encoded in HTML.</p>`));
 assert.equal(enriched.research.sources.filter(s=>s.excerpt===old).length,1);
 assert.ok(enriched.research.sources.some(s=>s.excerpt===paragraph));
 assert.ok(enriched.research.sources.some(s=>s.excerpt.includes("Noah's")));
 assert.match(enriched.receipts[0].responseSha256,/^[a-f0-9]{64}$/);
});
test('unknown sources, missing required quotes and HTTP failures cannot silently pass evidence completion',async()=>{
 let calls=0;await assert.rejects(()=>completePrimaryEvidence(base,requirements,[],async()=>{calls++;return new Response('');}),/configured sources/);assert.equal(calls,0);
 await assert.rejects(()=>completePrimaryEvidence(base,requirements,[url],async()=>new Response('<p>'+old+'</p>')),/quotation absent/);
 await assert.rejects(()=>completePrimaryEvidence(base,requirements,[url],async()=>new Response('',{status:503})),/503/);
});
test('a multi-scene factual review retains exact narration/evidence anchors and hard failures',async()=>{
 const enriched=await completePrimaryEvidence(base,requirements,[url],async()=>new Response('<p>'+paragraph+'</p>'));
 const script={title:'A source-grounded title',topic:'Genesis narrative',hook:quote,criticalTerms:[],scenes:[{id:'rain',narration:quote,visual:'An interpretive illustration',claims:[{text:quote,sourceUrl:url,kind:'fact' as const}]},{id:'invented',narration:'The boat travelled at exactly ninety miles per hour.',visual:'An interpretive illustration',claims:[]}]};
 let calls=0;const llm:LLMProvider={json:async<T>(prompt:string,schema:import('zod').ZodType<T>)=>{calls++;assert.ok(prompt.includes(paragraph));return schema.parse(prompt.includes('Review ONLY scene "rain"')?{observations:[],checkedClaims:1,review:'Exact source is present.'}:{observations:[{narrationQuote:script.scenes[1].narration,sourceQuote:null,severity:'major',reason:'This speed is not established in the evidence.'}],checkedClaims:1,review:'Unsupported speed rejected.'});}};
 const result=await factcheck(script,enriched.research,llm,true);assert.equal(calls,2);assert.equal(result.passed,false);assert.match(result.issues[0],/ninety miles/);
});
