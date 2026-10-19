import {test} from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {VisualThinkingDirector,localVisualIdea,validateIdeaEvidence,unsupportedVisualNumbers} from '../src/visuals/visual-thinking';
import {visualIdea} from '../src/visuals/thinking-schema';
import {doodleSVG,doodleGlyph} from '../src/visuals/doodle-art';
import {createDoodleAssets} from '../src/visuals/doodle-assets';
import {inspectVisualIdeas,reviewDoodleFrame} from '../src/visuals/doodle-qa';
import {loadStyleLock} from '../src/visuals/style-lock';
import {exec} from '../src/orchestration/io';
import {reviewDoodleSet} from '../src/visuals/doodle-set-qa';
import type {Shot} from '../src/editor/schemas';
import {compositionVariety} from '../src/editor/quality';
const make=(id:string,narration:string):Shot=>({id,sceneId:'s1',start:0,end:3,narration,visualIntent:narration,shotType:'generated-image',motion:'parallax',assetPrompt:'unused old prompt',overlay:null,keywords:[],highImpact:true,transition:'light-leak'});
test('visual numeric evidence accepts spoken equivalents and refuses changed values, substrings and ordinal changes',()=>{
 assert.deepEqual(unsupportedVisualNumbers('300 × 50','Three hundred cubits long and fifty wide.'),[]);
 assert.deepEqual(unsupportedVisualNumbers('1,000','One thousand people.'),[]);
 assert.deepEqual(unsupportedVisualNumbers('150','A hundred and fifty days.'),[]);
 assert.deepEqual(unsupportedVisualNumbers('30','Three hundred cubits long.'),['30']);
 assert.deepEqual(unsupportedVisualNumbers('40','Fourteen days.'),['40']);
 assert.deepEqual(unsupportedVisualNumbers('3','The third level.'),['3']);
 assert.deepEqual(unsupportedVisualNumbers('3rd','The third level.'),[]);
});
test('real illustration contract accepts narrated dimensions in words without bypassing unsupported-number rejection',async()=>{
 const narration='Three hundred cubits long and fifty cubits wide.';const shot=make('dimensions',narration);
 const provider=(overlay:string)=>({json:async<T>(_prompt:string,schema:z.ZodType<T>)=>schema.parse({ideas:[{id:shot.id,narration,historicalContext:'Interpretive illustration of the Genesis account; uncertain date.',concept:'Eli points at the long side of an illustrated wooden ark, with space reserved for the editorial dimension label.',overlay,overlayAnchor:'Three hundred cubits',labelPlacement:'top',characterRoles:['Eli']}]})});
 const result=await new VisualThinkingDirector().illustrate([shot],provider('300 × 50'),true);assert.equal(result[0].overlay,'300 × 50');assert.equal(result[0].narration,narration);
 await assert.rejects(()=>new VisualThinkingDirector().illustrate([shot],provider('30 × 50'),true));
});
test('an explicitly absent label accepts an absent model anchor without inventing timing for a real label',async()=>{
 const narration='Eli reads the source beside the drawing.';const shot=make('no-label',narration);
 const provider=(overlay:string|null)=>({json:async<T>(_prompt:string,schema:z.ZodType<T>)=>schema.parse({ideas:[{id:shot.id,narration,historicalContext:'Interpretive biblical source-reading illustration, uncertain date.',concept:'Eli studies a blank manuscript beside a simple illustrated wooden vessel, with no text drawn inside the artwork.',overlay,overlayAnchor:null,labelPlacement:'top',characterRoles:['Eli']}]})});
 const [result]=await new VisualThinkingDirector().illustrate([shot],provider(null),true);assert.equal(result.overlay,null);assert.equal(result.overlayAnchor,undefined);assert.equal(result.narration,narration);
 await assert.rejects(()=>new VisualThinkingDirector().illustrate([shot],provider('SOURCE'),true));
});
test('production may omit rejected optional numeric text only after its exact decision is preserved',async()=>{
 const narration='The text specifies lower, second, and third stories.';const shot=make('levels',narration);
 const raw={ideas:[{id:shot.id,narration,historicalContext:'Interpretive Genesis construction illustration, uncertain date.',concept:'Eli points into a wooden ark cutaway to explain the levels described in the text, without lettering inside the artwork.',overlay:'3 LEVELS',overlayAnchor:'lower, second, and third',labelPlacement:'top',characterRoles:['Eli']}]};
 const llm={json:async<T>(_prompt:string,schema:z.ZodType<T>)=>schema.parse(raw)};const decisions:unknown[]=[];
 const [result]=await new VisualThinkingDirector().illustrate([shot],llm,true,async d=>{decisions.push(d);});
 assert.equal(result.overlay,null);assert.equal(result.overlayAnchor,undefined);assert.equal(result.illustrationIdea?.overlay,null);assert.equal(result.narration,narration);assert.equal(raw.ideas[0].overlay,'3 LEVELS');
 assert.equal(decisions.length,1);assert.deepEqual((decisions[0] as {unsupportedNumbers:string[]}).unsupportedNumbers,['3']);assert.equal((decisions[0] as {originalOverlay:string}).originalOverlay,'3 LEVELS');
 await assert.rejects(()=>new VisualThinkingDirector().illustrate([shot],llm,true,async()=>{throw Error('Evidence disk unavailable');}),/Evidence disk unavailable/);
 await assert.rejects(()=>new VisualThinkingDirector().illustrate([shot],llm,true),/unsupported number/);
});
test('active v4 identity cancels code clipart; legacy scene graphs remain debug evidence only',async()=>{
 const lock=await loadStyleLock();assert.equal(lock.version,'illustrated-doodle-v4.2');assert.ok(lock.prefix.startsWith('Hand-drawn-looking 2D historical editorial cartoon'));assert.match(lock.lineQuality,/thick/);assert.ok(lock.negativeRules.includes('no geometric stick figures'));
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
test('hierarchy and reverse relationships preserve arrow direction and keep relation text beside the graph',()=>{
 const idea=visualIdea.parse({version:'educational-doodle-v3',conceptType:'HIERARCHY',takeaway:'Two social levels',nodes:[{id:'a',icon:'person',label:'First',pose:'neutral',emphasis:false},{id:'b',icon:'person',label:'Second',pose:'neutral',emphasis:false}],relationships:[{from:'a',to:'b',label:'next'}]});
 const coordinates=(svg:string)=>svg.match(/d="M([\d.]+) ([\d.]+) L([\d.]+) ([\d.]+)" pathLength="1"/)!.slice(1).map(Number);
 const forward=coordinates(doodleSVG(idea));assert.ok(forward[3]>forward[1],'Higher-to-lower relationship must point down, not overlap/invert');
 const reverse=coordinates(doodleSVG({...idea,relationships:[{from:'b',to:'a',label:'back'}]}));assert.ok(reverse[3]<reverse[1]);assert.ok(doodleSVG(idea).includes('<text x="670"'),'Relation label must not overlap the figure column');
 const horizontal=coordinates(doodleSVG({...idea,conceptType:'PROCESS',relationships:[{from:'b',to:'a',label:'back'}]}));assert.ok(horizontal[2]<horizontal[0],'Right-to-left edges must not use rightward anchor offsets');
});
test('selective idea repair preserves narration/timing and untouched shots, and rejects unknown IDs before a call',async()=>{
 const originals=await new VisualThinkingDirector().direct([make('a','Rows of clay jars'),{...make('b','She pays coins'),start:3,end:6}]);let calls=0;
 const llm={json:async<T>(prompt:string,schema:z.ZodType<T>)=>{assert.match(prompt,/box,wind,spray/);assert.match(prompt,/Every relationship requires/);assert.match(prompt,/horizontal repeated nodes/);calls++;const idea=visualIdea.parse({version:'educational-doodle-v3',conceptType:'ICON_EXPLANATION',takeaway:'Illustrative bulk oil inventory',nodes:['j1','j2','j3'].map((id,i)=>({id,icon:'amphora',label:i===1?'ROWS OF JARS':'',pose:'neutral',emphasis:i===1})),relationships:[]});return schema.parse({ideas:[{shotId:'a',idea}]});}};
 const fixed=await new VisualThinkingDirector().repair(originals,[{shotId:'a',issues:['Single jar cannot show a row']}],llm);assert.equal(fixed[0].visualIdea!.nodes.length,3);assert.deepEqual(fixed.map(s=>[s.id,s.start,s.end,s.narration]),originals.map(s=>[s.id,s.start,s.end,s.narration]));assert.equal(fixed[1],originals[1]);
 await assert.rejects(new VisualThinkingDirector().repair(originals,[{shotId:'missing',issues:['unknown']}],llm),/unknown/);assert.equal(calls,1);
});
test('environment and cargo primitives have distinct original glyphs instead of unrelated symbols',()=>{
 for(const icon of ['wind','spray','box'] as const){assert.ok(doodleGlyph(icon).length>40);assert.notEqual(doodleGlyph(icon),doodleGlyph('sun'));assert.notEqual(doodleGlyph(icon),doodleGlyph('tool'));}
 assert.equal(new Set(['wind','spray','box'].map(i=>doodleGlyph(i as 'wind'|'spray'|'box'))).size,3);
});
