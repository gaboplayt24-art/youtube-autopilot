import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {densityReview,applyHumanAssetApproval,acceptDensityReview} from '../src/visuals/density-qa';
import {fileDigest} from '../src/orchestration/integrity';
import {targetDuration,durationConfig} from '../src/longform';
import {validatePlannedReuse,uniqueRevisionKey} from '../src/visuals/illustrated-video-assets';
import type {Shot} from '../src/editor/schemas';
import {applyEditorialRevision,editorialRevision} from '../src/visuals/visual-thinking';
test('evidence-based visual revisions preserve speech timing, refuse unknown IDs and retain independent source evidence',async()=>{
 const revision=editorialRevision.parse(JSON.parse(await readFile('data/scripts/production-approved-001-visual-revisions.json','utf8')));
 const idea=(id:string)=>({...revision.sourceRevisions[0].replacement,id});
 const shots=revision.sourceRevisions.map((r,i)=>({id:'beat-'+i,assetKey:r.sourceId,illustrationIdea:idea(r.sourceId),narration:'Exact speech '+i,start:i*3,end:i*3+3,overlay:'EXPLAIN',visualIntent:'Explain actual historical mechanism'} as Shot));
 for(const r of revision.beatReassignments)shots.push({...shots[0],id:r.shotId,assetKey:'video-source-8',illustrationIdea:idea('video-source-8')});
 for(const id of new Set(revision.beatReassignments.map(r=>r.sourceId)))if(!shots.some(s=>s.assetKey===id))shots.push({...shots[0],id:'original-'+id,assetKey:id,illustrationIdea:idea(id)});
 const before=JSON.stringify(shots),revised=applyEditorialRevision(shots,revision,revision.runId);
 assert.equal(JSON.stringify(shots),before);
 assert.deepEqual(revised.map(s=>[s.id,s.start,s.end,s.narration]),shots.map(s=>[s.id,s.start,s.end,s.narration]));
 assert.equal(revised[0].assetKey,revision.sourceRevisions[0].replacement.id);
 for(const r of revision.beatReassignments)assert.equal(revised.find(s=>s.id===r.shotId)!.assetKey,revision.sourceRevisions.find(x=>x.sourceId===r.sourceId)?.replacement.id??r.sourceId);
 assert.throws(()=>applyEditorialRevision(shots,revision,'other-run'),/different run/);
 assert.throws(()=>applyEditorialRevision(shots,{...revision,beatReassignments:[{...revision.beatReassignments[0],shotId:'unknown'}]},revision.runId),/unknown beat/);
});
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

test('research quotations come from retrieved bytes instead of reconstructed model prose',async()=>{
 const {retrievedParagraphs}=await import('../src/research');const paragraph='Water from the bath outfall flowed into a channel beneath the street. This is a fixture, not historical evidence.';
 assert.deepEqual(retrievedParagraphs(`<html><p>${paragraph}</p><p>too short</p></html>`),[paragraph]);
 const marked=retrievedParagraphs(`<p>Water from the <em>bath outfall</em> flowed into a channel beneath the street. This is a fixture.</p>`)[0];assert.match(marked,/bath outfall/);assert.equal(marked.includes('<em>'),false);
});

test('component reuse keeps meaningful source regions and rejects almost-full or inverted crop boxes',async()=>{
 const {componentCrop}=await import('../src/editor/schemas');const crop={bounds:[.55,.08,.95,.86],subject:'Complete drawn Roman bather',kind:'character',placement:'right'};
 assert.equal(componentCrop.safeParse(crop).success,true);
 for(const bounds of [[0,0,1,1],[.7,.1,.3,.8],[-.1,0,.4,.8]])assert.equal(componentCrop.safeParse({...crop,bounds}).success,false);
});

