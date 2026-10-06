import {randomUUID,createHash} from 'node:crypto';
import {mkdir,copyFile,access,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {z} from 'zod';
import {Runner} from './runner';
import {fileDigest} from './integrity';
import {loadConfig} from './config';
import {read,json,duration} from './io';
import * as schemas from './schemas';
import {OpenAIProvider} from '../providers/openai';
import {DemoVoice} from '../voice';
import {OriginalCards} from '../visuals';
import {demoResearch,investigate} from '../research';
import {generateIdeas,selectTopic,scoreIdeas} from '../ideas';
import {demoScript,writeScript} from '../script';
import {factcheck} from '../factcheck';
import {createCaptions} from '../captions';
import {renderVideo,renderThumbnail} from '../render';
import {inspect,requireQA} from '../qa';
import {SupabaseStorage} from '../database/storage';
const optionsSchema=z.object({runId:z.string().regex(/^[A-Za-z0-9_-]+$/),mode:z.enum(['demo','production']),topic:z.string()});
export async function runVideo(input:{runId?:string;mode?:string;topic?:string;retryFrom?:string},stopAfterResearch=false){
 const config=await loadConfig();const strategy=config.strategy;const options=optionsSchema.parse({runId:input.runId??randomUUID(),mode:input.mode??'demo',topic:input.topic??strategy.topics[0]});
 const dir=join('data/runs',options.runId);const storage=process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY?new SupabaseStorage():undefined;const runner=new Runner(dir,storage,options.runId);await runner.lock();
 try{
  const fingerprint=createHash('sha256').update(JSON.stringify({options,config})).digest('hex');
  const manifest=join(dir,'manifest.json');let previous;try{previous=await read(manifest);}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  if(previous&&previous.fingerprint!==fingerprint)throw new Error('Run configuration changed; choose a new run ID');
  if(!previous)await json(manifest,{...options,fingerprint,createdAt:new Date().toISOString()});
  if(input.retryFrom){const stages=['research','ideas','scoring','selection','script','facts','plan','voice','visuals','captions','composition','render','metadata','qa','thumbnail'];const index=stages.indexOf(input.retryFrom);if(index<0)throw new Error('Invalid --retry-from stage');for(const stage of stages.slice(index))for(const suffix of ['.json','.integrity.json'])await rm(join(dir,stage+suffix),{force:true});}
  const llm=new OpenAIProvider();const demo=options.mode==='demo';
  const research=await runner.stage('research',schemas.research,()=>demo?Promise.resolve(demoResearch):investigate(options.topic,llm,config.strategy.sources,config.competitors.channels));
  if(stopAfterResearch)return {runId:options.runId,dir};
  const ideas=await runner.stage('ideas',schemas.ideas,()=>demo?Promise.resolve({ideas:[{topic:research.topic,hook:demoScript.hook,score:90,reason:'Supported by curated official sources'}]}):generateIdeas({research,audience:config.audience},llm));
  const scoring=await runner.stage('scoring',schemas.ideas,async()=>scoreIdeas(ideas,research.sources.length));
  const selection=await runner.stage('selection',schemas.schemas.selection,async()=>selectTopic(scoring));
  const script=await runner.stage('script',schemas.script,()=>demo?Promise.resolve(demoScript):writeScript({research,selection,channel:config.channel,audience:config.audience},llm));
  if(new Set(script.scenes.map(s=>s.id)).size!==script.scenes.length||script.scenes.some(s=>!/^[A-Za-z0-9_-]+$/.test(s.id)))throw new Error('Invalid or duplicate scene IDs');
  const facts=await runner.stage('facts',schemas.facts,()=>factcheck(script,research,demo?undefined:llm));
  if(!facts.passed)throw new Error('Fact checking rejected the script; start a corrected new run');
  const plan=await runner.stage('plan',schemas.plan,async()=>({scenes:script.scenes.map(({id,narration,visual})=>({id,narration,visual}))}));
  const assets=join(dir,'assets');await mkdir(assets,{recursive:true});const publicDir=resolve('public',options.runId);await mkdir(publicDir,{recursive:true});
  const tts=demo?new DemoVoice():llm;
  const voice=await runner.stage('voice',schemas.voice,async()=>{const scenes=[];for(const scene of plan.scenes){const path=join(assets,scene.id+'.wav');const {alignment}=await tts.speak(scene.narration,path);scenes.push({id:scene.id,path,duration:await duration(path),alignment});}return {scenes};},async v=>{for(const s of v.scenes)await access(s.path);});
  const image=config.style.imageProvider==='openai'?llm:new OriginalCards({background:config.style.background,accent:config.style.accent});const imageExtension=config.style.imageProvider==='openai'?'png':'svg';
  const visuals=await runner.stage('visuals',schemas.visuals,async()=>{const scenes=[];for(const scene of plan.scenes){const path=join(assets,scene.id+'.'+imageExtension);await image.generate(scene.visual,path);scenes.push({id:scene.id,path,license:'original' as const});}return {scenes};},async v=>{for(const s of v.scenes)await access(s.path);});
  for(const a of [...voice.scenes,...visuals.scenes])await copyFile(a.path,join(publicDir,a.path.split('/').at(-1)!));
  const captions=await runner.stage('captions',schemas.captions,async()=>createCaptions(plan,voice,Number(config.style.fps)));
  const composition=await runner.stage('composition',schemas.composition,async()=>{let from=0;const fps=Number(config.style.fps);const scenes=plan.scenes.map(s=>{const frames=Math.ceil(voice.scenes.find(v=>v.id===s.id)!.duration*fps);const scene={id:s.id,text:s.narration,audio:`${options.runId}/${s.id}.wav`,image:`${options.runId}/${s.id}.${imageExtension}`,from,frames};from+=frames;return scene;});return {fps,width:config.style.width,height:config.style.height,durationInFrames:from,scenes,cues:captions.cues};});
  const video=await runner.stage('render',schemas.rendered,async()=>{const path=join(dir,'final.mp4');await renderVideo(composition,path);return {path,duration:await duration(path),sha256:await fileDigest(path)};},async v=>{if(await fileDigest(v.path)!==v.sha256)throw new Error('Video checksum mismatch');});
  const metadata=await runner.stage('metadata',schemas.metadata,async()=>({title:script.title,description:`${script.hook}\n\n${research.summary}\n\nSources:\n${research.sources.map(s=>s.url).join('\n')}\n\nNarration is synthesized. Visuals are original.`,tags:['education','explainer'],categoryId:config.channel.categoryId,privacyStatus:'private',madeForKids:config.channel.madeForKids,syntheticMedia:config.channel.syntheticMedia,publishAt:config.schedule.publishAt}));
  const qa=await runner.stage('qa',schemas.qa,()=>inspect(video.path,script,composition,facts,metadata,[...voice.scenes,...visuals.scenes].map(a=>a.path)));
  requireQA(qa);
  await runner.stage('thumbnail',schemas.thumbnail,async()=>{const path=join(dir,'thumbnail.png');await renderThumbnail(composition,path);return {path,variant:'original-card-v1',sha256:await fileDigest(path)};},async v=>{if(await fileDigest(v.path)!==v.sha256)throw new Error('Thumbnail checksum mismatch');});
  if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY){await new SupabaseStorage().put(options.runId,{manifest:await read(manifest),status:await read(join(dir,'status.json')),qa,metadata});}
  await json(join(dir,'status.json'),{state:'ready_for_private_upload',runId:options.runId});return {runId:options.runId,dir};
 }finally{await runner.unlock();}
}
