import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,copyFile,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {z} from 'zod';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import template from '../config/style-lock-v4.json';
import {illustratedStyleLock,referenceAnalysis,traitNames,acceptStyleReview,requireIllustratedArtwork,requireV4VideoApproval,type StyleReview} from '../src/visuals/illustration-schema';
import {styleAuditionScenesV4} from '../src/visuals/style-audition-scenes-v4';
import {illustrationPrompt,generateIllustration,inspectIllustrationReuse} from '../src/visuals/illustrated-assets-v4';
import {analyzeStyleReference,deriveStyleLock,reviewIllustration} from '../src/visuals/style-reference-v4';
import {runStyleAuditionV4} from '../src/visuals/style-audition-v4';
import {illustrationContactSheet} from '../src/visuals/style-contact-sheet-v4';
import {Runner} from '../src/orchestration/runner';
import {fileDigest} from '../src/orchestration/integrity';
import {exec,read} from '../src/orchestration/io';
import {CostLedger,loadCostPolicy,withCosts} from '../src/cost';
import {ShotView} from '../remotion/templates/ShotView';
import {Thumbnail} from '../remotion/compositions/Thumbnail';
import type {Shot,MediaAsset} from '../src/editor/schemas';
const good=():StyleReview=>({passed:true,referenceCompared:true,referenceStyleMatches:true,conceptMatches:true,historicallyPlausible:true,cropPreservesSubjects:true,photorealism:false,cgi:false,geometricCodeLook:false,webUILook:false,bakedText:false,watermark:false,scores:{drawnAppearance:85,lineCharacter:85,humanDesign:85,colorTreatment:85,visualSimplicity:85,organicShapes:85,educationalClarity:85,sceneRichness:85,illustratedFeel:85},issues:[]});
const active=(sha='a'.repeat(64))=>illustratedStyleLock.parse({...template,referenceAnalysisStatus:'analysed',referenceSha256:sha,referenceStyleDescriptor:'Organic expressive illustrated figures, designed garments, warm muted fills and irregular thick dark ink outlines.'});
async function fixture(dir:string,name:string){const path=join(dir,name+'.png');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','testsrc2=size=256x256','-frames:v','1',path],{timeout:20000});return path;}
function shot():Shot {const i=styleAuditionScenesV4[0];return {id:i.id,sceneId:i.id,start:0,end:3,narration:i.narration,visualIntent:i.concept,shotType:'generated-image',motion:'slow-push-in',assetPrompt:i.concept,overlay:i.overlay,illustrationIdea:i,keywords:[],highImpact:false,transition:'cut'};}
test('final scene/thumbnail renderers reject geometric SVG art even if the old shot claims a visual idea',()=>{
 const asset:MediaAsset={shotId:shot().id,path:'debug-geometric.svg',kind:'graphic',provider:'original-doodle-v3',license:'debug-only',sourceUrl:null,estimatedCost:0,intent:'legacy geometry',fallbacks:[],sha256:'a'.repeat(64)};
 assert.throws(()=>requireIllustratedArtwork(asset),/Primary artwork/);
 assert.throws(()=>renderToStaticMarkup(React.createElement(ShotView,{shot:shot(),asset,frames:90,index:0})),/Primary artwork/);
 assert.throws(()=>renderToStaticMarkup(React.createElement(Thumbnail,{width:1920,height:1080,fps:30,durationInFrames:90,scenes:[],cues:[],shots:[shot()],assets:[asset]})),/actual v4 AI illustration/);
 assert.throws(()=>requireIllustratedArtwork({...asset,kind:'image',provider:'cloudflare-flux-free',path:'pretend-ai.png'}),/provenance/);
});
test('style gates reject photorealism, geometric code look, UI, CGI, crop damage and contradictory passed flags',()=>{
 assert.equal(acceptStyleReview(good(),70).passed,true);
 for(const flag of ['photorealism','cgi','geometricCodeLook','webUILook','bakedText','watermark'] as const)assert.equal(acceptStyleReview({...good(),[flag]:true},70).passed,false);
 for(const flag of ['referenceCompared','referenceStyleMatches','conceptMatches','historicallyPlausible','cropPreservesSubjects'] as const)assert.equal(acceptStyleReview({...good(),[flag]:false},70).passed,false);
 assert.equal(acceptStyleReview({...good(),scores:{...good().scores,organicShapes:40}},70).passed,false);
 assert.equal(acceptStyleReview({...good(),issues:['Clipped hands']},70).passed,false);
});
test('all 12 distinct audition scenes inherit one immutable style; label text is never supplied to FLUX',()=>{
 assert.equal(styleAuditionScenesV4.length,12);assert.equal(new Set(styleAuditionScenesV4.map(s=>s.concept)).size,12);
 for(const idea of styleAuditionScenesV4){const prompt=illustrationPrompt(active(),idea);assert.ok(prompt.startsWith(template.prefix));assert.ok(prompt.length<=2048);assert.ok(!prompt.includes(idea.overlay!));assert.match(prompt,/draw NO words/);assert.ok(prompt.includes(idea.historicalContext));}
 assert.throws(()=>illustrationPrompt(illustratedStyleLock.parse(template),styleAuditionScenesV4[0]),/Actual reference analysis/);
});
test('human gate blocks every video before actual analysis and dated human style approval',()=>{
 assert.throws(()=>requireV4VideoApproval(illustratedStyleLock.parse(template)),/No demo/);
 assert.throws(()=>requireV4VideoApproval(active()),/human approval/);
 assert.throws(()=>illustratedStyleLock.parse({...template,visualSystemApproved:true,approvedAt:'2026-10-07T20:00:00Z'}));
 requireV4VideoApproval(illustratedStyleLock.parse({...active(),visualSystemApproved:true,approvedAt:'2026-10-07T20:00:00Z'}));
});
test('actual reference analysis supplies image bytes, traits and palette; it never manufactures missing evidence',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'v4-reference-'));try{const reference=await fixture(dir,'positive-unit-fixture');let calls=0;
 const result=await analyzeStyleReference(reference,{images:async<T>(prompt:string,images:{mimeType:string;data:string}[],schema:z.ZodType<T>)=>{calls++;assert.equal(images.length,1);assert.ok(Buffer.from(images[0].data,'base64').length>100);assert.match(prompt,/Ignore browser/);return schema.parse({usable:true,containsIllustrations:true,confidence:.8,traits:Object.fromEntries(traitNames.map(t=>[t,'Observed unit-test trait; not a real style audition.'])),palette:['#f5edda','#b65f45','#c79443','#302a25'],descriptor:'Organic illustrated figures with irregular dark outlines and warm muted flat colors.',limitations:[],issues:[]});}});
 assert.equal(calls,1);assert.equal(result.referenceSha256,await fileDigest(reference));assert.equal(result.multimodalAnalysisExecuted,true);assert.equal(referenceAnalysis.parse(result).status,'analysed');const derived=deriveStyleLock(illustratedStyleLock.parse(template),result);assert.equal(derived.prefix,template.prefix);assert.deepEqual(derived.colorPalette,result.observations.palette);assert.equal(derived.visualSystemApproved,false);
 await assert.rejects(()=>analyzeStyleReference(join(dir,'missing.png'),{images:async()=>{throw new Error('Must not reach inference');}}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('reference QA executes on reference, original and delivery bytes; changed reference is refused before inference',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'v4-review-'));try{const reference=await fixture(dir,'reference'),source=await fixture(dir,'source'),framed=await fixture(dir,'delivery');let calls=0;
 const vision={images:async<T>(prompt:string,images:{mimeType:string;data:string}[],schema:z.ZodType<T>)=>{calls++;assert.equal(images.length,3);assert.ok(images.every(i=>Buffer.from(i.data,'base64').length>100));assert.match(prompt,/POSITIVE reference/);return schema.parse({...good(),geometricCodeLook:true});}};
 const result=await reviewIllustration(reference,source,framed,styleAuditionScenesV4[0],active(await fileDigest(reference)),vision);assert.equal(calls,1);assert.equal(result.passed,false);
 await assert.rejects(()=>reviewIllustration(reference,source,framed,styleAuditionScenesV4[0],active('b'.repeat(64)),vision),/integrity/);assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('source reuse limits reject consecutive and excessive repeats while allowing bounded separated reuse',()=>{
 assert.equal(inspectIllustrationReuse([{id:'a',sha256:'one'},{id:'b',sha256:'two'},{id:'c',sha256:'one'}]).passed,true);
 assert.equal(inspectIllustrationReuse([{id:'a',sha256:'one'},{id:'b',sha256:'one'}]).passed,false);
 assert.equal(inspectIllustrationReuse([{id:'a',sha256:'one'},{id:'b',sha256:'two'},{id:'c',sha256:'one'},{id:'d',sha256:'three'},{id:'e',sha256:'one'}]).passed,false);
});
test('historical/style prompt rejection prevents FLUX calls and geometry fallback',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'v4-prompt-gate-'));try{const reference=await fixture(dir,'reference'),style=active(await fileDigest(reference));let calls=0;const costs=new CostLedger(await loadCostPolicy(),dir);
 await assert.rejects(()=>withCosts(costs,()=>generateIllustration(styleAuditionScenesV4[0],style,reference,dir,new Runner(dir),{generate:async()=>{calls++;}},{images:async<T>(_p:string,_i:unknown,s:z.ZodType<T>)=>s.parse({passed:false,historicallyPlausible:false,styleConsistent:true,noBakedText:true,issues:['Modern clothes']})})),/BEFORE FLUX/);assert.equal(calls,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('accepted sources resume without another FLUX call and corrupt source bytes fail closed',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'v4-resume-'));try{const reference=await fixture(dir,'reference'),source=await fixture(dir,'debug-only-provider-unit-fixture'),style=active(await fileDigest(reference));let calls=0,comparisons=0;
 const provider={generate:async(_p:string,path:string)=>{calls++;await copyFile(source,path);}};const vision={images:async<T>(p:string,i:unknown[],s:z.ZodType<T>)=>{if(i.length===1)return s.parse({passed:true,historicallyPlausible:true,styleConsistent:true,noBakedText:true,issues:[]});comparisons++;return s.parse(good());}};const runner=new Runner(dir),costs=new CostLedger(await loadCostPolicy(),dir);
 const first=await withCosts(costs,()=>generateIllustration(styleAuditionScenesV4[0],style,reference,dir,runner,provider,vision));await withCosts(costs,()=>generateIllustration(styleAuditionScenesV4[0],style,reference,dir,runner,provider,vision));assert.equal(calls,1);assert.equal(comparisons,1);assert.equal(first.review.passed,true);await writeFile(first.source.path,'corrupt');await assert.rejects(()=>withCosts(costs,()=>generateIllustration(styleAuditionScenesV4[0],style,reference,dir,runner,provider,vision)),/checksum/);assert.equal(calls,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('contact sheets contain source image pixels and separate captions; no video is created',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'v4-sheet-'));try{const a=await fixture(dir,'a'),b=await fixture(dir,'b'),before=await fileDigest(a),output=join(dir,'sheet.jpg');await illustrationContactSheet([{id:'a',path:a},{id:'b',path:b}],output,join(dir,'tiles'),2);assert.equal(await fileDigest(a),before);assert.ok((await readFile(output)).length>1000);const probe=await exec('ffprobe',['-v','error','-show_streams','-of','json',output]);assert.equal(JSON.parse(probe.stdout).streams[0].width,768);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('missing downloadable positive reference stops the audition before secrets or inference',async()=>{
 const id='style-v4-missing-reference-unit-'+Date.now(),dir=join('data/runs',id);try{await assert.rejects(()=>runStyleAuditionV4({runId:id,reference:'/tmp/intentionally-missing-v4-positive.png'}),/Downloadable positive reference missing/);const summary=await read(join(dir,'audition-summary-v4.json'));assert.equal(summary.fluxGenerationCountThisExecution,0);assert.equal(summary.videoGenerated,false);assert.equal(summary.paidCostUsd,0);assert.equal((await read(join(dir,'style-reference-analysis-v4.json'))).multimodalAnalysisExecuted,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