test('production factual review anchors objections and preserves minor advice without bypassing historical errors',async()=>{
 const {factcheck}=await import('../src/factcheck');
 const script={title:'Roman Drainage',topic:'Roman drains',hook:'Where did the water go?',criticalTerms:[],scenes:[{id:'drain',narration:'Drainage channels carried water. The sewer guaranteed disease protection.',visual:'Roman drain',claims:[]}]};
 const research={topic:'Roman drains',summary:'Drainage is not modern treatment.',sources:[{url:'https://example.com/source',title:'Source',excerpt:'Drainage channels carried water. Disease persisted despite sanitation infrastructure.'}]};
 const review=async(severity:'major'|'minor')=>factcheck(script,research,{json:async<T>(_prompt:string,schema:import('zod').ZodType<T>)=>schema.parse({observations:[{narrationQuote:severity==='major'?'The sewer guaranteed disease protection.':'Drainage channels carried water.',sourceQuote:'Drainage channels carried water.',severity,reason:severity==='major'?'Unsupported disease protection guarantee':'The supported summary could name the location for editorial specificity'}],checkedClaims:2,review:'Current script assessed against supplied evidence'})},true);
 assert.equal((await review('major')).passed,false);
 const advice=await review('minor');assert.equal(advice.passed,true);assert.equal(advice.advisories?.length,1);
 let calls=0;
 await assert.rejects(factcheck(script,research,{json:async<T>(_prompt:string,schema:import('zod').ZodType<T>)=>{calls++;return schema.parse({observations:[{narrationQuote:'The baths were built in 101 CE.',sourceQuote:null,severity:'major',reason:'This allegation is absent from the narration'}],checkedClaims:2,review:'Unanchored assessment'});}},true));
 assert.equal(calls,3);
});

test('ordinal representations normalize without equating ordinal and cardinal facts',async()=>{
 const {compareTranscripts,evaluateVoice,loadVoiceQAPolicy}=await import('../src/voice/qa');
 assert.equal(compareTranscripts('In the 1st century AD','In the first century AD').wordErrorRate,0);
 assert.notEqual(compareTranscripts('first ruler','one ruler').wordErrorRate,0);
 assert.notEqual(compareTranscripts('second dynasty','third dynasty').wordErrorRate,0);
 const report=evaluateVoice('In the 1st century AD',{text:'In the first century AD',chunks:[{text:'In the first century AD',timestamp:[0,2]}]},['1st'],await loadVoiceQAPolicy());
 assert.equal(report.criticalTermAccuracy,1);
});

