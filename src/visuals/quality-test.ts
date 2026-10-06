import {parseArgs} from 'node:util';
import {mkdir,copyFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {Runner} from '../orchestration/runner';
import {json,read,duration} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {CostLedger,loadCostPolicy,withCosts} from '../cost';
import {FreeQuotaLedger,withQuota} from '../quota';
import {GeminiProvider} from '../providers/free';
import {CloudflareWorkersAIImageProvider,cloudflareConfigured} from '../providers/cloudflare';
import {ChatterboxNanoProvider} from '../providers/chatterbox';
import {semanticQA,semanticReview} from './semantic';
import {createVisualBible,visualBible} from './bible';
import {createHistoricalAssets} from './ai-assets';
import {narrateChapters} from '../voice/chapters';
import {ShotPlanner} from '../editor/planner';
import {profile,shotPlan,media,audioMix} from '../editor/schemas';
import {createCaptions} from '../captions';
import {ChapterMusicProvider} from '../audio/chapters';
import {mixAudio} from '../audio';
import {inspectAudio,audioQA} from '../audio/qa';
import * as schemas from '../orchestration/schemas';
import {renderVideo,renderPreview} from '../render';
import {inspect,requireQA} from '../qa';
import {thumbnails} from '../thumbnail';
const {values}=parseArgs({options:{'run-id':{type:'string',default:'free-quality-test'},prepare:{type:'boolean',default:false}}});
async function main(){const id=values['run-id']!;if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Invalid run ID');const dir=join('data/runs',id),assetsDir=join(dir,'assets'),pub=join('public',id);await mkdir(assetsDir,{recursive:true});await mkdir(pub,{recursive:true});const runner=new Runner(dir);await runner.lock();const costs=new CostLedger(await loadCostPolicy(),dir);const quota=new FreeQuotaLedger(dir);await costs.restore();await quota.restore();
 try{await withQuota(quota,()=>withCosts(costs,async()=>{
 if(!cloudflareConfigured()||!process.env.GEMINI_API_KEY||process.env.GEMINI_FREE_TIER_CONFIRMED!=='true'||process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED!=='true'){await json(join(dir,'configuration-blocked.json'),{state:'blocked_configuration',required:['GEMINI_API_KEY','GEMINI_FREE_TIER_CONFIRMED=true','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_FREE_PLAN_CONFIRMED=true'],missing:['GEMINI_API_KEY','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN'].filter(k=>!process.env[k]).concat(['GEMINI_FREE_TIER_CONFIRMED','CLOUDFLARE_FREE_PLAN_CONFIRMED'].filter(k=>process.env[k]!=='true')),paidCostUsd:0});throw new Error('Missing free-provider configuration; no synthetic success or paid/stock replacement');}
 const llm=new GeminiProvider();await costs.setDuration(75);
 const script=await runner.stage('script',schemas.script,()=>llm.json('Write an original English 60-90 second HISTORICAL VISUAL QUALITY TEST, 190-210 words TOTAL, four scenes with IDs scene-1..scene-4. Set in an imagined Mediterranean harbor around 200 BCE, without naming real historical figures. Explicitly describe it as an imagined reconstruction, not evidence of a specific event. No empirical claims or fabricated quotations. Several visual settings: ancient harbor, stone courtyard, papyrus workshop, market. Return {title,topic,hook,scenes:[{id,narration,visual,claims:[]}]}. Continuous compelling narration, no welcome intro. No dates/numbers in narration that require ASR normalization.',schemas.script));
 const bible=await runner.stage('visual-bible',visualBible,()=>createVisualBible(script,llm));
 if(values.prepare){await json(join(dir,'prepared.json'),{state:'script_and_bible_ready',cpuModelsRequiredNext:true,paidProviderCostUsd:0});return;}
 const plan=schemas.plan.parse({scenes:script.scenes.map(({id,narration,visual})=>({id,narration,visual}))});const voice=await runner.stage('voice',schemas.voice,()=>narrateChapters(plan,new ChatterboxNanoProvider(),assetsDir,140,'chatterbox-nano:nano-default:pinned-71ccd1d'),async v=>{for(const a of v.scenes)await access(a.path);});const seconds=voice.scenes.reduce((n,v)=>n+Math.ceil(v.duration*30)/30,0);if(seconds<60||seconds>90)throw new Error(`Narration duration ${seconds}s outside quality-test 60-90s; no time stretching`);
 const style=profile.parse(await read('config/visual-profiles/history.json'));const captions=await runner.stage('captions',schemas.captions,async()=>createCaptions(plan,voice,30));
 const planned=await runner.stage('shots',shotPlan,()=>new ShotPlanner().plan(plan,voice,style,30,llm));const shots=planned.shots.map(s=>({...s,shotType:'generated-image' as const}));
 const visuals=await runner.stage('visuals',media,()=>createHistoricalAssets(shots,bible,assetsDir,new CloudflareWorkersAIImageProvider()),async v=>{for(const a of v.assets)if(a.sha256!==await fileDigest(a.path))throw new Error('Image integrity failure');});
 const semantic=await runner.stage('semantic-QA',semanticQA,()=>semanticReview(script,bible,shots,visuals.assets,llm));if(!semantic.passed)throw new Error('Gemini semantic QA rejected images/script');
 const audio=await runner.stage('audio-mix',audioMix,()=>mixAudio(voice,shots,style,assetsDir,30,new ChapterMusicProvider([{duration:seconds,direction:'restrained ancient harbor atmosphere, reflective'}],true)));const audioQAReport=await runner.stage('audio-QA',audioQA,()=>inspectAudio(audio.path,{expectedDuration:seconds,narrationPath:audio.narrationPath,musicPath:audio.duckedMusicPath,voiceIds:voice.chapters?.map(c=>c.identity),requireMusic:true}));if(!audioQAReport.passed)throw new Error('Quality test audio QA failed');
 for(const v of voice.scenes)await copyFile(v.path,join(pub,`${v.id}.wav`));await copyFile(audio.path,join(pub,'mixed.wav'));for(const a of visuals.assets){await copyFile(a.path,join(pub,`${a.shotId}.png`));for(const [k,p] of Object.entries(a.depthLayers!))await copyFile(p,join(pub,`${a.shotId}-${k}.png`));}
 let from=0;const composition=await runner.stage('composition',schemas.composition,async()=>({width:1920,height:1080,fps:30,durationInFrames:Math.round(seconds*30),scenes:plan.scenes.map(s=>{const frames=Math.ceil(voice.scenes.find(v=>v.id===s.id)!.duration*30);const a=visuals.assets.find(a=>shots.find(x=>x.id===a.shotId)?.sceneId===s.id)!;const result={id:s.id,text:s.narration,audio:`${id}/${s.id}.wav`,image:`${id}/${a.shotId}.png`,from,frames};from+=frames;return result;}),shots,assets:visuals.assets.map(a=>({...a,path:`${id}/${a.shotId}.png`,depthLayers:Object.fromEntries(Object.keys(a.depthLayers!).map(k=>[k,`${id}/${a.shotId}-${k}.png`])) as typeof a.depthLayers})),cues:captions.cues,visualProfile:style,audioMixPath:`${id}/mixed.wav`,thumbnailTitle:script.title}));
 const video=await runner.stage('render',schemas.rendered,async()=>{const path=join(dir,'final.mp4');await renderVideo(composition,path);return {path,duration:await duration(path),sha256:await fileDigest(path)};});const metadata=schemas.metadata.parse({title:script.title,description:'Visual quality evaluation. AI-generated historical reconstruction, not archival evidence. Synthesized Chatterbox Nano narration. Original procedural CC0 music is an explicit test bed; no external music API.',tags:['quality test'],categoryId:'27',privacyStatus:'private',madeForKids:false,syntheticMedia:true,publishAt:null});await json(join(dir,'metadata.json'),metadata);
 const qa=await runner.stage('qa',schemas.qa,()=>inspect(video.path,script,composition,{passed:true,issues:[],checkedClaims:0,review:'Imagined historical reconstruction; no event-specific empirical claims'},metadata,[...voice.scenes,...visuals.assets,{path:audio.path}].map(a=>a.path)));requireQA(qa);
 await runner.stage('thumbnail',schemas.thumbnail,()=>thumbnails(composition,dir,llm));for(const second of [5,20,40,60])if(second<seconds)await renderPreview(composition,join(dir,`frame-${second}.png`),second*30);
 await json(join(dir,'quality-summary.json'),{paidProviderCostUsd:0,imageCount:visuals.assets.length,voiceProvider:'chatterbox-nano',fallbacks:['Original CC0 procedural score for this test; replace with licensed production beds after review'],duration:seconds,humanImageAndVoiceApprovalRequired:true,autoPublish:false});
 }));}finally{await costs.report();await quota.report();await runner.unlock();}}
main().catch(e=>{console.error(JSON.stringify({event:'quality_test_failed',message:e.message}));process.exitCode=1;});
