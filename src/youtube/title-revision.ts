import {z} from 'zod';
import type {youtube_v3} from 'googleapis';
import {digest} from '../orchestration/integrity';
const title=z.string().min(5).max(100);
export const titleRevision=z.object({channelId:z.string().regex(/^UC[A-Za-z0-9_-]+$/),videos:z.array(z.object({videoId:z.string().regex(/^[A-Za-z0-9_-]{11}$/),expectedTitle:title,title,translations:z.record(z.string(),title)})).min(1).max(10)});
export function prepareTitleRevision(video:youtube_v3.Schema$Video,change:z.infer<typeof titleRevision>['videos'][number],channelId:string){
 const s=video.snippet;
 if(video.id!==change.videoId||s?.channelId!==channelId)throw Error('Video does not belong to the approved channel');
 if(s.title!==change.expectedTitle&&s.title!==change.title)throw Error('Title changed since review; refusing to overwrite it');
 if(!s.categoryId||s.description===undefined)throw Error('Complete current snippet required');
 const snippet={title:change.title,description:s.description,tags:s.tags??[],categoryId:s.categoryId,...(s.defaultLanguage?{defaultLanguage:s.defaultLanguage}:{}),...(s.defaultAudioLanguage?{defaultAudioLanguage:s.defaultAudioLanguage}:{})};
 const localizations=Object.fromEntries(Object.entries(video.localizations??{}).map(([lang,value])=>[lang,{...value,title:change.translations[lang]??(lang==='en'?change.title:value.title)}]));
 // Do not create untranslated descriptions or touch privacy/status/thumbnail fields.
 const request:youtube_v3.Schema$Video={id:video.id,snippet,...(Object.keys(localizations).length?{localizations}:{})};
 const changed=s.title!==change.title||digest(video.localizations??{})!==digest(localizations);
 return {request,changed};
}
export function metadataInvariant(video:youtube_v3.Schema$Video){return {description:video.snippet?.description,tags:video.snippet?.tags??[],categoryId:video.snippet?.categoryId,defaultLanguage:video.snippet?.defaultLanguage,defaultAudioLanguage:video.snippet?.defaultAudioLanguage,thumbnails:video.snippet?.thumbnails,status:video.status,localizedDescriptions:Object.fromEntries(Object.entries(video.localizations??{}).map(([k,v])=>[k,v.description]))};}

export function titleRevisionSnapshot(videos:youtube_v3.Schema$Video[]){return videos.map(video=>({id:video.id,title:video.snippet?.title,metadata:metadataInvariant(video),localizations:video.localizations??{}})).sort((a,b)=>(a.id??'').localeCompare(b.id??''));}

/** An active Studio experiment requires an owner decision; other API failures must abort. */
export function isTitleExperimentBlock(error:unknown){
 const result=z.object({response:z.object({data:z.object({error:z.object({errors:z.array(z.object({reason:z.string()}))})})})}).safeParse(error);
 return result.success&&result.data.response.data.error.errors.some(e=>e.reason==='UPDATE_TITLE_NOT_ALLOWED_DURING_TEST_AND_COMPARE');
}
