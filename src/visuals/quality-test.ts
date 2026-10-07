import {parseArgs} from 'node:util';
import {mkdir,copyFile,access,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Runner} from '../orchestration/runner';
import {json,read,duration} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {CostLedger,loadCostPolicy,withCosts} from '../cost';
import {FreeQuotaLedger,withQuota} from '../quota';
import {GeminiProvider} from '../providers/free';
import {CloudflareWorkersAIImageProvider,cloudflareConfigured} from '../providers/cloudflare';
import {semanticQA,semanticReview} from './semantic';
import {createVisualBible,visualBible} from './bible';
import {createHistoricalAssets} from './ai-assets';
import {createCharacterReferencePack,characterPack} from './characters';
import {pronunciations,pronunciationCandidates} from '../voice/chapters';
import {narrateSemanticBlocks} from '../voice/semantic-blocks';
import {visualPreflight,planVisualAssets} from './preflight';
import {historicalPrompt} from './bible';
import {z} from 'zod';
import {ShotPlanner} from '../editor/planner';
import {profile,shotPlan,media,audioMix} from '../editor/schemas';
import {createCaptions} from '../captions';
import {ChapterMusicProvider} from '../audio/chapters';
import {mixAudio} from '../audio';
import {inspectAudio,audioQA} from '../audio/qa';
import * as schemas from '../orchestration/schemas';
import {renderVideo,renderPreview} from '../render';
import {inspect} from '../qa';
import {thumbnails} from '../thumbnail';
import {qualityScript,createQualityScript,historicalScriptReview,correctHistoricalScript,milestoneScript,expandMilestoneScript} from './quality-script';
const {values}=parseArgs({options:{'run-id':{type:'string',default:'free-quality-test'},prepare:{type:'boolean',default:false}}});
async function main(){const id=values['run-id']!;if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Invalid run ID');const dir=join('data/runs',id),assetsDir=join(dir,'assets'),pub=join('public',id);await mkdir(assetsDir,{recursive:true});await mkdir(pub,{recursive:true});const runner=new Runner(dir);await runner.lock();const costs=new CostLedger(await loadCostPolicy(),dir);const quota=new FreeQuotaLedger(dir);await costs.restore();await quota.restore();
 try{await withQuota(quota,()=>withCosts(costs,async()=>{
 if(!((await read('config/narrator.json')).voiceApproved===true&&(await read('config/strategy.json')).imageQualityApproved===true)){await json(join(dir,'approval-blocked.json'),{state:'blocked_until_manual_narrator_and_image_approval',autoPublish:false});throw new Error('Quality video is blocked until the free voice audition is manually approved and image quality is approved');}
 if(!cloudflareConfigured()||!process.env.GEMINI_API_KEY||process.env.GEMINI_FREE_TIER_CONFIRMED!=='true'||process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED!=='true'){await json(join(dir,'configuration-blocked.json'),{state:'blocked_configuration',required:['GEMINI_API_KEY','GEMINI_FREE_TIER_CONFIRMED=true','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','CLOUDFLARE_FREE_PLAN_CONFIRMED=true'],missing:['GEMINI_API_KEY','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN'].filter(k=>!process.env[k]).concat(['GEMINI_FREE_TIER_CONFIRMED','CLOUDFLARE_FREE_PLAN_CONFIRMED'].filter(k=>process.env[k]!=='true')),paidCostUsd:0});throw new Error('Missing free-provider configuration; no synthetic success or paid/stock replacement');}
 const llm=new GeminiProvider();await llm.discover();await costs.setDuration(90);
 let script=await runner.stage('script',qualityScript,()=>createQualityScript(llm));
 const channelIdentity=await read('config/channel-visual-identity.json');const characterRegistry=await read('config/character-registry.json');await json(join(dir,'channel-visual-identity.json'),channelIdentity);await json(join(dir,'character-registry.json'),characterRegistry);
 const bible=await runner.stage('visual-bible',visualBible,()=>createVisualBible({script,channelIdentity,characterRegistry},llm));
 const preflight=await runner.stage('visual-planning',visualPreflight,()=>planVisualAssets(script,bible,llm));
 if(preflight.historicalReview.issues.length||!preflight.historicalReview.passed){const corrected=await runner.stage('historical-script-review',historicalScriptReview,()=>correctHistoricalScript(script,preflight.historicalReview.issues,llm));script=qualityScript.parse(corrected.script);}
 script=await runner.stage('milestone-script',milestoneScript,()=>expandMilestoneScript(script,llm));
 await json(join(dir,'approved-script.json'),script);
 const pronunciationPlan=await runner.stage('milestone-pronunciations',pronunciations,()=>llm.json(`Prepare pronunciations for historical names/places/dates/dynasties/foreign words in this narration: ${script.scenes.map(s=>s.narration).join(' ')}. Candidates ${JSON.stringify(pronunciationCandidates(script.scenes.map(s=>s.narration).join(' ')))}. Return {terms:[{term,category,replacement,verified,source}]}. category people/places/Latin/Greek/Egyptian/dates/dynasties/foreign names. replacement:null unless reliable pronunciation preprocessing is needed. verified:false and source:null if uncertain. Sentence-initial everyday words (Dawn, Porters, Dust, Inside, Vendors) are not foreign names: exclude them. Return terms:[] when no historical names/numbers need pronunciation. Do not alter facts.`,pronunciations));
 await json(join(dir,'synthesis-pronunciations.json'),pronunciationPlan);
 const plannedAssets=preflight.assets.map((a,i)=>({id:a.id,sceneId:a.sceneId,start:i,end:i+1,narration:'Untimed planning only',visualIntent:a.prompt,shotType:'generated-image' as const,motion:'parallax' as const,assetPrompt:a.prompt,assetKey:a.id,overlay:null,keywords:[],highImpact:false,transition:'cut' as const}));
 await createCharacterReferencePack(characterRegistry.characters[0],bible,assetsDir,new CloudflareWorkersAIImageProvider(),llm,true);
 await createHistoricalAssets(plannedAssets,bible,assetsDir,new CloudflareWorkersAIImageProvider(),llm,{},true);
 const approvedPrompts=plannedAssets.map(a=>historicalPrompt(bible,a.assetPrompt));
 await runner.stage('planning-ready',z.object({ready:z.literal(true),paidProviderCostUsd:z.literal(0)}),async()=>({ready:true,paidProviderCostUsd:0}));
 if(values.prepare){await json(join(dir,'prepared.json'),{state:'all_planning_and_prompt_reviews_ready',cpuModelsRequiredNext:true,paidProviderCostUsd:0});return;}
 const plan=schemas.plan.parse({scenes:script.scenes.map(({id,narration,visual})=>({id,narration,visual}))});const narrator=await read('config/narrator.json');const voice=await runner.stage('voice',schemas.voice,()=>narrateSemanticBlocks(plan,assetsDir,narrator.referenceAudioPath,pronunciationPlan),async v=>{for(const a of v.scenes)await access(a.path);});const seconds=voice.scenes.reduce((n,v)=>n+Math.ceil(v.duration*30)/30,0);if(seconds<80||seconds>105)throw new Error(`Narration duration ${seconds}s outside near-90-second quality window; no time stretching`);
 const style=profile.parse(await read('config/visual-profiles/history.json'));const captions=await runner.stage('captions',schemas.captions,async()=>createCaptions(plan,voice,30));
 await json(join(dir,'narrator-QA.json'),{provider:'chatterbox-nano',cloningMode:'audio_prompt_path',referenceSha256:await fileDigest(narrator.referenceAudioPath),approvalScope:'90-second quality milestone',blocks:await Promise.all(voice.scenes.map(async s=>({id:s.id,...await read(s.path+'.voice-QA.json')})))});
 const planned=await runner.stage('shots',shotPlan,()=>new ShotPlanner().plan(plan,voice,style,30,undefined,true));const used=new Map<string,number>();let characterIndex=0;
 const shots=planned.shots.map((s,i)=>{const options=preflight.assets.filter(a=>a.sceneId===s.sceneId);if(!options.length)throw new Error('Planning missing scene assets');const index=used.get(s.sceneId)??0;used.set(s.sceneId,index+1);const asset=options[Math.floor(index/2)%options.length];const person=index===1||index===4;return {...s,shotType:'generated-image' as const,assetKey:person?'CHAR_MERCHANT_01':asset.id,assetPrompt:asset.prompt,visualIntent:s.narration+'; '+(person?'Canonical merchant identity; ':asset.prompt),editorialReframe:person?characterIndex++%3:index%2,overlay:null,motion:(i%3===0?'parallax':s.motion) as typeof s.motion};});
 const character=await runner.stage('character-pack',characterPack,()=>createCharacterReferencePack(characterRegistry.characters[0],bible,assetsDir,new CloudflareWorkersAIImageProvider(),llm));const canonicalAssets={CHAR_MERCHANT_01:character.assets.map(a=>a.path)};
 const visuals=await runner.stage('visuals',media,()=>createHistoricalAssets(shots,bible,assetsDir,new CloudflareWorkersAIImageProvider(),llm,canonicalAssets,false,approvedPrompts),async v=>{for(const a of v.assets)if(a.sha256!==await fileDigest(a.path))throw new Error('Image integrity failure');});
 const semantic=await runner.stage('semantic-QA',semanticQA,()=>semanticReview(script,bible,shots,visuals.assets,llm));if(!semantic.passed)throw new Error('Gemini semantic QA rejected images/script');
 const audio=await runner.stage('audio-mix',audioMix,()=>mixAudio(voice,shots,style,assetsDir,30,new ChapterMusicProvider([{duration:seconds,direction:'restrained ancient harbor atmosphere, reflective'}],true)));const audioQAReport=await runner.stage('audio-QA',audioQA,()=>inspectAudio(audio.path,{expectedDuration:seconds,narrationPath:audio.narrationPath,musicPath:audio.duckedMusicPath,voiceIds:voice.chapters?.map(c=>c.identity),requireMusic:true}));if(!audioQAReport.passed)throw new Error('Quality test audio QA failed');
 for(const v of voice.scenes)await copyFile(v.path,join(pub,`${v.id}.wav`));await copyFile(audio.path,join(pub,'mixed.wav'));for(const a of visuals.assets){await copyFile(a.path,join(pub,`${a.shotId}.png`));for(const [k,p] of Object.entries(a.depthLayers!))await copyFile(p,join(pub,`${a.shotId}-${k}.png`));}
 let from=0;const composition=await runner.stage('composition',schemas.composition,async()=>({width:1920,height:1080,fps:30,durationInFrames:Math.round(seconds*30),scenes:plan.scenes.map(s=>{const frames=Math.ceil(voice.scenes.find(v=>v.id===s.id)!.duration*30);const a=visuals.assets.find(a=>shots.find(x=>x.id===a.shotId)?.sceneId===s.id)!;const result={id:s.id,text:s.narration,audio:`${id}/${s.id}.wav`,image:`${id}/${a.shotId}.png`,from,frames};from+=frames;return result;}),shots,assets:visuals.assets.map(a=>({...a,path:`${id}/${a.shotId}.png`,depthLayers:Object.fromEntries(Object.keys(a.depthLayers!).map(k=>[k,`${id}/${a.shotId}-${k}.png`])) as typeof a.depthLayers})),cues:captions.cues,visualProfile:style,audioMixPath:`${id}/mixed.wav`,thumbnailTitle:script.title}));
 const video=await runner.stage('render',schemas.rendered,async()=>{const path=join(dir,'final.mp4');await renderVideo(composition,path);return {path,duration:await duration(path),sha256:await fileDigest(path)};});const metadata=schemas.metadata.parse({title:script.title,description:'Visual quality evaluation. AI-generated historical reconstruction, not archival evidence. Synthesized Chatterbox Nano narration. Original procedural CC0 music is an explicit test bed; no external music API.',tags:['quality test'],categoryId:'27',privacyStatus:'private',madeForKids:false,syntheticMedia:true,publishAt:null});await json(join(dir,'metadata.json'),metadata);
 const qa=await runner.stage('qa',schemas.qa,()=>inspect(video.path,script,composition,{passed:true,issues:[],checkedClaims:0,review:'Imagined historical reconstruction; no event-specific empirical claims'},metadata,[...voice.scenes,...visuals.assets,{path:audio.path}].map(a=>a.path)));
 const reviewOnly=['duplicated scenes','shot pacing','asset repetition','asset narration alignment'];const hardFailures=qa.checks.filter(c=>!c.passed&&!reviewOnly.includes(c.name));await json(join(dir,'milestone-QA.json'),{status:hardFailures.length?'fail':qa.passed?'pass':'review',hardFailures,reviews:qa.checks.filter(c=>!c.passed&&reviewOnly.includes(c.name)),publicationAllowed:false});if(hardFailures.length)throw new Error('Objective render QA failed: '+hardFailures.map(c=>c.name).join(', '));
 await runner.stage('thumbnail',schemas.thumbnail,()=>thumbnails(composition,dir,undefined,preflight.thumbnailTexts,true));for(const second of [5,20,40,60,85])if(second<seconds)await renderPreview(composition,join(dir,`frame-${second}.png`),second*30);
 const events=(await readFile(join(dir,'logs.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));await json(join(dir,'quality-summary.json'),{paidProviderCostUsd:0,imageCount:costs.entries.filter(e=>e.category==='generatedImages'&&e.state==='completed').length,visualBeatCount:visuals.assets.length,voiceProvider:'chatterbox-nano',referenceCloningMode:'audio_prompt_path',referenceAudioPath:narrator.referenceAudioPath,canonicalCharacterId:character.characterId,recurringCharacterCount:1,canonicalCharacterAssetCount:character.assets.length,geminiModelsUsed:[...new Set(events.filter(e=>e.event==='gemini_attempt'&&e.status===200).map(e=>e.model))],geminiHistory:events.filter(e=>['gemini_retry','gemini_fallback'].includes(e.event)),fallbacks:['Original CC0 procedural score for this test; replace with licensed production beds after review'],duration:seconds,humanImageAndVoiceApprovalRequired:true,autoPublish:false});
 }));}finally{await costs.report();await quota.report();await runner.unlock();}}
main().catch(e=>{console.error(JSON.stringify({event:'quality_test_failed',message:e.message}));process.exitCode=1;});
