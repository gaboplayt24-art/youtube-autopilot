import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {ShotPlanner} from '../src/editor/planner';
import {profile} from '../src/editor/schemas';
import {composition} from '../src/orchestration/schemas';
import {visualQuality} from '../src/editor/quality';
import {CostLedger,withCosts,loadCostPolicy} from '../src/cost';
import {createAssets} from '../src/editor/assets';
import {thumbnailScores} from '../src/thumbnail';
import {createCaptions} from '../src/captions';
import psychology from '../config/visual-profiles/psychology.json';
const style=profile.parse(psychology);
const narration='Imagine the light moving through a city choose one clear path and notice the next small step instead of chasing every sign';
const words=narration.split(' ').map((text,i)=>({text,start:i*.5,end:(i+1)*.5}));
const scenes=[{id:'scene-1',narration,visual:'A city spotlight and a clear path'},{id:'scene-2',narration:narration+' tonight',visual:'A library and book'}];
const audio={scenes:scenes.map(s=>({id:s.id,path:'audio.wav',duration:12,alignment:words,words}))};
test('shots follow speech bounds, have no gaps, and use a hook without stretching audio',async()=>{const result=await new ShotPlanner().plan({scenes},audio,style,30);assert.equal(result.shots[0].start,0);assert.equal(result.shots.at(-1)?.end,24);assert.ok(result.shots.length>=8);assert.ok(result.shots.every(s=>s.end-s.start<=4.2));for(let i=1;i<result.shots.length;i++)assert.equal(result.shots[i].start,result.shots[i-1].end);assert.equal(result.shots[0].highImpact,true);assert.ok(result.visualDensity>15);});
test('short captions preserve word timing and enforce mobile text bounds',()=>{const cues=createCaptions({scenes:[scenes[0]]},{scenes:[audio.scenes[0]]}).cues;assert.equal(cues.map(c=>c.text).join(' '),narration);assert.ok(cues.every(c=>c.text.length<=32&&c.words!.length<=4));assert.equal(cues[0].words![0].start,words[0].start);});
test('failed external assets fall back to original illustrated motion graphics with provenance',async()=>{const dir=await mkdtemp(join(tmpdir(),'visual-assets-'));try{const plan=await new ShotPlanner().plan({scenes},audio,style,30);const shot={...plan.shots[0],shotType:'generated-image' as const};const result=await createAssets([shot],style,dir,{image:{generate:async()=>{throw new Error('API unavailable');}},stock:{search:async()=>{throw new Error('stock unavailable');}}});assert.equal(result.assets[0].kind,'graphic');assert.match(result.assets[0].path,/\.png$/);assert.match(result.assets[0].license,/Original/);assert.equal(result.estimatedTotalCost,0);assert.equal(result.assets[0].fallbacks.length,2);}finally{await rm(dir,{recursive:true});}});
test('visual QA rejects monotony, unreadable captions, gaps and narration mismatch',async()=>{const p=await new ShotPlanner().plan({scenes},audio,style,30);const c=composition.parse({width:1920,height:1080,fps:30,durationInFrames:720,scenes:[],cues:[{sceneId:'scene-1',start:0,end:2,text:'tiny captions'}],shots:p.shots,assets:[],visualProfile:style});const changed={...c,shots:[{...c.shots[0],end:20,visualIntent:'unrelated'}],visualProfile:{...style,captionSize:20}};const report=visualQuality(changed);assert.equal(report.checks.find(c=>c.name==='shot pacing')!.passed,false);assert.equal(report.checks.find(c=>c.name==='caption readability')!.passed,false);assert.equal(report.checks.find(c=>c.name==='asset narration alignment')!.passed,false);assert.equal(report.checks.find(c=>c.name==='visual coverage')!.passed,false);});
test('thumbnail rubric penalizes tiny type, excess words and low contrast',()=>{const good=thumbnailScores(4,93,12);const bad=thumbnailScores(10,20,2);assert.ok(good.clarity>bad.clarity);assert.ok(good.mobileReadability>bad.mobileReadability);assert.ok(good.contrast>bad.contrast);const flat=thumbnailScores(4,93,12,{hook:'A title repeated',title:'A title repeated',focalContrast:0});assert.equal(flat.subjectProminence,0);assert.ok(flat.titleComplementarity<good.titleComplementarity);});

test('AI video spending respects the cumulative adapter budget across high-impact shots',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'asset-budget-'));
 try{
  const {exec}=await import('../src/orchestration/io');
  const plan=await new ShotPlanner().plan({scenes},audio,style,30);let calls=0;
  const video={estimateCost:()=>.5,generate:async(_prompt:string,path:string)=>{calls++;await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=navy:s=1280x720:d=4','-c:v','libx264',path],{timeout:10000});}};
  const policy={...await loadCostPolicy(),aiVideoEnabled:true};const ledger=new CostLedger(policy,dir);const result=await withCosts(ledger,()=>createAssets(plan.shots.slice(0,3).map(s=>({...s,highImpact:true,shotType:'generated-image' as const})),{...style,assetBudgetUsd:3,aiVideoBudgetUsd:1},dir,{video,policy}));
  assert.equal(calls,2);assert.equal(result.estimatedTotalCost,1);assert.equal(result.assets[2].provider,'original-editorial');
 }finally{await rm(dir,{recursive:true});}
});
test('mixed audio preserves speech timeline and limits peaks at loud configured music/SFX levels',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'audio-mix-'));
 try{
  const {exec,duration}=await import('../src/orchestration/io');const {mixAudio}=await import('../src/audio');
  const path=join(dir,'voice.wav');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','sine=frequency=220:duration=3','-ar','48000',path],{timeout:10000});
  const v={scenes:[{id:'scene-1',path,duration:3,alignment:[]},{id:'scene-2',path,duration:3,alignment:[]}]};
  const plan=await new ShotPlanner().plan({scenes},audio,style,30);
  const timedShots=plan.shots.slice(0,5).map((s,i)=>({...s,start:i*1.2,end:(i+1)*1.2}));const result=await mixAudio(v,timedShots,{...style,musicDb:-15,sfxDb:-12},dir,30);
  const actual=await duration(result.path);assert.ok(Math.abs(actual-6)<.04,`Expected 6s, received ${actual}s`);const tail=await exec('ffmpeg',['-hide_banner','-ss','5.5','-i',result.path,'-af','volumedetect','-f','null','-']);assert.ok(Number(tail.stderr.match(/mean_volume:\s*(-?[\d.]+) dB/)?.[1]??-100)>-25,'Narration must remain audible at the end; padding a truncated mix is insufficient');assert.ok(result.peakDb<=-1);assert.ok(result.events.length>0);
 }finally{await rm(dir,{recursive:true});}
});
