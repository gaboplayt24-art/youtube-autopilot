import {z} from 'zod';
import {PublicYouTubeClient} from '../packaging/engine';
import {parseDuration} from '../benchmarks';
// A public @handle or, when the handle is unknown, the channel id (UC…) from public search results.
const handleSchema=z.string().regex(/^(?:@[A-Za-z0-9._-]{3,100}|UC[A-Za-z0-9_-]{22})$/);
const video=z.object({id:z.string(),snippet:z.object({title:z.string(),description:z.string(),publishedAt:z.string().datetime(),thumbnails:z.record(z.object({url:z.string().url()})),liveBroadcastContent:z.string().optional()}),statistics:z.object({viewCount:z.string().regex(/^\d+$/).optional(),likeCount:z.string().optional(),commentCount:z.string().optional()}),contentDetails:z.object({duration:z.string()})});
/** Enumerate the public uploads playlist, rather than calling the newest page the channel winner. */
export async function analyzeReferenceChannel(handle:string,client=new PublicYouTubeClient(),now=new Date(),maximumUploads=5000){
 handle=handleSchema.parse(handle);
 const channelSchema=z.object({id:z.string(),snippet:z.object({title:z.string(),description:z.string()}),statistics:z.object({subscriberCount:z.string().optional(),videoCount:z.string().optional()}),contentDetails:z.object({relatedPlaylists:z.object({uploads:z.string()})})});
 const channel=channelSchema.parse((await client.get('channels',{part:'snippet,statistics,contentDetails',...(handle.startsWith('@')?{forHandle:handle}:{id:handle})})).items[0]);
 const uploads:string[]=[],raw:unknown[]=[];let token='';const seenTokens=new Set<string>();
 do{
  const page=await client.get('playlistItems',{part:'contentDetails',playlistId:channel.contentDetails.relatedPlaylists.uploads,maxResults:'50',...(token?{pageToken:token}:{})});
  const ids=page.items.map(v=>z.object({contentDetails:z.object({videoId:z.string()})}).parse(v).contentDetails.videoId).slice(0,maximumUploads-uploads.length);
  uploads.push(...ids);if(ids.length)raw.push(...(await client.get('videos',{part:'snippet,statistics,contentDetails',id:ids.join(',')})).items);
  token=page.nextPageToken??'';if(token&&seenTokens.has(token))throw new Error('YouTube pagination repeated a page token');seenTokens.add(token);
 }while(token&&uploads.length<maximumUploads);
 const deduplicated=[...new Map(raw.map(v=>{const parsed=video.parse(v);return [parsed.id,parsed] as const;})).values()];
 const videos=deduplicated.map(v=>({videoId:v.id,url:'https://www.youtube.com/watch?v='+v.id,title:v.snippet.title,description:v.snippet.description,publishedAt:v.snippet.publishedAt,durationSeconds:parseDuration(v.contentDetails.duration),views:v.statistics.viewCount===undefined?null:Number(v.statistics.viewCount),likes:v.statistics.likeCount===undefined?null:Number(v.statistics.likeCount),comments:v.statistics.commentCount===undefined?null:Number(v.statistics.commentCount),thumbnailUrl:(v.snippet.thumbnails.maxres??v.snippet.thumbnails.high??Object.values(v.snippet.thumbnails)[0])?.url??null,liveBroadcastContent:v.snippet.liveBroadcastContent??'unknown'})).sort((a,b)=>(b.views??-1)-(a.views??-1));
 const ranked=videos.filter(v=>v.views!==null&&v.liveBroadcastContent!=='live'&&v.liveBroadcastContent!=='upcoming');
 return {generatedAt:now.toISOString(),handle,channel,playlistTraversalComplete:!token,unreturnedVideoIds:[...new Set(uploads)].filter(id=>!videos.some(v=>v.videoId===id)),missingViewCounts:videos.filter(v=>v.views===null).length,rankingScope:'Public uploads returned by the official API with disclosed view counts; no private/deleted videos or hidden metrics.',mostViewedPublicVideo:ranked[0]??null,mostViewedOverThreeMinutes:ranked.find(v=>v.durationSeconds>180)??null,videos,paidApiCostUsd:0,limitations:['View counts are a snapshot and are not keyword search volume or predicted performance.','Duration does not establish whether YouTube classifies a video as a Short.','Topic and abstract packaging patterns may inspire original work; do not copy narration, artwork, characters or branding.']};
}
