import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {z} from 'zod';
import {Runner} from '../src/orchestration/runner';
import {digest} from '../src/orchestration/integrity';
import {requireQA,requiredQAChecks} from '../src/qa';
import {scheduleAllowed} from '../src/youtube';
import {demoScript} from '../src/script';
import {demoResearch} from '../src/research';
import {factcheck} from '../src/factcheck';
import {metadata,script} from '../src/orchestration/schemas';
import {createCaptions} from '../src/captions';
import {learn} from '../src/analytics';
test('completed stages resume without rerunning; failed stages retry',async()=>{const dir=await mkdtemp(join(tmpdir(),'autopilot-'));try{const runner=new Runner(dir);let count=0;const schema=z.object({ok:z.boolean()});await runner.stage('a',schema,async()=>{count++;return {ok:true};});await runner.stage('a',schema,async()=>{count++;return {ok:false};});assert.equal(count,1);await assert.rejects(runner.stage('b',schema,async()=>{throw new Error('provider unavailable');}));assert.equal(JSON.parse(await readFile(join(dir,'status.json'),'utf8')).state,'failed');const result=await runner.stage('b',schema,async()=>({ok:true}));assert.equal(result.ok,true);}finally{await rm(dir,{recursive:true});}});
test('corrupted cache is rejected, not silently regenerated',async()=>{const dir=await mkdtemp(join(tmpdir(),'autopilot-'));try{await writeFile(join(dir,'a.json'),'{"ok":"invalid"}');await writeFile(join(dir,'a.integrity.json'),JSON.stringify({sha256:digest({ok:true})}));await assert.rejects(new Runner(dir).stage('a',z.object({ok:z.boolean()}),async()=>({ok:true})));}finally{await rm(dir,{recursive:true});}});
test('lock prevents concurrent runs',async()=>{const dir=await mkdtemp(join(tmpdir(),'autopilot-'));const a=new Runner(dir);await a.lock();await assert.rejects(new Runner(dir).lock());await a.unlock();await rm(dir,{recursive:true});});
test('QA failure, empty report, and contradictory checks block upload',()=>{assert.throws(()=>requireQA({passed:false,checks:[]}));assert.throws(()=>requireQA({passed:true,checks:[]}));assert.throws(()=>requireQA({passed:true,checks:Array.from({length:11},()=>({passed:false}))}));assert.throws(()=>requireQA({passed:true,checks:Array.from({length:11},()=>({passed:true}))}));const complete=requiredQAChecks.map(name=>({name,passed:true}));requireQA({passed:true,checks:complete});assert.throws(()=>requireQA({passed:true,checks:complete.slice(1)}));});
test('scheduling needs both explicit gates',()=>{const s={autoPublish:false,publishAt:'2099-01-01T00:00:00Z'};assert.throws(()=>scheduleAllowed(s,'true'));assert.throws(()=>scheduleAllowed({...s,autoPublish:true},'false'));scheduleAllowed({...s,autoPublish:true},'true');scheduleAllowed({autoPublish:false,publishAt:null},'false');});
test('unknown factual citations fail',async()=>{const changed=structuredClone(demoScript);changed.scenes[1].claims.push({text:'An invented claim',sourceUrl:'https://example.com/invented',kind:'fact'});assert.equal((await factcheck(changed,demoResearch)).passed,false);assert.equal((await factcheck(demoScript,demoResearch)).passed,true);});
test('metadata cannot request public upload',()=>{assert.equal(metadata.safeParse({title:'A test title',description:'A test description',tags:[],categoryId:'27',privacyStatus:'public',madeForKids:false,syntheticMedia:true,publishAt:null}).success,false);});
test('captions cover narration and stay within audio duration',()=>{const p={scenes:script.parse(demoScript).scenes};const result=createCaptions(p,{scenes:p.scenes.map(s=>({id:s.id,path:'audio.wav',duration:10,alignment:[{start:0,end:10,text:s.narration}]}))});assert.equal(result.cues.at(-1)?.end,p.scenes.length*10);for(const scene of p.scenes)assert.equal(result.cues.filter(c=>c.sceneId===scene.id).map(c=>c.text).join(' '),scene.narration);});
test('learning cannot claim evidence from zero videos',async()=>{const result=await learn([]);assert.equal(result.sampleSize,0);assert.deepEqual(result.recommendations,[]);});

