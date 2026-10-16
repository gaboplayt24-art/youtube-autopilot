import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {inspectWingStudy,measureIsolatedWings,applyWingCount,requiresWingCount,wingStudyMeasurement} from '../src/visuals/wing-count';
import {densityReview} from '../src/visuals/density-qa';
import {fileDigest} from '../src/orchestration/integrity';

test('real retained six/twelve-wing pixels override a false semantic pass without external inference',async()=>{
 const dir='tests/fixtures/wing-count',provenance=JSON.parse(await readFile(join(dir,'provenance.json'),'utf8'));
 const fixture=JSON.parse(await readFile('assets/approved-style/original-gemini-review.json','utf8'));
 const original=densityReview.parse({...fixture.source02,passed:true,referenceCompared:true,referenceStyleMatches:true,conceptMatches:true,historicallyPlausible:true,adultAnatomyCorrect:true,seriousAnatomyDefects:[],objectiveFailures:[]});
 for(const row of provenance.fixtures){
  const path=join(dir,row.file);assert.equal(await fileDigest(path),row.sha256);
  const measured=await inspectWingStudy(path);assert.equal(measured.detectedCount,row.expectedWings);assert.equal(measured.passed,row.expectedWings===6);
  const effective=applyWingCount(original,measured);assert.equal(effective.passed,row.expectedWings===6);
  if(row.expectedWings!==6){assert.ok(effective.objectiveFailures!.includes('factualWingCount'));assert.throws(()=>wingStudyMeasurement.parse({...measured,passed:true}));}
 }
 assert.equal(original.passed,true);
 const six=await inspectWingStudy(join(dir,'six.png'));assert.equal(applyWingCount({...original,passed:false},six).passed,false);
});
test('blank studies and broad merged silhouettes cannot produce a quantitative pass',()=>{
 const rgb=new Uint8Array(512*288*3).fill(245);assert.equal(measureIsolatedWings(rgb).passed,false);
 for(let i=0;i<6;i++)for(let y=90;y<120;y++)for(let x=8+i*84;x<78+i*84;x++)for(let c=0;c<3;c++)rgb[(y*512+x)*3+c]=0;
 const merged=measureIsolatedWings(rgb);assert.equal(merged.detectedCount,6);assert.equal(merged.passed,false);
});
test('the six-wing pixel contract applies only to an isolated Isaiah 6:2 study',()=>{
 assert.equal(requiresWingCount({depictionScope:'wing-study',historicalContext:'Source-bound vision, Isaiah 6:2'}),true);
 assert.equal(requiresWingCount({depictionScope:'whole-scene',historicalContext:'Source-bound vision, Isaiah 6:2'}),false);
 assert.equal(requiresWingCount({depictionScope:'wing-study',historicalContext:'Natural history: bird wings'}),false);
});