test('bounded visual planning preserves every measured beat with 8–12 sources and no consecutive full-source reuse',async()=>{
 const {planIllustratedReuse}=await import('../src/visuals/visual-thinking');
 const {shot:schema}=await import('../src/editor/schemas');
 const shots=Array.from({length:29},(_,i)=>schema.parse({id:`real-measured-${i}`,sceneId:'roman-drain',start:i*3.5,end:(i+1)*3.5,narration:'Roman bath water flushed public latrines.',visualIntent:'Explain the source-grounded flow.',shotType:'generated-image',motion:'pan-left',assetPrompt:'Original illustrated Roman bath and drain',overlay:'USED BATHWATER',keywords:[],highImpact:i===0,transition:'cut'}));
 let calls=0;
 const planned=await planIllustratedReuse(shots,{json:async<T>(prompt:string,contract:import('zod').ZodType<T>)=>{calls++;const batch=JSON.parse(prompt.split('Locked batch: ')[1]);return contract.parse({sources:batch.sourceIds.map((id:string)=>({id,narration:'Roman bath water flushed public latrines.',historicalContext:'Ancient Rome, early imperial period',concept:'Original Roman bath interior with a clothed citizen and a visible drain, flat muted 2D illustration.',overlay:null,labelPlacement:'left',characterRoles:['Roman citizen']})),edits:batch.assignments.map((a:{shotId:string})=>({shotId:a.shotId,editorialPurpose:'Explain this actual water route using the relevant illustrated component.',overlay:'USED BATHWATER',arrow:null}))});}});
 assert.equal(calls,5);assert.deepEqual(planned.map(s=>[s.id,s.start,s.end,s.narration]),shots.map(s=>[s.id,s.start,s.end,s.narration]));
 assert.equal(new Set(planned.map(s=>s.assetKey)).size,10);assert.ok(planned.every((s,i)=>i===0||s.assetKey!==planned[i-1].assetKey));
 for(const id of new Set(planned.map(s=>s.assetKey)))assert.ok(planned.filter(s=>s.assetKey===id).length<=3);
});
test('every production visual revision fits the native Klein prompt limit before quota is spent',async()=>{
 const {nativePrompt}=await import('../src/visuals/native-v4-2');const {illustratedStyleLock}=await import('../src/visuals/illustration-schema');
 const style=illustratedStyleLock.parse(JSON.parse(await readFile('config/style-lock-v4.json','utf8')));
 const revision=editorialRevision.parse(JSON.parse(await readFile('data/scripts/production-approved-001-visual-revisions.json','utf8')));
 const bible=editorialRevision.parse(JSON.parse(await readFile('data/scripts/bible-test-001-visual-revisions.json','utf8')));
 for(const r of [...revision.sourceRevisions,...bible.sourceRevisions])for(const wording of ['v1','v2','v3'] as const)assert.ok(nativePrompt(style,r.replacement,wording).length<=2048,r.replacement.id+' '+wording);
 const roman=revision.sourceRevisions[0].replacement;assert.match(nativePrompt(style,roman,'v1'),/Roman pipes/);assert.doesNotMatch(nativePrompt(style,roman,'v2'),/pipe/i);assert.ok(nativePrompt(style,roman,'v2').length<=nativePrompt(style,roman,'v1').length);assert.doesNotMatch(nativePrompt(style,roman,'v3'),/pipe|water works/i);
});
test('component crops accept Gemini 0–1000 boxes but keep every crop rule',async()=>{
 const {componentCrop}=await import('../src/editor/schemas');const crop=(bounds:number[])=>({bounds,subject:'stone bench',kind:'object',placement:'left'});
 assert.deepEqual(componentCrop.parse(crop([100,200,500,800])).bounds,[.1,.2,.5,.8]);
 assert.deepEqual(componentCrop.parse(crop([.1,.2,.5,.8])).bounds,[.1,.2,.5,.8]);
 assert.throws(()=>componentCrop.parse(crop([0,0,1000,1000])),/entire completed scene/);
 assert.throws(()=>componentCrop.parse(crop([100,200,1500,800])));
});
test('component reuse keeps a saved plan only for the identical reused beat set',async()=>{
 const {componentReuseStage}=await import('../src/visuals/illustrated-video-assets');const {mkdtemp,writeFile}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'reuse-'));
 assert.equal(await componentReuseStage(dir,'src',['a','b']),'native-src-component-reuse');
 await writeFile(join(dir,'native-src-component-reuse.json'),JSON.stringify({uses:[{shotId:'b'},{shotId:'a'}]}));
 assert.equal(await componentReuseStage(dir,'src',['a','b']),'native-src-component-reuse');
 const changed=await componentReuseStage(dir,'src',['a','c']);assert.match(changed,/^native-src-component-reuse-[0-9a-f]{12}$/);
 assert.equal(changed,await componentReuseStage(dir,'src',['c','a']));
});
test('thumbnail revisions are run-scoped, evidence-based and fit the Klein prompt limit',async()=>{
 const {thumbnailRevision}=await import('../src/packaging/thumbnails');
 const r=thumbnailRevision.parse(JSON.parse(await readFile('data/scripts/production-approved-001-thumbnail-revisions.json','utf8')));
 assert.equal(r.runId,'production-approved-001');
 for(const x of r.revisions){assert.match(x.id,new RegExp('^thumbnail-'+x.variant+'-'));assert.doesNotMatch(x.concept,/isometric|hose|valve|pipe/i);}
 assert.throws(()=>thumbnailRevision.parse({runId:'x',revisions:[{variant:'C',id:'source-1',concept:'x'.repeat(40),characterRoles:[],reason:'evidence reason'}]}));
});
test('biblical production test reads its own draft and gets ancient Near East period rules',async()=>{
 const draft=JSON.parse(await readFile('data/scripts/bible-test-001-editorial-draft.json','utf8'));
 assert.ok(draft.sourceUrls.length>=2&&draft.sourceUrls.every((u:string)=>u.startsWith('https://en.wikipedia.org/')));
 const words=draft.narration.trim().split(/\s+/).length;assert.ok(words>=230&&words<=265,String(words));
 assert.match(draft.scriptGuidance,/uncertain/);assert.match(draft.instruction,/Iron Age Judah/);
 const {nativePrompt}=await import('../src/visuals/native-v4-2');const {illustratedStyleLock}=await import('../src/visuals/illustration-schema');
 const style=illustratedStyleLock.parse(JSON.parse(await readFile('config/style-lock-v4.json','utf8')));
 const idea={id:'bible-source-1',narration:'Two teams dug toward each other.',historicalContext:'Iron Age Judah, Jerusalem, around 700 BCE; rock-cut tunnel, oil lamps, wool tunics.',concept:'Two adult diggers with iron picks break through the last thin wall of rock inside a narrow tunnel lit by a clay oil lamp.',overlay:null,labelPlacement:'top' as const,characterRoles:['digger','digger']};
 const prompt=nativePrompt(style,idea,'v3');
 assert.match(prompt,/Ancient Near East dress/);assert.match(prompt,/Ancient setting/);assert.doesNotMatch(prompt,/Roman/);assert.ok(prompt.length<=2048);
});
test('packaged thumbnail concepts keep close-up focal guidance within the artwork concept limit',async()=>{
 const {thumbnailConcept}=await import('../src/packaging/thumbnails');
 const short=thumbnailConcept({focalSubject:'worried digger',expressionOrSituation:'Shocked as the rock wall cracks',background:'dark tunnel'});
 assert.match(short,/Close-up/);assert.ok(short.length<=420);
 const long=thumbnailConcept({focalSubject:'x'.repeat(150),expressionOrSituation:'y'.repeat(150),background:'z'.repeat(150)});
 assert.ok(long.length<=420);
});
test('editorial arrows accept 0–1000 coordinates by rescaling and keep 0–1 coordinates',async()=>{
 const {normalizedArrow}=await import('../src/visuals/visual-thinking');
 assert.deepEqual(normalizedArrow([100,200,500,1000]),[.1,.2,.5,1]);
 assert.deepEqual(normalizedArrow([.1,.2,.3,.4]),[.1,.2,.3,.4]);
 assert.deepEqual(normalizedArrow([-5,2,3,4]),[-5,2,3,4]);
});
test('thumbnail concepts are shortened at word boundaries until Near East prompts fit the Klein limit',async()=>{
 const {nativePrompt,fitNativeConcept}=await import('../src/visuals/native-v4-2');const {illustratedStyleLock}=await import('../src/visuals/illustration-schema');
 const style=illustratedStyleLock.parse(JSON.parse(await readFile('config/style-lock-v4.json','utf8')));
 const idea={id:'thumbnail-A-hq',narration:"Hezekiah's Tunnel",historicalContext:'Iron Age Judah, about 700 BCE; '.padEnd(180,'x'),concept:('One focal bearded digger raising an iron pick in a lamplit tunnel, ').repeat(7).slice(0,420),overlay:null,labelPlacement:'top' as const,characterRoles:[]};
 assert.throws(()=>nativePrompt(style,idea,'v3'),/exceeds 2048/);
 const fitted=fitNativeConcept(style,idea);assert.ok(fitted.concept.length<idea.concept.length&&fitted.concept.startsWith('One focal bearded digger'));
 for(const w of ['v1','v2','v3'] as const)assert.ok(nativePrompt(style,fitted,w).length<=2048);
 assert.equal(fitNativeConcept(style,{...idea,historicalContext:'Iron Age Judah',concept:'Short concept with a digger and lamp.'}).concept,'Short concept with a digger and lamp.');
});
test('v5 audition prompts fit Klein, failed reviews never pass, and only the audition flag permits a reference-free draw',async()=>{
 const {v5Prompt,v5Scenes,v5Passed}=await import('../src/visuals/style-audition-v5');const {CloudflareReferenceImageProvider}=await import('../src/providers/cloudflare');
 for(const s of v5Scenes)assert.ok(v5Prompt(s.prompt).length<=2048,s.id);
 const ok={characterConsistent:true,roundHeadStyle:true,anatomyDefects:[],anachronisms:[],frameOrBorder:false,textInImage:false,matchesScene:true,notes:''};
 assert.ok(v5Passed(ok));for(const bad of [{frameOrBorder:true},{textInImage:true},{anatomyDefects:['extra arm']},{anachronisms:['flashlight']},{roundHeadStyle:false}])assert.ok(!v5Passed({...ok,...bad}));
 await assert.rejects(new CloudflareReferenceImageProvider(async()=>{throw new Error('must not call');}).generate('x','/tmp/never.png',{width:1536,height:864}),/requires actual input_image_0 reference/);
});
test('owner-approved v5 lock pins the Eli reference and its Near East prompts fit Klein',async()=>{
 const {nativePrompt}=await import('../src/visuals/native-v4-2');const {illustratedStyleLock}=await import('../src/visuals/illustration-schema');const {fileDigest}=await import('../src/orchestration/integrity');
 const style=illustratedStyleLock.parse(JSON.parse(await readFile('config/style-lock-v5.json','utf8')));
 assert.equal(style.version,'round-head-v5');assert.equal(style.referenceSha256,await fileDigest('assets/references/style-v5-eli.png'));
 const idea={id:'x',narration:'n n n n n',historicalContext:'Iron Age Judah, about 700 BCE; '.padEnd(180,'x'),concept:'c'.repeat(420),overlay:null,labelPlacement:'top' as const,characterRoles:['Eli','city guard']};
 const prompt=nativePrompt(style,idea,'v3');assert.ok(prompt.length<=2048);assert.match(prompt,/Eli/);assert.doesNotMatch(prompt,/no mascot heads/);
 const v4=illustratedStyleLock.parse(JSON.parse(await readFile('config/style-lock-v4.json','utf8')));assert.match(nativePrompt(v4,{...idea,concept:'c'.repeat(200)},'v3'),/Mature human cartoon anatomy/);
 const draft=JSON.parse(await readFile('data/scripts/bible-test-002-editorial-draft.json','utf8'));const words=draft.narration.split(/\s+/).length;assert.ok(words>=241&&words<=255,String(words));assert.match(draft.narration,/^Right now, you can turn a tap/);
});
test('one-image-per-beat mode uses a revised beat fresh evidence ID and keeps unrevised beat IDs',()=>{
 const shots=[{id:'a',assetKey:'a'},{id:'b',assetKey:'b-modern-repair'},{id:'c',assetKey:'shared'},{id:'d',assetKey:'shared'},{id:'e'}] as unknown as Shot[];
 assert.deepEqual(shots.map(s=>uniqueRevisionKey(shots,s)),['a','b-modern-repair','c','d','e']);
});
test('the single v5 regeneration states the cast and anatomy positively within prompt limits',async()=>{
 const {regenerationIdea}=await import('../src/visuals/illustrated-video-assets');const {illustratedStyleLock}=await import('../src/visuals/illustration-schema');
 const style=illustratedStyleLock.parse(JSON.parse(await readFile('config/style-lock-v5.json','utf8')));
 const idea={id:'shot-2',narration:'Eli looks at the valley with worry.',historicalContext:'Judah, late 8th century BCE, outside the city wall.',concept:'Eli stands on a rocky ridge gesturing toward the valley below with a worried expression, simple sky. '.repeat(4).slice(0,400),overlay:null,labelPlacement:'left' as const,characterRoles:['Eli']};
 const next=regenerationIdea(idea,style);
 assert.equal(next.id,'shot-2-regen1');assert.ok(next.concept.length<=420&&next.concept.length>=30);assert.match(next.concept,/Exactly 1 adult character \(Eli\)/);assert.match(next.concept,/striped ochre head cloth/);assert.doesNotMatch(next.concept,/avoid|extra|second/i);
});
