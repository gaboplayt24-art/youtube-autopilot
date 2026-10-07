import {parseArgs} from 'node:util';
import {mkdir,copyFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {Runner} from '../orchestration/runner';
import {read,json,duration,exec} from '../orchestration/io';
import {digest,fileDigest} from '../orchestration/integrity';
import * as schemas from '../orchestration/schemas';
import {shotPlan,media,audioMix,profile} from '../editor/schemas';
import {ShotPlanner} from '../editor/planner';
import {VisualThinkingDirector} from './visual-thinking';
import {createDoodleAssets} from './doodle-assets';
import {inspectVisualIdeas} from './doodle-qa';
import {doodleStyleLock} from './visual-approval';
import {milestoneScript} from './quality-script';
import {requireVoiceQA} from '../voice/qa';
import {createCaptions} from '../captions';
import {mixAudio} from '../audio';
import {ChapterMusicProvider} from '../audio/chapters';
import {inspectAudio,audioQA} from '../audio/qa';
import {renderVideo,renderPreview} from '../render';
import {thumbnails} from '../thumbnail';
import {GeminiProvider} from '../providers/free';
import {CostLedger,loadCostPolicy,withCosts} from '../cost';
import {FreeQuotaLedger,withQuota} from '../quota';
import {reviewDoodleSet,doodleSetQA} from './doodle-set-qa';
import {inspect,requireQA} from '../qa';
const {values}=parseArgs({options:{'run-id':{type:'string',default:'quality-doodle-preview'},'offline-preview':{type:'boolean',default:false}}});
async function main(){
 const id=values['run-id']!;if(!/^quality-doodle-[A-Za-z0-9_-]+$/.test(id))throw new Error('New doodle run ID required; never resume the rejected visual run');
 const dir=join('data/runs',id),assets=join(dir,'assets'),pub=join('public',id),runner=new Runner(dir);
 await mkdir(assets,{recursive:true});await mkdir(pub,{recursive:true});await runner.lock();
 const costs=new CostLedger(await loadCostPolicy(),dir),quota=new FreeQuotaLedger(dir);await costs.restore();await quota.restore();
 try{await withQuota(quota,()=>withCosts(costs,async()=>{
  const llm=values['offline-preview']?undefined:new GeminiProvider();if(llm){if(!process.env.GEMINI_API_KEY||process.env.GEMINI_FREE_TIER_CONFIRMED!=='true')throw new Error('Gemini must be validated in GitHub Actions using existing Secrets, not Codex credentials');await llm.discover();}
  const lock=doodleStyleLock.parse(await read('config/style-lock-v3.json')),narrator=await read('config/narrator.json');if(!narrator.voiceApproved||narrator.provider!=='chatterbox-nano')throw new Error('Retain the manually approved Nano narrator');
  const manifestPath=join(dir,'visual-manifest.json');let manifest;try{manifest=await read(manifestPath);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(manifest&&(manifest.styleVersion!==lock.version||manifest.styleHash!==digest(lock)))throw new Error('Visual system changed; create a new run ID');
  if(!manifest)await json(manifestPath,{styleVersion:lock.version,styleHash:digest(lock),createdAt:new Date().toISOString(),previewOnly:true});
  const script=milestoneScript.parse(await read(join(dir,'approved-script.json')));
  const voice=await runner.stage('voice',schemas.voice,async()=>{throw new Error('Restore ONLY the approved script, raw WAVs and voice evidence before this test');},async v=>{for(const s of v.scenes)await access(s.path);});
  for(const s of voice.scenes)requireVoiceQA(await read(s.path+'.voice-QA.json'),true);
  const seconds=voice.scenes.reduce((n,s)=>n+Math.ceil(s.duration*30)/30,0);if(seconds<85||seconds>105)throw new Error('Approved short narration duration changed');
  await costs.setDuration(seconds);
  const plan=schemas.plan.parse({scenes:script.scenes.map(({id,narration,visual})=>({id,narration,visual}))}),style=profile.parse(await read('config/visual-profiles/history.json'));
  const timed=await runner.stage('speech-timed-doodle-v3',shotPlan,()=>new ShotPlanner().plan(plan,voice,style,30));
  const shots=await runner.stage('visual-thinking-v3',shotPlan,async()=>({...timed,shots:await new VisualThinkingDirector().direct(timed.shots,llm)}));
  const thinking=inspectVisualIdeas(shots.shots);await json(join(dir,'visual-thinking-QA.json'),thinking);if(!thinking.passed)throw new Error('Educational concept QA failed');
  const visuals=await runner.stage('doodle-assets-v3',media,()=>createDoodleAssets(shots.shots,assets),async v=>{for(const a of v.assets)if(await fileDigest(a.path)!==a.sha256)throw new Error('Doodle asset integrity failure');});
  if(llm){const reviewed=await runner.stage('doodle-style-semantic-QA',doodleSetQA,()=>reviewDoodleSet(shots.shots,visuals.assets,llm));if(!reviewed.passed)throw new Error('Actual-image educational style/semantic QA failed; evidence retained, no render');}
  const cues=createCaptions(plan,voice,30).cues;
  const audio=await runner.stage('audio-mix',audioMix,()=>mixAudio(voice,shots.shots,style,assets,30,new ChapterMusicProvider([{duration:seconds,direction:'restrained original educational atmosphere'}],true)));
  const sound=await runner.stage('audio-QA',audioQA,()=>inspectAudio(audio.path,{expectedDuration:seconds,narrationPath:audio.narrationPath,musicPath:audio.duckedMusicPath,requireMusic:true}));if(!sound.passed)throw new Error('Audio mastering QA failed');
  await copyFile(audio.path,join(pub,'mixed.wav'));for(const s of voice.scenes)await copyFile(s.path,join(pub,s.id+'.wav'));for(const a of visuals.assets)await copyFile(a.path,join(pub,a.shotId+'.png'));
  const composition=await runner.stage('composition-doodle-v3',schemas.composition,async()=>{let from=0;const scenes=plan.scenes.map(s=>{const frames=Math.ceil(voice.scenes.find(v=>v.id===s.id)!.duration*30),first=visuals.assets.find(a=>shots.shots.find(t=>t.id===a.shotId)?.sceneId===s.id)!;const item={id:s.id,text:s.narration,audio:id+'/'+s.id+'.wav',image:id+'/'+first.shotId+'.png',from,frames};from+=frames;return item;});return {width:1920,height:1080,fps:30,durationInFrames:from,scenes,shots:shots.shots,assets:visuals.assets.map(a=>({...a,path:id+'/'+a.shotId+'.png'})),cues,audioMixPath:id+'/mixed.wav',visualProfile:style,thumbnailTitle:script.title};});
  const video=await runner.stage('render',schemas.rendered,async()=>{const path=join(dir,'final.mp4');await renderVideo(composition,path);return {path,duration:await duration(path),sha256:await fileDigest(path)};},async v=>{if(await fileDigest(v.path)!==v.sha256)throw new Error('Video integrity failure');});
  const metadata=schemas.metadata.parse({title:script.title,description:'Original 2D schematic educational interpretation of the approved imagined historical passage. Synthesized approved Nano narration; not archival evidence.',tags:['educational','doodle','history'],categoryId:'27',privacyStatus:'private',madeForKids:false,syntheticMedia:true,publishAt:null});await json(join(dir,'metadata.json'),metadata);
  const encoded=await runner.stage('encoded-QA',schemas.qa,()=>inspect(video.path,script,composition,{passed:true,issues:[],checkedClaims:0,review:'Approved imagined passage, no new empirical claims; visual semantics separately reviewed'},metadata,[...voice.scenes,...visuals.assets,{path:audio.path}].map(a=>a.path)));requireQA(encoded);
  await runner.stage('thumbnail',schemas.thumbnail,()=>thumbnails({...composition,thumbnailTitle:script.title},dir,undefined,['Cargo at Dawn','A Merchant’s Day','Coins or Cargo?']));
  for(const second of [2,10,25,45,65,85])if(second<seconds)await renderPreview(composition,join(dir,'frame-'+second+'.png'),Math.round(second*30));
  const probe=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',video.path]);await json(join(dir,'ffprobe.json'),JSON.parse(probe.stdout));
  await json(join(dir,'narrator-QA.json'),{provider:'chatterbox-nano',referenceSha256:await fileDigest(narrator.referenceAudioPath),narrationReusedExactly:true,blocks:await Promise.all(voice.scenes.map(async s=>({id:s.id,sha256:await fileDigest(s.path),...await read(s.path+'.voice-QA.json')})))});
  await json(join(dir,'quality-summary.json'),{styleVersion:lock.version,duration:video.duration,shots:shots.shots.length,conceptTypes:[...new Set(shots.shots.map(s=>s.visualIdea!.conceptType))],paidCostUsd:0,cloudflareRequests:0,voice:'approved-chatterbox-nano-unchanged',previewOnly:true,structuralQAPassed:thinking.passed,audioQAPassed:sound.passed,semanticReview:llm?'Actual-image Gemini pre-render QA passed':'NOT RUN: offline concept demonstration only',humanVisualApprovalRequired:true,productionApproved:false,autoPublish:false});
  // This prototype does not fabricate multimodal/historical QA or promote a
  // structural pass to production approval. WAVs, ASR and timestamps stay raw.
 }));}finally{await costs.report();await quota.report();await runner.unlock();}
}
main().catch(e=>{console.error(JSON.stringify({event:'doodle_quality_failed',message:e.message}));process.exitCode=1;});
