// Owner-requested 2026-10-17: replace the scheduled Shorts and TikToks of a run with its QA-passed dynamic-edit
// clips, at the same release times and with the same metadata. Old Shorts stay private (never deleted); old TikTok
// posts are removed from the Zernio queue before their replacement is queued, so nothing is posted twice.
import {readFile,writeFile,access} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {join} from 'node:path';
import {google} from 'googleapis';
import {z} from 'zod';
import {auth,findUploadByTag,videoStatus} from '../src/youtube/index';
import {fileDigest} from '../src/orchestration/integrity';
import {clipBundle} from '../src/social/clips';
import {ZernioClient,requireTikTokConsent} from '../src/social/publish';

const runId=z.string().regex(/^[A-Za-z0-9_-]+$/).parse(process.env.RUN_ID);
const dir=join('data/runs',runId),recordPath=join(dir,'social','replace-clips.json');
const plan=z.object({runId:z.literal(runId),mainVideoId:z.string(),clips:z.array(z.object({id:z.string(),youtubeShortId:z.string(),youtubeAt:z.string(),tiktokPostId:z.string(),tiktokAt:z.string()}))}).parse(JSON.parse(await readFile(`data/scripts/${runId}-social-replacement.json`,'utf8')));
const bundle=clipBundle.parse(JSON.parse(await readFile(join(dir,'social','bundle.json'),'utf8')));
const record:Record<string,Record<string,unknown>>=await access(recordPath).then(async()=>JSON.parse(await readFile(recordPath,'utf8')),()=>({}));
const save=()=>writeFile(recordPath,JSON.stringify(record,null,1));
const log=(event:string,detail:Record<string,unknown>={})=>console.log(JSON.stringify({event,...detail}));

const main=await videoStatus(plan.mainVideoId);if(!main.publishAt&&main.privacyStatus!=='public')throw Error('The full episode must be scheduled or public before its clips point to it');
const youtube=google.youtube({version:'v3',auth:auth()});
const settings=requireTikTokConsent(process.env),zernio=new ZernioClient(process.env.ZERNIO_API_KEY??''),account=await zernio.account();

for(const item of plan.clips){
 const clip=bundle.clips.find(c=>c.id===item.id);if(!clip)throw Error(`Clip ${item.id} missing from the new bundle`);
 if(!clip.qa.passed||clip.qa.checks.some(c=>!c.passed)||await fileDigest(clip.path)!==clip.sha256)throw Error(`Clip ${item.id} is not QA-passed or changed`);
 const r=record[item.id]??={};
 // YouTube: the new Short takes the old one's title, description (already linking the new episode), tags and translations.
 if(!r.youtubeScheduled){
  const old=(await youtube.videos.list({part:['snippet','localizations','status'],id:[item.youtubeShortId]})).data.items?.[0];if(!old?.snippet)throw Error(`Short ${item.youtubeShortId} not found`);
  const tag=`${runId}-${item.id}-short-dynamic-v1`;
  let id=(r.youtubeShortId as string|undefined)??await findUploadByTag(tag);
  if(!id){const res=await youtube.videos.insert({part:['snippet','status','localizations'],requestBody:{snippet:{title:old.snippet.title,description:old.snippet.description,tags:[...(old.snippet.tags??[]).filter(t=>t!==tag),tag],categoryId:old.snippet.categoryId,defaultLanguage:old.snippet.defaultLanguage??'en',defaultAudioLanguage:old.snippet.defaultAudioLanguage??'en'},localizations:old.localizations??undefined,status:{privacyStatus:'private',selfDeclaredMadeForKids:false,containsSyntheticMedia:true}},media:{body:createReadStream(clip.path)}});id=res.data.id??undefined;if(!id)throw Error('YouTube did not return a Short ID');}
  r.youtubeShortId=id;await save();
  const at=Date.parse(item.youtubeAt)>Date.now()+15*60000?item.youtubeAt:new Date(Date.now()+3600000).toISOString();
  await youtube.videos.update({part:['status'],requestBody:{id,status:{privacyStatus:'private',publishAt:at,selfDeclaredMadeForKids:false,containsSyntheticMedia:true}}});
  if(old.status?.publishAt)await youtube.videos.update({part:['status'],requestBody:{id:item.youtubeShortId,status:{privacyStatus:'private',selfDeclaredMadeForKids:false,containsSyntheticMedia:true}}});
  Object.assign(r,{youtubeAt:at,youtubeScheduled:true,oldShortUnscheduled:true});await save();log('short_replaced',{clip:item.id,id,at});
 }
 // TikTok: remove the queued old post first, then queue the new clip at the same time with the owner's standing settings.
 if(!r.tiktokScheduled){
  if(!r.oldTikTokRemoved){
   const old=await zernio.api('/posts/'+encodeURIComponent(item.tiktokPostId)).catch(()=>null) as {post?:{status?:string;content?:string}}|null;
   if(old?.post?.status==='published')throw Error(`TikTok post ${item.tiktokPostId} already published; not replacing it`);
   r.tiktokContent=old?.post?.content;
   if(old?.post)await zernio.api('/posts/'+encodeURIComponent(item.tiktokPostId),undefined,undefined,'DELETE');
   r.oldTikTokRemoved=true;await save();
  }
  const at=Date.parse(item.tiktokAt)>Date.now()+15*60000?item.tiktokAt:new Date(Date.now()+5400000).toISOString();
  const content=(r.tiktokContent as string|undefined)??`${clip.title}\nFull episode on YouTube: @bibleunearthedhq\n#BibleHistory #BiblicalHistory`;
  const url=await zernio.upload(clip.path);
  const response=z.object({post:z.object({_id:z.string()})}).parse(await zernio.api('/posts',{content,mediaItems:[{type:'video',url}],platforms:[{platform:'tiktok',accountId:account._id}],tiktokSettings:settings,scheduledFor:at,timezone:'UTC'},`replace-${runId}-${item.id}-tiktok-v1`));
  Object.assign(r,{tiktokPostId:response.post._id,tiktokAt:at,tiktokScheduled:true});await save();log('tiktok_replaced',{clip:item.id,id:response.post._id,at});
 }
}
log('done',{record});
