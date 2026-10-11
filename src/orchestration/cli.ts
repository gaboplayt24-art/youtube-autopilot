import {parseArgs} from 'node:util';
import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runVideo} from './pipeline';
import {createBranding} from '../branding';
import {json,read,log} from './io';
import {Runner} from './runner';
import {artifact,fileDigest} from './integrity';
import {uploadPrivate,setThumbnail,scheduleAllowed,scheduleVideo,nextPublishSlot,findUploadByTag,setLocalizations} from '../youtube';
import {schedule as scheduleConfig} from './config';
import {requireQA,inspect} from '../qa';
import * as s from './schemas';
import {collect,learn} from '../analytics';
import {SupabaseStorage} from '../database/storage';
import {z} from 'zod';
import {inspectAudio} from '../audio/qa';
import {media,audioMix} from '../editor/schemas';
const {values,positionals}=parseArgs({options:{'run-id':{type:'string'},'retry-from':{type:'string'},mode:{type:'string'},'production-kind':{type:'string'},topic:{type:'string'},'start-date':{type:'string'},'end-date':{type:'string'}},allowPositionals:true});
const command=positionals[0];
async function main(){
 if(command==='video'||command==='research'){const result=await runVideo({runId:values['run-id'],mode:values.mode,topic:values.topic,retryFrom:values['retry-from'],productionKind:values['production-kind']},command==='research');console.log(JSON.stringify(result));return;}
 if(command==='branding'){console.log(JSON.stringify(await createBranding(values['run-id'])));return;}
 if(command==='style-v5'){const {runStyleAuditionV5}=await import('../visuals/style-audition-v5');console.log(JSON.stringify(await runStyleAuditionV5(values['run-id']??'style-v5-001')));return;}
 if(command==='learn'){const files=await readdir('data/analytics');const rows=[];for(const file of files.filter(x=>x.endsWith('.json')))rows.push(await read(join('data/analytics',file)));if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)rows.push(...await new SupabaseStorage().list('analytics-'));const unique=[...new Map(rows.filter(x=>'videoId' in x).map(x=>[x.videoId,x])).values()];await json('data/analytics/recommendations.json',await learn(unique));return;}
 const runId=values['run-id'];if(!runId||!/^[A-Za-z0-9_-]+$/.test(runId))throw new Error('A valid --run-id is required');const dir=join('data/runs',runId);
 if(command==='publish'){
  const runner=new Runner(dir);await runner.lock();try{
   const m=await artifact(dir,'metadata',s.metadata);const video=await artifact(dir,'render',s.rendered);const thumb=await artifact(dir,'thumbnail',s.thumbnail);const composition=await artifact(dir,'composition',s.composition);const script=await artifact(dir,'script',s.script);const facts=await artifact(dir,'facts',s.facts);
   if(await fileDigest(video.path)!==video.sha256||await fileDigest(thumb.path)!==thumb.sha256)throw new Error('Media checksum mismatch');
   const v=await artifact(dir,'voice',s.voice);const a=await artifact(dir,'visuals',media);
   const production=(await read(join(dir,'manifest.json'))).mode==='production';
   if(production){const audioCheck=await inspectAudio(video.path,{expectedDuration:video.duration});if(!audioCheck.passed)throw new Error('Production audio QA failed; upload blocked');}
   const qa=await inspect(video.path,script,composition,facts,m,[...v.scenes,...a.assets,{path:(await artifact(dir,'audio-mix',audioMix)).path}].map(x=>x.path),production);requireQA(qa);await json(join(dir,'qa-upload.json'),qa);
   // Owner-authorized 2026-10-10: with autoPublish and AUTO_PUBLISH=true a QA-passed video is uploaded private and scheduled for the next daily slot.
   const schedule=scheduleConfig.parse(await read('config/schedule.json'));const publishAt=m.publishAt??(schedule.autoPublish&&process.env.AUTO_PUBLISH==='true'?nextPublishSlot(schedule):null);scheduleAllowed({...schedule,publishAt},process.env.AUTO_PUBLISH);
   const uploadFile=join(dir,'upload.json');let uploaded;try{uploaded=s.upload.parse(await read(uploadFile));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   const runTag='bu-'+runId.toLowerCase();
   if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY){
    // No Supabase ledger: the channel itself is the durable record, keyed by a hidden per-run tag.
    if(!uploaded){const existing=await findUploadByTag(runTag);if(existing){uploaded={videoId:existing,privacyStatus:'private' as const,publishAt:null};await json(uploadFile,uploaded);}else{const videoId=await uploadPrivate(video.path,thumb.path,{...m,tags:[...m.tags,runTag]},qa);uploaded={videoId,privacyStatus:'private' as const,publishAt:null};await json(uploadFile,uploaded);}}
   }else{
     const storage=new SupabaseStorage();const key=`upload-${runId}`;const fingerprint=(await read(join(dir,'manifest.json'))).fingerprint;
     const reservation=await storage.create(key,{state:'pending',fingerprint,startedAt:new Date().toISOString()});
     if(!reservation){const existing=z.object({state:z.enum(['pending','uploaded']),fingerprint:z.string(),videoId:z.string().optional()}).parse(await storage.get(key));if(existing.fingerprint!==fingerprint)throw new Error('Upload run identity conflicts with durable ledger');if(existing.state==='pending'||!existing.videoId)throw new Error('Upload outcome uncertain. Reconcile the durable upload ledger with YouTube Studio before retrying.');uploaded={videoId:existing.videoId,privacyStatus:'private',publishAt:null};await json(uploadFile,uploaded);}
     else{if(uploaded)throw new Error('Local upload exists but durable ledger is missing; reconcile before uploading');const videoId=await uploadPrivate(video.path,thumb.path,m,qa);await storage.put(key,{state:'uploaded',fingerprint,videoId});uploaded={videoId,privacyStatus:'private',publishAt:null};await json(uploadFile,uploaded);}
   }
   // Owner-approved 2026-10-11: translated titles/descriptions when the run produced them (older runs have none).
   let loc;try{loc=s.localizations.parse(await read(join(dir,'localizations.json')));}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
   if(loc){const l=loc;await runner.stage('youtube-localizations',s.localizations,async()=>{await setLocalizations(uploaded.videoId,m,l,process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY?m.tags:[...m.tags,runTag]);return l;});}
   await runner.stage('youtube-thumbnail',s.thumbnail,async()=>{await setThumbnail(uploaded.videoId,thumb.path);return thumb;});
   if(publishAt)await runner.stage('schedule',s.upload,async()=>{await scheduleVideo(uploaded.videoId,publishAt);return {...uploaded,publishAt};});
   await log(dir,'private_upload_completed',{videoId:uploaded.videoId});
  }finally{await runner.unlock();}return;
 }
 if(command==='analytics'){const uploaded=s.upload.parse(await read(join(dir,'upload.json')));const script=await artifact(dir,'script',s.script);const video=await artifact(dir,'render',s.rendered);const thumb=await artifact(dir,'thumbnail',s.thumbnail);const row=await collect(uploaded.videoId,{topic:script.topic,format:'explainer',hook:script.hook,title:script.title,thumbnailVariant:thumb.variant,duration:video.duration},values['start-date']??new Date(Date.now()-30*86400000).toISOString().slice(0,10),values['end-date']??new Date().toISOString().slice(0,10));await json(`data/analytics/${uploaded.videoId}.json`,row);if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)await new SupabaseStorage().put(`analytics-${uploaded.videoId}`,row);return;}
 throw new Error('Unknown command');
}
main().catch(error=>{console.error(JSON.stringify({event:'command_failed',message:error instanceof Error?error.message:'Unknown error'}));process.exitCode=1;});
