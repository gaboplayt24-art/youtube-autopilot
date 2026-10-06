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
