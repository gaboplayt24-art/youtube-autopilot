import {join,resolve} from 'node:path';
import {copyFile,mkdir,stat,cp,access} from 'node:fs/promises';
import {z} from 'zod';
import {artifact,fileDigest} from '../orchestration/integrity';
import {composition,qa,rendered} from '../orchestration/schemas';
import {audioMix,media} from '../editor/schemas';
import {requireQA} from '../qa';
import {exec,duration,json,read} from '../orchestration/io';
import {Runner} from '../orchestration/runner';
import {renderVideo} from '../render';
import {inspectAudio} from '../audio/qa';
import {candidate,planClip,chapterClipSelection,chapterClipCandidates} from './plan';
import {sliceEdit} from '../editor/dynamic-edit';
import {writeSfxTrack} from '../audio/sfx-library';
import {loadAudioConfig} from '../audio/qa';
export const clipRecord=z.object({id:z.string(),title:z.string(),source:z.string(),path:z.string(),sha256:z.string().length(64),duration:z.number(),qa:qa,sourceRenderSha256:z.string(),narration:z.string()});
export const clipBundle=z.object({runId:z.string(),clips:z.array(clipRecord).length(3)});
export async function buildClips(runId:string){
 if(!/^[A-Za-z0-9_-]+$/.test(runId))throw Error('Invalid episode ID');
 const dir=join('data/runs',runId),out=join(dir,'social');await mkdir(out,{recursive:true});
 requireQA(await artifact(dir,'qa',qa));const master=await artifact(dir,'render',rendered);if(await fileDigest(master.path)!==master.sha256)throw Error('Master hash mismatch');
 const full=await artifact(dir,'composition',composition),assets=await artifact(dir,'visuals',media),audio=await artifact(dir,'audio-mix',audioMix);
 if(!audio.narrationPath)throw Error('Measured isolated narration stem required; YouTube music is not presumed licensed for TikTok');
 let candidateInput:unknown;
 try{candidateInput=await read(`data/ideas/${runId}-shorts-candidates.json`);}
 catch(error){
  if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;
  const selection=chapterClipSelection.parse(await read(`data/ideas/${runId}-shorts-chapters.json`));
  if(selection.runId!==runId)throw Error('Clip chapter selection belongs to another episode');
  candidateInput={candidates:chapterClipCandidates(selection,full)};
 }
 const candidates=z.object({candidates:z.array(candidate).length(3)}).parse(candidateInput);
 await json(join(out,'selected-candidates.json'),candidates);
 const runner=new Runner(out);await runner.lock();const clips=[];
 try{for(const input of candidates.candidates){
  const plan=planClip(input,full),path=join(out,`clip-${plan.id}.mp4`),publicDir=resolve('public',runId);await mkdir(publicDir,{recursive:true});
  for(const shot of plan.shots){const a=assets.assets.find(a=>a.shotId===shot.id);if(!a||await fileDigest(a.path)!==a.sha256)throw Error('Missing or changed approved illustration');await copyFile(a.path,join(publicDir,`${shot.id}.png`));}
  const wav=join(out,`clip-${plan.id}-narration.wav`);
  // The same dynamic edit as the full video, cut to this passage; its original CC0 effects join the isolated narration.
  const edit=full.edit?sliceEdit(full.edit,plan.start,plan.end):undefined;
  if(edit?.layers.length&&!await access(join(publicDir,'layers')).then(()=>true,()=>false))await cp(join(dir,'assets','layers'),join(publicDir,'layers'),{recursive:true});
  const trim=`atrim=start=${plan.start}:end=${plan.end},asetpts=PTS-STARTPTS`,finish=`loudnorm=I=-15.5:TP=-2:LRA=8,aresample=48000,apad,atrim=duration=${Math.ceil(plan.duration*30)/30}`;
  if(edit?.sfx.length){const sfx=join(out,`clip-${plan.id}-sfx.wav`);await writeSfxTrack(edit.sfx,plan.duration,sfx);const db=(await loadAudioConfig()).sfxDb;
   await exec('ffmpeg',['-y','-v','error','-i',audio.narrationPath,'-i',sfx,'-filter_complex',`[0:a]${trim}[n];[1:a]volume=${db}dB[s];[n][s]amix=inputs=2:duration=first:normalize=0,${finish}[m]`,'-map','[m]','-ar','48000',wav],{timeout:120000});}
  else await exec('ffmpeg',['-y','-v','error','-i',audio.narrationPath,'-af',`${trim},${finish}`,'-ar','48000',wav],{timeout:120000});
  await copyFile(wav,join(publicDir,`clip-${plan.id}-narration.wav`));
  const props=composition.parse({...full,width:1080,height:1920,fps:30,durationInFrames:Math.ceil(plan.duration*30),scenes:[],shots:plan.shots,cues:plan.cues,audioMixPath:`${runId}/clip-${plan.id}-narration.wav`,thumbnailTitle:plan.title,edit});
  await json(join(out,`clip-${plan.id}-plan.json`),{...plan,sourceRenderSha256:master.sha256,audio:'Approved original narration only; no externally licensed music reused'});
  const result=await runner.stage('clip-'+plan.id,clipRecord,async()=>{
   await renderVideo(props,path);const seconds=await duration(path);const audioQA=await inspectAudio(path,{expectedDuration:props.durationInFrames/30});
   const probe=JSON.parse((await exec('ffprobe',['-v','error','-show_streams','-of','json',path],{timeout:30000})).stdout).streams;
   const checks=[{name:'source video QA',passed:true,detail:'Integrity-verified full QA and master hash'},{name:'measured captions',passed:plan.cues.every(c=>(c.words?.length??0)<=4),detail:'Unique exact passage in final measured ASR timeline; four words per group'},{name:'complete visual coverage',passed:plan.shots.length>=3&&plan.shots.every(s=>s.end-s.start<=10),detail:'Approved FLUX sources; whole artwork contained instead of blind portrait crop'},{name:'portrait output',passed:probe.some((s:any)=>s.width===1080&&s.height===1920&&s.codec_name==='h264'&&s.avg_frame_rate==='30/1')&&probe.some((s:any)=>s.codec_name==='aac'),detail:'1080×1920 H264/AAC'},{name:'duration',passed:Math.abs(seconds-props.durationInFrames/30)<.15,detail:String(seconds)},{name:'upload size',passed:(await stat(path)).size<=45000000,detail:'45 MB conservative limit'},...audioQA.checks];
   const detection=await exec('ffmpeg',['-hide_banner','-i',path,'-vf','blackdetect=d=0.25:pix_th=0.05,freezedetect=n=-50dB:d=4','-f','null','-'],{timeout:180000,maxBuffer:4*1024*1024});checks.push({name:'black and frozen frames',passed:!detection.stderr.includes('black_start:')&&!detection.stderr.includes('freeze_start'),detail:'FFmpeg measured final portrait'});
   const report={passed:checks.every(c=>c.passed),checks};await json(join(out,`clip-${plan.id}-QA.json`),report);await json(join(out,`clip-${plan.id}-audio-QA.json`),audioQA);
   if(!report.passed)throw Error('Portrait QA failed; publication blocked');
   for(const [index,t] of [1,seconds/2,seconds-2].entries())await exec('ffmpeg',['-y','-v','error','-ss',String(Math.max(0,t)),'-i',path,'-frames:v','1',join(out,`clip-${plan.id}-frame-${index+1}.jpg`)],{timeout:30000});
   return {...input,path,sha256:await fileDigest(path),duration:seconds,qa:report,sourceRenderSha256:master.sha256};
  },async c=>{if(c.sourceRenderSha256!==master.sha256||await fileDigest(c.path)!==c.sha256||!c.qa.passed)throw Error('Clip checkpoint identity or QA changed');});clips.push(result);
 }const bundle=clipBundle.parse({runId,clips});await json(join(out,'bundle.json'),bundle);return bundle;
 }finally{await runner.unlock();}
}

