import {parseArgs} from 'node:util';
import {join} from 'node:path';
import {readdir} from 'node:fs/promises';
import {runVideo} from './pipeline';
import {createBranding} from '../branding';
import {json,read,log} from './io';
import {Runner} from './runner';
import {artifact,fileDigest} from './integrity';
import {uploadPrivate,setThumbnail,scheduleAllowed,scheduleVideo,nextPublishSlot,findUploadByTag,setLocalizations,videoStatus,addToPlaylist,shortPublishAt} from '../youtube';
import {access} from 'node:fs/promises';
import {shortRendered,shortDescription,shortLocalizations} from '../shorts';
import {tiktokConfig,tiktokCredentials,tiktokRecord,sendToTikTok,tiktokStatus} from '../tiktok';
import {schedule as scheduleConfig,seriesConfig} from './config';
import {translateMetadata} from '../packaging/localize';
import {FreeFirstLLM} from '../providers/free';
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
   const runTag='bu-'+runId.toLowerCase();let uploadedNow=false;
   if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY){
    // No Supabase ledger: the channel itself is the durable record, keyed by a hidden per-run tag.
    if(!uploaded){const existing=await findUploadByTag(runTag);if(existing){uploaded={videoId:existing,privacyStatus:'private' as const,publishAt:null};await json(uploadFile,uploaded);}else{const videoId=await uploadPrivate(video.path,thumb.path,{...m,tags:[...m.tags,runTag]},qa);uploadedNow=true;uploaded={videoId,privacyStatus:'private' as const,publishAt:null};await json(uploadFile,uploaded);}}
   }else{
     const storage=new SupabaseStorage();const key=`upload-${runId}`;const fingerprint=(await read(join(dir,'manifest.json'))).fingerprint;
     const reservation=await storage.create(key,{state:'pending',fingerprint,startedAt:new Date().toISOString()});
     if(!reservation){const existing=z.object({state:z.enum(['pending','uploaded']),fingerprint:z.string(),videoId:z.string().optional()}).parse(await storage.get(key));if(existing.fingerprint!==fingerprint)throw new Error('Upload run identity conflicts with durable ledger');if(existing.state==='pending'||!existing.videoId)throw new Error('Upload outcome uncertain. Reconcile the durable upload ledger with YouTube Studio before retrying.');uploaded={videoId:existing.videoId,privacyStatus:'private',publishAt:null};await json(uploadFile,uploaded);}
     else{if(uploaded)throw new Error('Local upload exists but durable ledger is missing; reconcile before uploading');const videoId=await uploadPrivate(video.path,thumb.path,m,qa);uploadedNow=true;await storage.put(key,{state:'uploaded',fingerprint,videoId});uploaded={videoId,privacyStatus:'private',publishAt:null};await json(uploadFile,uploaded);}
   }
   // Owner-approved 2026-10-11: translated titles/descriptions when the run produced them (older runs have none).
   // Runs created before translations existed get them here, from the same approved metadata.
   const loc=await runner.stage('localizations',s.localizations,()=>translateMetadata(new FreeFirstLLM(),m));
   // Once a video is scheduled or public the owner controls its title, thumbnail and A/B test: a re-run never overwrites them.
   const current=await videoStatus(uploaded.videoId);const ownerControlled=!uploadedNow&&(current.privacyStatus!=='private'||!!current.publishAt);let mainAt=current.publishAt??(current.privacyStatus==='public'?new Date().toISOString():null);
   if(ownerControlled)await log(dir,'owner_metadata_kept',current);
   else{
    {const l=loc;await runner.stage('youtube-localizations',s.localizations,async()=>{await setLocalizations(uploaded.videoId,m,l,process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY?m.tags:[...m.tags,runTag]);return l;});}
    await runner.stage('youtube-thumbnail',s.thumbnail,async()=>{await setThumbnail(uploaded.videoId,thumb.path);return thumb;});
    if(publishAt)mainAt=(await runner.stage('schedule',s.upload,async()=>{const now=await videoStatus(uploaded.videoId);if(now.privacyStatus!=='private'||now.publishAt){await log(dir,'schedule_kept',now);return {...uploaded,privacyStatus:now.privacyStatus==='public'?'public' as const:'private' as const,publishAt:now.publishAt};}await scheduleVideo(uploaded.videoId,publishAt);return {...uploaded,publishAt};})).publishAt??mainAt;
   }
   await log(dir,'private_upload_completed',{videoId:uploaded.videoId});
   const series=seriesConfig.parse(await read('config/series.json'));const playlist=series.runs[runId]??series.defaultPlaylist;
   await runner.stage('playlist',z.object({playlistId:z.string(),title:z.string()}),async()=>({playlistId:await addToPlaylist(uploaded.videoId,playlist.title,playlist.description),title:playlist.title}));
   // Owner-authorized 2026-10-11: the vertical Short links the full video and releases after it.
   const failures:string[]=[];
   if(await access(join(dir,'short.json')).then(()=>true,()=>false)){
    const short=await artifact(dir,'short',shortRendered);if(await fileDigest(short.path)!==short.sha256)throw new Error('Short checksum mismatch');
    const url=`https://youtu.be/${uploaded.videoId}`,shortTag=runTag+'-short';
    const sm={...short.metadata,title:short.window.title,description:shortDescription(m,script.hook,url),tags:[...m.tags.slice(0,27),'shorts',shortTag]};
    const shortUpload=await runner.stage('short-upload',s.upload,async()=>{const existing=await findUploadByTag(shortTag);return {videoId:existing??await uploadPrivate(short.path,thumb.path,sm,qa),privacyStatus:'private' as const,publishAt:null};});
    const shortNow=await videoStatus(shortUpload.videoId);
    if(shortNow.privacyStatus==='private'&&!shortNow.publishAt){
     await runner.stage('short-localizations',s.localizations,async()=>{const l=shortLocalizations(loc,url);await setLocalizations(shortUpload.videoId,sm,l,sm.tags);return l;});
     if(mainAt){const at=shortPublishAt(mainAt,schedule);scheduleAllowed({...schedule,publishAt:at},process.env.AUTO_PUBLISH);await runner.stage('short-schedule',s.upload,async()=>{await scheduleVideo(shortUpload.videoId,at);return {...shortUpload,publishAt:at};});}
    }else await log(dir,'short_schedule_kept',shortNow);
    const tk=tiktokConfig.parse(await read('config/tiktok.json')),cred=tiktokCredentials();
    if(!tk.enabled)await log(dir,'tiktok_disabled',{});
    else if(!cred)await log(dir,'tiktok_skipped',{reason:'TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET and TIKTOK_REFRESH_TOKEN secrets are not configured'});
    else try{
     const recordFile=join(dir,'tiktok.json');let record;try{record=tiktokRecord.parse(await read(recordFile));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
     // A pending record means an upload may already have reached TikTok: check it instead of posting twice.
     if(!record){const sent=await sendToTikTok(short.path,short.window.title,tk,cred,publishId=>json(recordFile,{state:'pending',publishId,mode:tk.mode}));if(sent.rotated)await log(dir,'tiktok_refresh_token_rotated',{action:'If the next TikTok upload fails to authenticate, re-authorize and update the TIKTOK_REFRESH_TOKEN secret'});record={state:'sent' as const,publishId:sent.publishId,mode:tk.mode};}
     const st=await tiktokStatus(record.publishId,cred);await json(recordFile,{...record,state:'sent',status:st.status});await log(dir,'tiktok_status',st);if(st.status==='FAILED')failures.push('TikTok processing failed: '+st.failReason);
    }catch(error){failures.push(error instanceof Error?error.message:'TikTok upload failed');await log(dir,'tiktok_failed',{message:failures.at(-1)});}
   }
   if(failures.length)throw new Error(failures.join('; '));
  }finally{await runner.unlock();}return;
 }
 if(command==='analytics'){const uploaded=s.upload.parse(await read(join(dir,'upload.json')));const script=await artifact(dir,'script',s.script);const video=await artifact(dir,'render',s.rendered);const thumb=await artifact(dir,'thumbnail',s.thumbnail);const row=await collect(uploaded.videoId,{topic:script.topic,format:'explainer',hook:script.hook,title:script.title,thumbnailVariant:thumb.variant,duration:video.duration},values['start-date']??new Date(Date.now()-30*86400000).toISOString().slice(0,10),values['end-date']??new Date().toISOString().slice(0,10));await json(`data/analytics/${uploaded.videoId}.json`,row);if(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_ROLE_KEY)await new SupabaseStorage().put(`analytics-${uploaded.videoId}`,row);return;}
 throw new Error('Unknown command');
}
main().catch(error=>{console.error(JSON.stringify({event:'command_failed',message:error instanceof Error?error.message:'Unknown error'}));process.exitCode=1;});
