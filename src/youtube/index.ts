import {google} from 'googleapis';
import {createReadStream} from 'node:fs';
import type {z} from 'zod';
import {metadata as schema} from '../orchestration/schemas';
import {requireQA} from '../qa';
export function auth(){for(const key of ['YOUTUBE_CLIENT_ID','YOUTUBE_CLIENT_SECRET','YOUTUBE_REFRESH_TOKEN'])if(!process.env[key])throw new Error(`Missing ${key}`);const oauth=new google.auth.OAuth2(process.env.YOUTUBE_CLIENT_ID,process.env.YOUTUBE_CLIENT_SECRET);oauth.setCredentials({refresh_token:process.env.YOUTUBE_REFRESH_TOKEN});return oauth;}
export function scheduleAllowed(schedule:{autoPublish:boolean;publishAt:string|null},enabled:string|undefined){if(schedule.publishAt&&(!schedule.autoPublish||enabled!=='true'))throw new Error('Scheduling disabled: requires config autoPublish and AUTO_PUBLISH=true');if(schedule.publishAt&&Date.parse(schedule.publishAt)<=Date.now())throw new Error('publishAt must be in the future');}
export async function uploadPrivate(video:string,thumbnail:string,m:z.infer<typeof schema>,qa:{passed:boolean;checks:{passed:boolean}[]}){
 requireQA(qa);schema.parse(m);const youtube=google.youtube({version:'v3',auth:auth()});
 const res=await youtube.videos.insert({part:['snippet','status'],requestBody:{snippet:{title:m.title,description:m.description,tags:m.tags,categoryId:m.categoryId},status:{privacyStatus:'private',selfDeclaredMadeForKids:m.madeForKids,containsSyntheticMedia:m.syntheticMedia}},media:{body:createReadStream(video)}});
 if(!res.data.id)throw new Error('YouTube did not return a video ID');return res.data.id;
}
export async function setThumbnail(videoId:string,path:string){const youtube=google.youtube({version:'v3',auth:auth()});await youtube.thumbnails.set({videoId,media:{body:createReadStream(path)}});}
export async function scheduleVideo(videoId:string,publishAt:string){const youtube=google.youtube({version:'v3',auth:auth()});await youtube.videos.update({part:['status'],requestBody:{id:videoId,status:{privacyStatus:'private',publishAt}}});}
/** Next daily publish slot (HH:MM UTC) at least minLeadHours after now, so YouTube can finish processing before release. */
export function nextPublishSlot(slot:{publishTimeUtc?:string;minLeadHours?:number},now=new Date()){const [h,m]=(slot.publishTimeUtc??'17:00').split(':').map(Number);const earliest=now.getTime()+(slot.minLeadHours??3)*3600000;const at=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),h,m));while(at.getTime()<earliest)at.setUTCDate(at.getUTCDate()+1);return at.toISOString();}
/** Without the Supabase ledger, a hidden per-run tag on the channel's own recent uploads prevents a duplicate upload on retry. */
export async function findUploadByTag(tag:string){const youtube=google.youtube({version:'v3',auth:auth()});const channel=await youtube.channels.list({part:['contentDetails'],mine:true});const uploads=channel.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;if(!uploads)throw new Error('Channel uploads playlist not found');const items=await youtube.playlistItems.list({part:['contentDetails'],playlistId:uploads,maxResults:50});const ids=(items.data.items??[]).map(i=>i.contentDetails?.videoId).filter((x):x is string=>!!x);if(!ids.length)return null;const videos=await youtube.videos.list({part:['snippet'],id:ids});return videos.data.items?.find(v=>v.snippet?.tags?.includes(tag))?.id??null;}
/** Applies translated titles/descriptions to an uploaded video; snippet must be resent in full, so the approved English metadata is repeated unchanged. */
export async function setLocalizations(videoId:string,m:z.infer<typeof schema>,loc:{defaultLanguage:string;items:Record<string,{title:string;description:string}>},tags:string[]){const youtube=google.youtube({version:'v3',auth:auth()});await youtube.videos.update({part:['snippet','localizations'],requestBody:{id:videoId,snippet:{title:m.title,description:m.description,tags,categoryId:m.categoryId,defaultLanguage:loc.defaultLanguage,defaultAudioLanguage:loc.defaultLanguage},localizations:loc.items}});}
/** Current privacy and schedule, so a retried publish never re-privatizes or reschedules a video that is already public or scheduled. */
export async function videoStatus(videoId:string){const youtube=google.youtube({version:'v3',auth:auth()});const res=await youtube.videos.list({part:['status'],id:[videoId]});const st=res.data.items?.[0]?.status;return {privacyStatus:st?.privacyStatus??null,publishAt:st?.publishAt??null};}
/** Owner-approved 2026-10-11: each video joins its series playlist, created once by exact title; re-runs never add a duplicate item. */
export async function addToPlaylist(videoId:string,title:string,description:string){const youtube=google.youtube({version:'v3',auth:auth()});let playlistId:string|undefined;let page:string|undefined;
 do{const res=await youtube.playlists.list({part:['snippet'],mine:true,maxResults:50,pageToken:page});playlistId=res.data.items?.find(p=>p.snippet?.title===title)?.id??undefined;page=playlistId?undefined:res.data.nextPageToken??undefined;}while(page);
 if(!playlistId){const created=await youtube.playlists.insert({part:['snippet','status'],requestBody:{snippet:{title,description},status:{privacyStatus:'public'}}});playlistId=created.data.id??undefined;if(!playlistId)throw new Error('YouTube did not return a playlist ID');}
 // A just-created playlist can briefly read as "not found": retry a few times before giving up.
 for(let attempt=0;;attempt++){try{const items=await youtube.playlistItems.list({part:['contentDetails'],playlistId,maxResults:50,videoId});if(!items.data.items?.length)await youtube.playlistItems.insert({part:['snippet'],requestBody:{snippet:{playlistId,resourceId:{kind:'youtube#video',videoId}}}});return playlistId;}
  catch(error){if(attempt>=4||!/cannot be found|playlistNotFound/i.test(String((error as Error).message)))throw error;await new Promise(r=>setTimeout(r,5000*(attempt+1)));}}
}
/** The Short releases shortsOffsetHours after the full video, and never sooner than minLeadHours from now. */
export function shortPublishAt(mainAt:string,slot:{shortsOffsetHours?:number;minLeadHours?:number},now=new Date()){return new Date(Math.max(Date.parse(mainAt)+(slot.shortsOffsetHours??3)*3600000,now.getTime()+(slot.minLeadHours??3)*3600000)).toISOString();}
