import {parseArgs} from 'node:util';
import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runVideo} from './pipeline';
import {json,read,log} from './io';
import {Runner} from './runner';
import {artifact,fileDigest} from './integrity';
import {uploadPrivate,setThumbnail,scheduleAllowed,scheduleVideo} from '../youtube';
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
 if(command==='learn'){const files=await readdir('data/analytics');const rows=[];for(const file of files.filter(x=>x.endsWith('.json')))rows.push(await read(join('data/analytics',file)));if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)rows.push(...await new SupabaseStorage().list('analytics-'));const unique=[...new Map(rows.filter(x=>'videoId' in x).map(x=>[x.videoId,x])).values()];await json('data/analytics/recommendations.json',await learn(unique));return;}
 const runId=values['run-id'];if(!runId||!/^[A-Za-z0-9_-]+$/.test(runId))throw new Error('A valid --run-id is required');const dir=join('data/runs',runId);
 if(command==='publish'){
  const runner=new Runner(dir);await runner.lock();try{
   const m=await artifact(dir,'metadata',s.metadata);const video=await artifact(dir,'render',s.rendered);const thumb=await artifact(dir,'thumbnail',s.thumbnail);const composition=await artifact(dir,'composition',s.composition);const script=await artifact(dir,'script',s.script);const facts=await artifact(dir,'facts',s.facts);
   if(await fileDigest(video.path)!==video.sha256||await fileDigest(thumb.path)!==thumb.sha256)throw new Error('Media checksum mismatch');
   const v=await artifact(dir,'voice',s.voice);const a=await artifact(dir,'visuals',media);
   if((await read(join(dir,'manifest.json'))).mode==='production'){const audioCheck=await inspectAudio(video.path,{expectedDuration:video.duration});if(!audioCheck.passed)throw new Error('Production audio QA failed; upload blocked');}
   const qa=await inspect(video.path,script,composition,facts,m,[...v.scenes,...a.assets,{path:(await artifact(dir,'audio-mix',audioMix)).path}].map(x=>x.path));requireQA(qa);await json(join(dir,'qa-upload.json'),qa);
   const schedule=await read('config/schedule.json');scheduleAllowed({...schedule,publishAt:m.publishAt},process.env.AUTO_PUBLISH);
   const uploadFile=join(dir,'upload.json');let uploaded;try{uploaded=s.upload.parse(await read(uploadFile));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Supabase is required for durable upload deduplication');
   const storage=new SupabaseStorage();const key=`upload-${runId}`;const fingerprint=(await read(join(dir,'manifest.json'))).fingerprint;
   const reservation=await storage.create(key,{state:'pending',fingerprint,startedAt:new Date().toISOString()});
   if(!reservation){const existing=z.object({state:z.enum(['pending','uploaded']),fingerprint:z.string(),videoId:z.string().optional()}).parse(await storage.get(key));if(existing.fingerprint!==fingerprint)throw new Error('Upload run identity conflicts with durable ledger');if(existing.state==='pending'||!existing.videoId)throw new Error('Upload outcome uncertain. Reconcile the durable upload ledger with YouTube Studio before retrying.');uploaded={videoId:existing.videoId,privacyStatus:'private',publishAt:null};await json(uploadFile,uploaded);}
   else{if(uploaded)throw new Error('Local upload exists but durable ledger is missing; reconcile before uploading');const videoId=await uploadPrivate(video.path,thumb.path,m,qa);await storage.put(key,{state:'uploaded',fingerprint,videoId});uploaded={videoId,privacyStatus:'private',publishAt:null};await json(uploadFile,uploaded);}
   await runner.stage('youtube-thumbnail',s.thumbnail,async()=>{await setThumbnail(uploaded.videoId,thumb.path);return thumb;});
   if(m.publishAt)await runner.stage('schedule',s.upload,async()=>{await scheduleVideo(uploaded.videoId,m.publishAt!);return {...uploaded,publishAt:m.publishAt};});
   await log(dir,'private_upload_completed',{videoId:uploaded.videoId});
  }finally{await runner.unlock();}return;
 }
 if(command==='analytics'){const uploaded=s.upload.parse(await read(join(dir,'upload.json')));const script=await artifact(dir,'script',s.script);const video=await artifact(dir,'render',s.rendered);const thumb=await artifact(dir,'thumbnail',s.thumbnail);const row=await collect(uploaded.videoId,{topic:script.topic,format:'explainer',hook:script.hook,title:script.title,thumbnailVariant:thumb.variant,duration:video.duration},values['start-date']??new Date(Date.now()-30*86400000).toISOString().slice(0,10),values['end-date']??new Date().toISOString().slice(0,10));await json(`data/analytics/${uploaded.videoId}.json`,row);if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)await new SupabaseStorage().put(`analytics-${uploaded.videoId}`,row);return;}
 throw new Error('Unknown command');
}
main().catch(error=>{console.error(JSON.stringify({event:'command_failed',message:error instanceof Error?error.message:'Unknown error'}));process.exitCode=1;});
