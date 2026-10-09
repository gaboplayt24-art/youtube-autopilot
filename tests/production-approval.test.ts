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