/** Isolated layout evidence using a previously reviewed source. Never a finished clip or publication approval. */
export async function previewPortraitLayout(runId:string){
 if(runId!=='bible-angels-001')throw Error('Authorized episode only');
 const dir=join('data/runs',runId),out=join(dir,'social'),publicDir=resolve('public',runId);await mkdir(out,{recursive:true});await mkdir(publicDir,{recursive:true});
 const source=await read(join(dir,'native-chapter-1-shot-0-p3-source.json')),review=await read(join(dir,'native-chapter-1-shot-0-p3-density-QA-v4.3.json'));
 if(!review.passed||review.objectiveFailures?.length||await fileDigest(source.path)!==source.sha256)throw Error('Layout proof requires existing reviewed illustration');
 const v=await read(join(dir,'voice.json')),narration=v.chapters[0].path,sidecar=await read(narration+'.json');if(await fileDigest(narration)!==sidecar.sha256)throw Error('Narration proof hash mismatch');
 const shot=(await read(join(dir,'visual-thinking-v5.json'))).shots[0],cue=(await read(join(dir,'captions.json'))).cues.filter((c:any)=>c.end<=3);
 const imageName='portrait-layout-source.png',wav='portrait-layout-narration.wav';await copyFile(source.path,join(publicDir,imageName));
 await exec('ffmpeg',['-y','-v','error','-i',narration,'-t','3',join(publicDir,wav)],{timeout:30000});
 const props=composition.parse({fps:30,width:1080,height:1920,durationInFrames:90,scenes:[],shots:[{...shot,start:0,end:3}],cues:cue,thumbnailTitle:'Would You Recognize an Angel?',audioMixPath:runId+'/'+wav,assets:[{shotId:shot.id,path:runId+'/'+imageName,sha256:source.sha256,sourceSha256:source.sha256,kind:'image',provider:'cloudflare-flux-free',license:'Existing original FLUX illustration',sourceUrl:null,estimatedCost:0,intent:shot.visualIntent,fallbacks:[],artwork:{generationMethod:'ai-illustration',styleVersion:'round-head-v5',model:source.model,width:source.width,height:source.height,aspectRatio:'16:9',sourceSha256:source.sha256,referenceSha256:source.referenceSha256,referenceQAPassed:true}}]});
 const path=join(out,'LAYOUT-PROOF-NOT-FINAL.mp4');await renderVideo(props,path);
 await exec('ffmpeg',['-y','-v','error','-ss','1','-i',path,'-frames:v','1',join(out,'LAYOUT-PROOF-NOT-FINAL.jpg')],{timeout:30000});
 const proof={kind:'layout-proof-only',finalVideoApproved:false,sourceSha256:source.sha256,sourceReview:review.passed,narrationSha256:sidecar.sha256,path,duration:await duration(path),sha256:await fileDigest(path)};await json(join(out,'layout-proof.json'),proof);return proof;
}