test('persistent storage reserves keys atomically',async()=>{const {LocalStorage}=await import('../src/database/storage');const dir=await mkdtemp(join(tmpdir(),'autopilot-storage-'));try{const store=new LocalStorage(dir);const results=await Promise.all([store.create('upload-test',{state:'pending'}),store.create('upload-test',{state:'pending'})]);assert.equal(results.filter(Boolean).length,1);await store.put('upload-test',{state:'uploaded',videoId:'abc'});assert.deepEqual(await store.get('upload-test'),{state:'uploaded',videoId:'abc'});assert.equal((await store.list('upload-')).length,1);}finally{await rm(dir,{recursive:true});}});

test('FFmpeg QA rejects black video and silence',async()=>{const {exec}=await import('../src/orchestration/io');const {inspect}=await import('../src/qa');const dir=await mkdtemp(join(tmpdir(),'autopilot-qa-'));try{const video=join(dir,'black.mp4');await exec('ffmpeg',['-y','-v','error','-f','lavfi','-i','color=c=black:s=320x240:r=30:d=3','-f','lavfi','-i','anullsrc=r=22050:cl=mono','-t','3','-c:v','libx264','-c:a','aac',video]);const input=script.parse(demoScript);const report=await inspect(video,input,{fps:30,width:320,height:240,durationInFrames:90,scenes:[],cues:[],shots:[],assets:[]},{passed:true,issues:[],checkedClaims:2,review:'test'}, {title:input.title,description:'Test description',tags:[],categoryId:'27',privacyStatus:'private',madeForKids:false,syntheticMedia:true,publishAt:null},[]);assert.equal(report.passed,false);assert.equal(report.checks.find(x=>x.name==='black frames')?.passed,false);assert.equal(report.checks.find(x=>x.name==='silent sections')?.passed,false);}finally{await rm(dir,{recursive:true});}});

test('offline factual review rejects altered claims even with known source URLs',async()=>{const changed=structuredClone(demoScript);changed.scenes[1].narration='Remotion guarantees every video receives a million views.';changed.scenes[1].claims.push({text:changed.scenes[1].narration,sourceUrl:demoResearch.sources[0].url,kind:'fact'});assert.equal((await factcheck(changed,demoResearch)).passed,false);});

test('a timeout leaves recoverable dead PID evidence but live and malformed locks stay protected',async()=>{const dir=await mkdtemp(join(tmpdir(),'autopilot-lock-'));try{await writeFile(join(dir,'.lock'),'2147483647');const runner=new Runner(dir);await runner.lock();assert.equal(await readFile(join(dir,'.lock'),'utf8'),String(process.pid));await assert.rejects(new Runner(dir).lock());await runner.unlock();await writeFile(join(dir,'.lock'),'not-a-pid');await assert.rejects(runner.lock());assert.equal(await readFile(join(dir,'.lock'),'utf8'),'not-a-pid');}finally{await rm(dir,{recursive:true,force:true});}});
test('automatic publish picks the next daily UTC slot with enough processing lead time',async()=>{
 const {nextPublishSlot}=await import('../src/youtube');
 assert.equal(nextPublishSlot({publishTimeUtc:'17:00',minLeadHours:3},new Date('2026-10-10T12:00:00Z')),'2026-10-10T17:00:00.000Z');
 assert.equal(nextPublishSlot({publishTimeUtc:'17:00',minLeadHours:3},new Date('2026-10-10T15:30:00Z')),'2026-10-11T17:00:00.000Z');
 assert.equal(nextPublishSlot({},new Date('2026-10-10T22:00:00Z')),'2026-10-11T17:00:00.000Z');
});
test('v5 thumbnail concepts give each variant its own backdrop, an exaggerated face and a gaze toward the object',async()=>{
 const {thumbnailConcept}=await import('../src/packaging/thumbnails');
 const c={focalSubject:'Breakthrough',expressionOrSituation:'light bursts through the rock',background:'tunnel'};
 const a=thumbnailConcept(c,true,0),b=thumbnailConcept(c,true,1),d=thumbnailConcept(c,true,2);
 for(const x of [a,b,d]){assert.ok(x.length<=420);assert.match(x,/EXAGGERATED/);assert.match(x,/looking toward/);assert.match(x,/No lettering/);}
 assert.notEqual(a,b);assert.notEqual(b,d);
});
test('title candidates never frame archaeology as proving or disproving the Bible',async()=>{
 const {faithProofTitle}=await import('../src/orchestration/production-summary');
 assert.equal(faithProofTitle("The 1880 Discovery That Proved the Bible's Tunnel"),true);
 assert.equal(faithProofTitle('Archaeology Debunks the Bible?'),true);
 assert.equal(faithProofTitle('How Hezekiah Cut a River Through a Mountain'),false);
 assert.equal(faithProofTitle('The Proof Carved in Stone'),false);
});
