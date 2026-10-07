import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {VisualThinkingDirector,localVisualIdea,validateIdeaEvidence} from '../src/visuals/visual-thinking';
import {visualIdea} from '../src/visuals/thinking-schema';
import {doodleSVG} from '../src/visuals/doodle-art';
import {createDoodleAssets} from '../src/visuals/doodle-assets';
import {inspectVisualIdeas,reviewDoodleFrame} from '../src/visuals/doodle-qa';
import {loadStyleLock} from '../src/visuals/style-lock';
import {exec} from '../src/orchestration/io';
import {reviewDoodleSet} from '../src/visuals/doodle-set-qa';
import type {Shot} from '../src/editor/schemas';
import {compositionVariety} from '../src/editor/quality';
const make=(id:string,narration:string):Shot=>({id,sceneId:'s1',start:0,end:3,narration,visualIntent:narration,shotType:'generated-image',motion:'parallax',assetPrompt:'unused old prompt',overlay:null,keywords:[],highImpact:true,transition:'light-leak'});
test('new identity cancels realism and is inherited verbatim without Gemini style fields',async()=>{
 const lock=await loadStyleLock();assert.equal(lock.version,'educational-doodle-v3');assert.ok(lock.prefix.startsWith('Flat 2D educational historical illustration'));assert.match(lock.lineQuality,/thick/);assert.ok(lock.negativeRules.includes('no classical painterly realism'));
 assert.throws(()=>visualIdea.parse({...localVisualIdea('A merchant pays coins'),style:'photorealistic'}));
});
test('showcase counts actual educational concepts rather than the legacy icon-scene transport type',async()=>{
 const inputs=['A child begins work','A jar of oil','A path across the city','A morning payment'];const shots=await new VisualThinkingDirector().direct(inputs.map((text,i)=>make('s'+i,text)));
 assert.equal(compositionVariety({shots}),4);assert.equal(compositionVariety({shots:shots.map(s=>({...s,visualIdea:shots[0].visualIdea}))}),1);
});
test('visual thinking preserves speech timings, associates ideas, and produces no arbitrary statistics',async()=>{
 const originals=[make('s1','A child begins work'),{...make('s2','A sealed clay jar'),start:3,end:6}];
 const directed=await new VisualThinkingDirector().direct(originals);
 assert.deepEqual(directed.map(s=>[s.id,s.sceneId,s.start,s.end,s.narration]),originals.map(s=>[s.id,s.sceneId,s.start,s.end,s.narration]));
 assert.ok(directed.every(s=>s.visualIdea&&s.transition==='cut'));assert.ok(directed[0].visualIdea!.nodes.some(n=>n.icon==='child'));assert.ok(directed[0].visualIdea!.nodes.some(n=>n.icon==='tool'));assert.equal(inspectVisualIdeas(directed).passed,true);
 const invented=localVisualIdea('A child begins work');invented.nodes[0].label='7 YEARS OLD';assert.throws(()=>validateIdeaEvidence(invented,'A child begins work'),/invents/);
});
test('director rejects changed IDs and does not expose style controls to its LLM',async()=>{
 let calls=0;const narration='Coins paid for oil';const input=make('s1',narration);
 const output=await new VisualThinkingDirector().direct([input],{json:async<T>(prompt:string,schema:z.ZodType<T>)=>{assert.match(prompt,/never HOW/);calls++;return schema.parse({ideas:[{shotId:calls===1?'wrong-id':'s1',idea:localVisualIdea(narration)}]});}});
 assert.equal(calls,2);assert.equal(output[0].id,'s1');assert.equal(output[0].narration,narration);
});
test('invalid relations, crowded comparisons and repeated educational concepts fail',async()=>{
 const idea=localVisualIdea('A child begins work');assert.throws(()=>visualIdea.parse({...idea,relationships:[{from:'missing',to:idea.nodes[0].id,label:''}]}));assert.throws(()=>visualIdea.parse({...idea,conceptType:'COMPARE_TWO',nodes:idea.nodes.slice(0,1)}));
 const same=await new VisualThinkingDirector().direct([make('a','A sealed jar'),{...make('b','A sealed jar'),start:3,end:6}]);assert.equal(inspectVisualIdeas(same).passed,false);
});
test('original vector scene produces readable raster, XML-safe labels and progressive construction',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'doodle-v3-'));try{
  const shots=await new VisualThinkingDirector().direct([make('a','A child begins work')]);const idea=shots[0].visualIdea!;idea.nodes[0].label='<svg & tag>';
  const early=doodleSVG(idea,0),late=doodleSVG(idea,1);assert.notEqual(early,late);assert.ok(late.includes('&lt;svg &amp; tag&gt;'));assert.ok(!late.includes('<svg & tag>'));assert.match(late,/font-size="46"/);assert.match(late,/stroke-width="6"/);
  const media=await createDoodleAssets(shots,dir);assert.equal(media.estimatedTotalCost,0);assert.equal(media.assets[0].provider,'original-doodle-v3');assert.match(media.assets[0].license,/Original/);
  const {stdout}=await exec('ffprobe',['-v','error','-show_streams','-of','json',media.assets[0].path]);const stream=JSON.parse(stdout).streams[0];assert.equal(stream.width,1920);assert.equal(stream.height,1080);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('frame QA cannot pass old painterly realism or mismatched ideas through a contradictory passed flag',async()=>{
 const image={mimeType:'image/png',data:'actual-test-bytes'};
 const review=await reviewDoodleFrame('Child with work tool',image,{images:async<T>(instruction:string,images:unknown,schema:z.ZodType<T>)=>{assert.match(instruction,/HARD REJECT/);assert.match(instruction,/OLD painted historical contact sheet/);assert.deepEqual(images,[image]);return schema.parse({passed:true,styleCompliant:false,subjectMatches:true,historicallyPlausible:true,unintendedWriting:false,issues:['Painterly realism']});}});
 assert.equal(review.passed,false);
});
test('batch QA inspects actual raster bytes, validates image IDs and preserves a failed semantic decision',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'doodle-review-v3-'));try{
  const shots=await new VisualThinkingDirector().direct([make('child','A child begins work'),{...make('coins','She pays silver coins'),start:3,end:6}]);const assets=await createDoodleAssets(shots,dir);let calls=0;
  const qa=await reviewDoodleSet(shots,assets.assets,{images:async<T>(prompt:string,images:{mimeType:string;data:string}[],schema:z.ZodType<T>)=>{calls++;assert.equal(images.length,2);assert.ok(images.every(i=>i.mimeType==='image/jpeg'&&Buffer.from(i.data,'base64').length>1000));assert.match(prompt,/OLD painted contact sheet is forbidden/);return schema.parse({reviews:shots.map((s,i)=>({shotId:calls===1?'wrong-id':s.id,passed:true,styleCompliant:true,subjectMatches:i===0,historicallyPlausible:true,readable:true,issues:i?['Idea mismatch']:[]}))});}});
  assert.equal(calls,2);assert.equal(qa.passed,false);assert.deepEqual(qa.reviews[1].issues,['Idea mismatch']);assert.equal(qa.method,'actual-image Gemini review');
 }finally{await rm(dir,{recursive:true,force:true});}
});
