// Owner-requested 2026-10-16: replace an already scheduled episode with its QA-passed re-edit.
// The owner's title, description, tags, translations, cover, playlist and release time are copied from the
// scheduled video; the old upload is only unscheduled (kept private), never deleted.
import {readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {google} from 'googleapis';
import {createReadStream} from 'node:fs';
import {auth,findUploadByTag,nextPublishSlot} from '../src/youtube/index';
import {requireQA} from '../src/qa';
import {fileDigest} from '../src/orchestration/integrity';

const env=(k:string)=>{const v=process.env[k];if(!v)throw new Error(`Missing ${k}`);return v;};
const runId=env('RUN_ID'),oldId=env('OLD_VIDEO_ID'),shortIds=(process.env.SHORT_IDS??'').split(',').filter(Boolean),dir=join('data/runs',runId);
const recordPath=join(dir,'replace-upload.json'),tag=`${runId}-dynamic-edit-v1`;
const read=async(p:string)=>JSON.parse(await readFile(join(dir,p),'utf8'));
const youtube=google.youtube({version:'v3',auth:auth()});
const log=(event:string,detail:Record<string,unknown>={})=>console.log(JSON.stringify({event,...detail}));

requireQA(await read('qa.json'));
const rendered=await read('render.json') as {path:string;sha256:string};
if(await fileDigest(rendered.path)!==rendered.sha256)throw new Error('Rendered video checksum mismatch');
const old=(await youtube.videos.list({part:['snippet','status','localizations'],id:[oldId]})).data.items?.[0];
if(!old?.snippet||!old.status)throw new Error(`Scheduled video ${oldId} not found on the channel`);
const record=await access(recordPath).then(async()=>JSON.parse(await readFile(recordPath,'utf8')) as Record<string,unknown>,()=>({} as Record<string,unknown>));
const save=async(patch:Record<string,unknown>)=>{Object.assign(record,patch);await writeFile(recordPath,JSON.stringify(record,null,1));};

// 1. Upload once: a retry finds the earlier upload by its hidden per-run tag.
let newId=(record.newVideoId as string|undefined)??await findUploadByTag(tag);
if(!newId){
 const res=await youtube.videos.insert({part:['snippet','status'],requestBody:{snippet:{title:old.snippet.title,description:old.snippet.description,tags:[...(old.snippet.tags??[]),tag],categoryId:old.snippet.categoryId,defaultLanguage:old.snippet.defaultLanguage,defaultAudioLanguage:old.snippet.defaultAudioLanguage},status:{privacyStatus:'private',selfDeclaredMadeForKids:old.status.selfDeclaredMadeForKids??false,containsSyntheticMedia:true}},media:{body:createReadStream(rendered.path)}});
 newId=res.data.id??undefined;if(!newId)throw new Error('YouTube did not return a video ID');
 log('uploaded',{newId});
}
await save({runId,oldVideoId:oldId,newVideoId:newId,videoSha256:rendered.sha256});

// 2. The owner's translations.
if(old.localizations&&Object.keys(old.localizations).length)await youtube.videos.update({part:['snippet','localizations'],requestBody:{id:newId,snippet:{title:old.snippet.title,description:old.snippet.description,tags:[...(old.snippet.tags??[]),tag],categoryId:old.snippet.categoryId,defaultLanguage:old.snippet.defaultLanguage??'en'},localizations:old.localizations}});

// 3. The owner's cover, copied from the scheduled video. Without it the video stays private for the owner.
let coverCopied=record.coverCopied===true;
if(!coverCopied){
 const t=old.snippet.thumbnails;const url=t?.maxres?.url??t?.standard?.url??t?.high?.url;
 try{
  if(!url)throw new Error('no thumbnail URL');
  const res=await fetch(url);if(!res.ok)throw new Error(`thumbnail download ${res.status}`);
  const file=join(dir,'replaced-cover.jpg');await writeFile(file,Buffer.from(await res.arrayBuffer()));
  await youtube.thumbnails.set({videoId:newId,media:{body:createReadStream(file)}});coverCopied=true;
 }catch(error){log('cover_copy_failed',{message:(error as Error).message});}
 await save({coverCopied});
}

// 4. Same playlists, same position; the old video leaves them.
let page:string|undefined;const playlists:string[]=[];
do{const res=await youtube.playlists.list({part:['id'],mine:true,maxResults:50,pageToken:page});for(const p of res.data.items??[]){const items=await youtube.playlistItems.list({part:['snippet'],playlistId:p.id!,videoId:oldId,maxResults:5});const item=items.data.items?.[0];if(!item)continue;
 const present=await youtube.playlistItems.list({part:['id'],playlistId:p.id!,videoId:newId,maxResults:5});
 if(!present.data.items?.length)await youtube.playlistItems.insert({part:['snippet'],requestBody:{snippet:{playlistId:p.id!,resourceId:{kind:'youtube#video',videoId:newId},position:item.snippet?.position??undefined}}});
 await youtube.playlistItems.delete({id:item.id!});playlists.push(p.id!);}
 page=res.data.nextPageToken??undefined;}while(page);
await save({playlists:[...new Set([...(record.playlists as string[]??[]),...playlists])]});

// 5. Schedule at the owner's release time, then unschedule the old upload (kept private, never deleted).
if(!coverCopied){await save({state:'awaiting-owner-cover'});log('handoff',{newId,studio:`https://studio.youtube.com/video/${newId}/edit`});process.exit(0);}
const schedule=JSON.parse(await readFile('config/schedule.json','utf8')) as {publishTimeUtc?:string;minLeadHours?:number};
const wanted=old.status.publishAt??record.publishAt as string|undefined;
const publishAt=wanted&&Date.parse(wanted)>Date.now()+3600000?wanted:nextPublishSlot(schedule);
await youtube.videos.update({part:['status'],requestBody:{id:newId,status:{privacyStatus:'private',publishAt,selfDeclaredMadeForKids:old.status.selfDeclaredMadeForKids??false,containsSyntheticMedia:true}}});
await save({publishAt});
if(old.status.publishAt)await youtube.videos.update({part:['status'],requestBody:{id:oldId,status:{privacyStatus:'private',selfDeclaredMadeForKids:old.status.selfDeclaredMadeForKids??false,containsSyntheticMedia:true}}});
await save({oldUnscheduled:true});

// 6. The Shorts point to the new full episode.
for(const id of shortIds){
 const short=(await youtube.videos.list({part:['snippet','localizations'],id:[id]})).data.items?.[0];if(!short?.snippet)continue;
 const swap=(s?:string|null)=>s?.split(oldId).join(newId)??s;
 const localizations=Object.fromEntries(Object.entries(short.localizations??{}).map(([k,v])=>[k,{...v,description:swap(v.description)}]));
 await youtube.videos.update({part:['snippet','localizations'],requestBody:{id,snippet:{title:short.snippet.title,description:swap(short.snippet.description),tags:short.snippet.tags,categoryId:short.snippet.categoryId,defaultLanguage:short.snippet.defaultLanguage??'en'},localizations}});
}
await save({shortsRelinked:shortIds,state:'scheduled'});
const check=(await youtube.videos.list({part:['status'],id:[newId,oldId]})).data.items??[];
log('done',{newId,publishAt,status:check.map(v=>({id:v.id,privacy:v.status?.privacyStatus,publishAt:v.status?.publishAt??null}))});
