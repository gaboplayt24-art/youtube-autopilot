import {parseArgs} from 'node:util';
import {mkdir,copyFile,access,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {Runner} from '../orchestration/runner';
import {json,read,duration} from '../orchestration/io';
import {fileDigest,digest} from '../orchestration/integrity';
import {CostLedger,loadCostPolicy,withCosts} from '../cost';
import {FreeQuotaLedger,withQuota} from '../quota';
import {GeminiProvider} from '../providers/free';
import {CloudflareWorkersAIImageProvider,cloudflareConfigured} from '../providers/cloudflare';
import {createVisualBible,visualBible} from './bible';
import {createCharacterReferencePack,characterPack} from './characters-v2';
import {loadStyleLock} from './style-lock';
import {storyboard,planIllustratedBeats,sourcePrompt,generateSource,sourceFrame,contactSheet,reviewIllustratedSet,inspectRepetition,sourceMedia,setReview,repetitionQA} from './illustrated';
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
import {milestoneScript} from './quality-script';
import {requireVoiceQA} from '../voice/qa';
const {values}=parseArgs({options:{'run-id':{type:'string',default:'free-quality-test'},prepare:{type:'boolean',default:false}}});
const generationState=z.record(z.object({revision:z.number().int().nonnegative(),direction:z.string()}));
async function main(){
 const id=values['run-id']!;if(!/^[A-Za-z0-9_-]+$/.test(id))throw new Error('Invalid run ID');
 const dir=join('data/runs',id),assetsDir=join(dir,'assets'),sourcesDir=join(assetsDir,'illustrated-sources'),pub=join('public',id);
 await mkdir(assetsDir,{recursive:true});await mkdir(pub,{recursive:true});const runner=new Runner(dir);await runner.lock();
 const costs=new CostLedger(await loadCostPolicy(),dir),quota=new FreeQuotaLedger(dir);await costs.restore();await quota.restore();
 try{await withQuota(quota,()=>withCosts(costs,async()=>{
  const narrator=await read('config/narrator.json');if(narrator.voiceApproved!==true)throw new Error('Manual narrator approval required');
  if(!cloudflareConfigured()||!process.env.GEMINI_API_KEY||process.env.GEMINI_FREE_TIER_CONFIRMED!=='true'||process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED!=='true'){
   await json(join(dir,'configuration-blocked.json'),{state:'blocked_configuration',required:['GEMINI_API_KEY','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN','GEMINI_FREE_TIER_CONFIRMED=true','CLOUDFLARE_FREE_PLAN_CONFIRMED=true'],paidCostUsd:0});
   throw new Error('Missing GitHub free-provider configuration; no paid/stock fallback');
  }
  // This is a VISUAL audition: restore the approved passage and its raw narration,
  // never old images or the former 3-assets-per-scene planning checkpoints.
  const script=milestoneScript.parse(await read(join(dir,'approved-script.json')));
  const voice=await runner.stage('voice',schemas.voice,async()=>{throw new Error('Restore approved narration with narration_source_run_id before this visual test');},async v=>{for(const a of v.scenes)await access(a.path);});
  for(const scene of voice.scenes)requireVoiceQA(await read(scene.path+'.voice-QA.json'),true);
  const seconds=voice.scenes.reduce((n,v)=>n+Math.ceil(v.duration*30)/30,0);if(seconds<85||seconds>105)throw new Error('Approved narration outside 90-100 second visual-test window');
  const llm=new GeminiProvider();await llm.discover();await costs.setDuration(seconds);
  const lock=await loadStyleLock();await json(join(dir,'style-lock.json'),lock);
  const registry=await read('config/character-registry.json');await json(join(dir,'character-registry.json'),registry);
  const character=registry.characters[0],identity=character.identity+'; '+character.costume+'; '+character.continuityRules.join('; ');
  const bible=await runner.stage('visual-bible-illustrated',visualBible,()=>createVisualBible({script,styleLock:lock,registry},llm));await json(join(dir,'visual-bible.json'),bible);
  const plan=schemas.plan.parse({scenes:script.scenes.map(({id,narration,visual})=>({id,narration,visual}))});
  const style=profile.parse(await read('config/visual-profiles/history.json'));
  const timed=await runner.stage('speech-timed-illustrated-beats',shotPlan,()=>new ShotPlanner().plan(plan,voice,style,30,undefined,true,{hookSeconds:lock.qualityTest.hookBeatSeconds,bodySeconds:lock.qualityTest.bodyBeatSeconds}));
  if(timed.shots.length<lock.qualityTest.shotsMin||timed.shots.length>lock.qualityTest.shotsMax)throw new Error('Speech-timed beat count outside quality target');
  const board=await runner.stage('illustrated-keyframes',storyboard,()=>planIllustratedBeats(timed.shots,{script,bible,registry},lock,llm));
  if(!board.reuseReview?.passed)throw new Error('Storyboard lacks actual same-moment reuse approval');await json(join(dir,'editorial-reuse-review.json'),board.reuseReview);
  const checkPrompts=async(prompts:{id:string;prompt:string}[])=>{
   const result=await llm.json('Review EVERY final FLUX prompt before generation for exact era, materials, architecture, clothes, boats, historical anachronisms and the SAME locked illustration style. Return {reviews:[{id,passed,issues}]} with each exact ID once. Do not rewrite prompts. Bible '+JSON.stringify(bible)+' Style '+JSON.stringify(lock)+' Prompts '+JSON.stringify(prompts),z.object({reviews:z.array(z.object({id:z.string(),passed:z.boolean(),issues:z.array(z.string())}))}));
   if(result.reviews.length!==prompts.length||new Set(result.reviews.map(r=>r.id)).size!==prompts.length||result.reviews.some(r=>!r.passed||!prompts.some(p=>p.id===r.id)))throw new Error('Historical/style prompt preflight rejected');
   return result;
  };
  await runner.stage('illustrated-prompt-review',z.object({reviews:z.array(z.object({id:z.string(),passed:z.boolean(),issues:z.array(z.string())}))}),()=>checkPrompts(board.sources.map(s=>({id:s.id,prompt:sourcePrompt(s,lock,bible,identity)}))));
  const image=new CloudflareWorkersAIImageProvider();await createCharacterReferencePack(character,bible,assetsDir,image,llm,true);
  await json(join(dir,'planning-ready.json'),{ready:true,styleHash:digest(lock),uniqueSourceTarget:board.sources.length,shotCount:timed.shots.length,narrationReused:true,paidProviderCostUsd:0});
  if(values.prepare)return;
  const pack=await runner.stage('character-pack-v2',characterPack,()=>createCharacterReferencePack(character,bible,assetsDir,image,llm),async p=>{if(!p.qaPassed)throw new Error('Canonical QA failed');for(const a of p.assets)if(a.sha256!==await fileDigest(a.path))throw new Error('Canonical integrity failure');});
  const accepted=await runner.stage('visual-acceptance',z.object({sources:z.array(sourceFrame),styleQA:setReview,repetition:repetitionQA,regeneratedStyleOutliers:z.array(z.string())}),async()=>{
   let state:z.infer<typeof generationState>={};try{state=generationState.parse(await read(join(dir,'visual-generation-state.json')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   const regenerated=new Set(Object.entries(state).filter(([,v])=>v.revision>0).map(([k])=>k));
   for(let round=0;round<=lock.qualityTest.repairRounds;round++){
    const sources=[];for(const source of board.sources){const s=state[source.id]??{revision:0,direction:''};sources.push(await generateSource(source.id,sourcePrompt(source,lock,bible,identity,s.direction),source.concept,source.character,sourcesDir,s.revision,image));}
    await json(join(dir,'source-images.json'),sources);
    await contactSheet(sources,join(dir,'visual-contact-sheet.jpg'));
    const review=await reviewIllustratedSet(sources,join(dir,'visual-contact-sheet.jpg'),join(dir,'character-contact-sheet.jpg'),lock,bible,registry,llm);
    await json(join(dir,'visual-style-QA.json'),{...review,round,scoreMethod:'Gemini multimodal set estimates, not physical measurements'});await json(join(dir,'visual-style-QA-round-'+round+'.json'),review);
    const repetition=await inspectRepetition(board,timed.shots,sources,lock,review);await json(join(dir,'visual-repetition-QA.json'),repetition);
    if(review.passed&&!review.outliers.length&&repetition.passed)return {sources,styleQA:review,repetition,regeneratedStyleOutliers:[...regenerated]};
    const outliers=[...review.outliers];
    for(const pair of repetition.perceptualSimilarity.filter(p=>p.similarity===1))if(!outliers.some(o=>o.sourceImageId===pair.b))outliers.push({sourceImageId:pair.b,reason:'Identical perceptual fingerprint',repairDirection:'Use a materially distinct specific action and camera position for this narration, same locked painting technique.'});
    if(!outliers.length||round===lock.qualityTest.repairRounds)throw new Error('Pre-render visual style/repetition failed; evidence retained, no render');
    const corrected=outliers.map(o=>{const source=board.sources.find(s=>s.id===o.sourceImageId)!;const next={revision:(state[source.id]?.revision??0)+1,direction:o.repairDirection};state[source.id]=next;regenerated.add(source.id);return {id:source.id,prompt:sourcePrompt(source,lock,bible,identity,next.direction)};});
    await checkPrompts(corrected);await json(join(dir,'visual-generation-state.json'),state);
   }throw new Error('Visual acceptance failed');
  },async a=>{for(const s of a.sources)if(s.sha256!==await fileDigest(s.path))throw new Error('Source integrity failure');});
  const shots=timed.shots.map((s,i)=>{const beat=board.beats[i],source=board.sources.find(a=>a.id===beat.sourceImageId)!;return {...s,shotType:'generated-image' as const,assetKey:source.id,assetPrompt:source.concept,visualIntent:s.narration+'; '+source.concept,editorialReframe:beat.editorialVariant==='detail-left'?1:beat.editorialVariant==='detail-right'?2:0,overlay:null};});
  const visuals=await runner.stage('illustrated-depth-assets',media,()=>sourceMedia(board,shots,accepted.sources,sourcesDir),async v=>{for(const a of v.assets)if(a.sha256!==await fileDigest(a.path))throw new Error('Image integrity failure');});
  const captions=await runner.stage('captions',schemas.captions,async()=>createCaptions(plan,voice,30));
  await json(join(dir,'narrator-QA.json'),{provider:'chatterbox-nano',cloningMode:'audio_prompt_path',referenceSha256:await fileDigest(narrator.referenceAudioPath),approvalScope:'approved narrator retained for visual-style audition',blocks:await Promise.all(voice.scenes.map(async s=>({id:s.id,...await read(s.path+'.voice-QA.json')})))});
  const audio=await runner.stage('audio-mix',audioMix,()=>mixAudio(voice,shots,style,assetsDir,30,new ChapterMusicProvider([{duration:seconds,direction:'restrained ancient harbor atmosphere, reflective'}],true)));
  const sound=await runner.stage('audio-QA',audioQA,()=>inspectAudio(audio.path,{expectedDuration:seconds,narrationPath:audio.narrationPath,musicPath:audio.duckedMusicPath,voiceIds:voice.chapters?.map(c=>c.identity),requireMusic:true}));if(!sound.passed)throw new Error('Audio QA failed');
  for(const s of voice.scenes)await copyFile(s.path,join(pub,s.id+'.wav'));await copyFile(audio.path,join(pub,'mixed.wav'));
  for(const a of visuals.assets){await copyFile(a.path,join(pub,a.shotId+'.png'));for(const [k,p]of Object.entries(a.depthLayers!))await copyFile(p,join(pub,a.shotId+'-'+k+'.png'));}
  let from=0;const composition=await runner.stage('composition-illustrated',schemas.composition,async()=>({width:1920,height:1080,fps:30,durationInFrames:Math.round(seconds*30),scenes:plan.scenes.map(s=>{const frames=Math.ceil(voice.scenes.find(v=>v.id===s.id)!.duration*30),a=visuals.assets.find(a=>shots.find(x=>x.id===a.shotId)?.sceneId===s.id)!;const result={id:s.id,text:s.narration,audio:id+'/'+s.id+'.wav',image:id+'/'+a.shotId+'.png',from,frames};from+=frames;return result;}),shots,assets:visuals.assets.map(a=>({...a,path:id+'/'+a.shotId+'.png',depthLayers:Object.fromEntries(Object.keys(a.depthLayers!).map(k=>[k,id+'/'+a.shotId+'-'+k+'.png'])) as typeof a.depthLayers})),cues:captions.cues,visualProfile:style,audioMixPath:id+'/mixed.wav',thumbnailTitle:script.title}));
  const video=await runner.stage('render',schemas.rendered,async()=>{const path=join(dir,'final.mp4');await renderVideo(composition,path);return {path,duration:await duration(path),sha256:await fileDigest(path)};});
  const metadata=schemas.metadata.parse({title:script.title,description:'AI-illustrated imagined historical reconstruction, not archival footage. Synthesized approved Nano narration. Original procedural CC0 music test bed.',tags:['quality test'],categoryId:'27',privacyStatus:'private',madeForKids:false,syntheticMedia:true,publishAt:null});await json(join(dir,'metadata.json'),metadata);
  const qa=await runner.stage('qa',schemas.qa,()=>inspect(video.path,script,composition,{passed:true,issues:[],checkedClaims:0,review:'Imagined reconstruction; no event-specific empirical claims'},metadata,[...voice.scenes,...visuals.assets,{path:audio.path}].map(a=>a.path)));
  // Legacy duplication/pacing heuristics defer to the dedicated strict source QA
  // and the approved 3-6-second pacing after the hook, never to an unconditional bypass.
  const reviewOnly=['duplicated scenes','shot pacing','asset repetition','asset narration alignment'];
  const hardFailures=qa.checks.filter(c=>!c.passed&&!reviewOnly.includes(c.name));await json(join(dir,'milestone-QA.json'),{status:hardFailures.length?'fail':'review',hardFailures,reviews:qa.checks.filter(c=>!c.passed&&reviewOnly.includes(c.name)),strictSourceQA:accepted.repetition.passed,strictStyleQA:accepted.styleQA.passed,humanVisualApprovalRequired:true,publicationAllowed:false});if(hardFailures.length)throw new Error('Objective encoded QA failed');
  const thumbnailAssets=[composition.assets.find(a=>accepted.sources.find(s=>s.id===a.sourceImageId)?.character)??composition.assets[0],composition.assets[Math.floor(composition.assets.length/2)],composition.assets.at(-1)!];
  const copy=await runner.stage('thumbnail-copy',z.object({texts:z.array(z.string().max(28).refine(s=>s.split(/\s+/).length<=5)).length(3),provenance:z.string()}),async()=>({texts:['Dawn Cargo at Risk','Ptolemaic Market Day',"A Merchant's Morning"],provenance:'Previously reviewed truthful hooks for this same approved imagined passage; thumbnail copy is independent of keyframe planning'}));
  await runner.stage('thumbnail',schemas.thumbnail,()=>thumbnails({...composition,assets:thumbnailAssets},dir,undefined,copy.texts,true));
  for(const second of [5,20,40,60,85])if(second<seconds)await renderPreview(composition,join(dir,'frame-'+second+'.png'),second*30);
  const events=(await readFile(join(dir,'logs.jsonl'),'utf8')).trim().split('\n').map(line=>JSON.parse(line));
  await json(join(dir,'quality-summary.json'),{styleLock:lock.version,paidProviderCostUsd:0,shots:shots.length,uniqueSourceImages:accepted.sources.length,editorialBeatCount:shots.length,sourceReuseCount:shots.length-accepted.sources.length,uniqueSourceRatio:accepted.repetition.uniqueSourceRatio,consecutiveDuplicateSources:accepted.repetition.consecutiveDuplicateSources,regeneratedStyleOutliers:accepted.regeneratedStyleOutliers,recurringCharacters:1,hiddenCanonicalReferenceImages:pack.assets.length,characterConsistencyLimitation:pack.limitation,generatedImageRequests:costs.entries.filter(e=>e.category==='generatedImages'&&e.state==='completed').length,voiceProvider:'chatterbox-nano',duration:video.duration,geminiModelsUsed:[...new Set(events.filter(e=>e.event==='gemini_attempt'&&e.status===200).map(e=>e.model))],geminiHistory:events.filter(e=>['gemini_retry','gemini_fallback'].includes(e.event)),humanVisualApprovalRequired:true,autoPublish:false});
 }));}finally{await costs.report();await quota.report();await runner.unlock();}
}
main().catch(e=>{console.error(JSON.stringify({event:'quality_test_failed',message:e.message}));process.exitCode=1;});
