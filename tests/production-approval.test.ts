import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {densityReview,applyHumanAssetApproval,acceptDensityReview} from '../src/visuals/density-qa';
import {fileDigest} from '../src/orchestration/integrity';
import {targetDuration,durationConfig} from '../src/longform';
import {validatePlannedReuse} from '../src/visuals/illustrated-video-assets';
import type {Shot} from '../src/editor/schemas';
test('human stylization exception is exact-asset only, preserves negative QA and cannot accept serious structure defects',async()=>{
 const direction=JSON.parse(await readFile('config/channel-art-direction.json','utf8')),raw=JSON.parse(await readFile('assets/approved-style/original-gemini-review.json','utf8'));
 const review=densityReview.parse(raw.source02),approval=direction.assetOverrides[0],sha=await fileDigest(approval.source);
 assert.equal(direction.status,'LOCKED');assert.equal(sha,approval.sha256);assert.equal(applyHumanAssetApproval(review,sha,approval).applied,true);assert.equal(review.passed,false);
 assert.equal(applyHumanAssetApproval(review,'0'.repeat(64),approval).applied,false);
 for(const defect of ['extra limb','broken joint','malformed hand']){assert.equal(applyHumanAssetApproval({...review,seriousAnatomyDefects:[defect]},sha,approval).applied,false);assert.equal(acceptDensityReview({...review,adultAnatomyCorrect:true,seriousAnatomyDefects:[defect]},70).passed,false);}
 assert.equal(applyHumanAssetApproval({...review,objectiveFailures:['adultAnatomy','photorealism']},sha,approval).applied,false);
});
test('production test duration cannot inherit the 8–12 minute pilot target',async()=>{const config=durationConfig.parse(JSON.parse(await readFile('config/duration.json','utf8')));const target=await targetDuration('production_test',config);assert.equal(target.seconds,98);assert.ok((await targetDuration('quality_test',config)).seconds>=480);});
test('meaningful source reuse rejects adjacent repeats and inconsistent/unexplained scenes',()=>{
 const shot=(key:string,label:string|null)=>({id:key,assetKey:key,visualIntent:'Show the supported drain route',overlay:label,illustrationIdea:{concept:key+' historical source scene'}} as Shot);
 assert.deepEqual(validatePlannedReuse([shot('drain','DRAIN'),shot('street','STREET'),shot('drain','FLOW')]),['drain','street','drain']);
 assert.throws(()=>validatePlannedReuse([shot('drain','A'),shot('drain','B')]),/Consecutive/);
 assert.throws(()=>validatePlannedReuse([shot('drain',null),shot('street','STREET'),shot('drain','FLOW')]),/meaningful/);
 const changed=shot('drain','FLOW');changed.illustrationIdea!.concept='Unrelated historical imagery';assert.throws(()=>validatePlannedReuse([shot('drain','DRAIN'),shot('street','STREET'),changed]),/consistent/);
});

test('fact QA repairs a malformed count while preserving a substantive rejection',async()=>{
 const {factcheck}=await import('../src/factcheck');let calls=0;
 const script={title:'Roman Drainage',topic:'Roman drains',hook:'Where did the water go?',criticalTerms:[],scenes:[{id:'drains',narration:'The sewer made all of ancient Rome perfectly sanitary.',visual:'A Roman drain',claims:[]}]};
 const research={topic:'Roman drains',summary:'A drain is not sewage treatment.',sources:[{url:'https://example.com/source',title:'Source',excerpt:'Drainage channels carried water. Hygiene was not guaranteed.'}]};
 const result=await factcheck(script,research,{json:async<T>(_prompt:string,schema:import('zod').ZodType<T>)=>{calls++;return schema.parse(calls===1?{passed:false,issues:['Unsupported sanitation guarantee'],checkedClaims:[],review:'Unfounded'}:{passed:false,issues:['Unsupported sanitation guarantee'],checkedClaims:1,review:'A drain cannot guarantee hygiene'});}});
 assert.equal(calls,2);assert.equal(result.passed,false);assert.match(result.issues[0],/Unsupported/);
});

test('pacing advice cannot disable factual, audio, black-frame or asset safety checks',async()=>{
 const {requireQA,requiredQAChecks}=await import('../src/qa');const checks=requiredQAChecks.map(name=>({name,passed:true,severity:'hard'}));
 requireQA({passed:true,checks:checks.map(c=>c.name==='shot pacing'?{...c,passed:false,severity:'advisory'}:c)});
 for(const name of ['factual consistency','audio duration','black frames','missing assets'])assert.throws(()=>requireQA({passed:true,checks:checks.map(c=>c.name===name?{...c,passed:false,severity:'advisory'}:c)}),/QA failed/);
});
