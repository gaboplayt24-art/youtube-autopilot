import {z} from 'zod';
import {PublicYouTubeClient} from '../packaging/engine';
import {parseDuration} from '../benchmarks';
export const biblicalQueries=[
 {topic:'Dead Sea Scrolls',query:'Dead Sea Scrolls history explained'},
 {topic:'Book of Enoch',query:'Book of Enoch why not in Bible history'},
 {topic:'Food in Bible times',query:'what did Jesus eat daily life history'},
 {topic:'Ark of the Covenant',query:'Ark of the Covenant history mystery'},
 {topic:'Tower of Babel',query:'Tower of Babel history explained'},
 {topic:'Life in ancient Jerusalem',query:'daily life ancient Jerusalem Bible history'},
 {topic:'Noahs ark',query:'Noahs ark ancient story history explained'},
 {topic:'Women in Bible times',query:'women daily life ancient Israel Bible history'}
];
const row=z.object({id:z.string(),snippet:z.object({title:z.string(),channelId:z.string(),channelTitle:z.string(),publishedAt:z.string().datetime(),defaultAudioLanguage:z.string().optional(),liveBroadcastContent:z.string().optional()}),statistics:z.object({viewCount:z.string().regex(/^\d+$/).optional(),likeCount:z.string().optional(),commentCount:z.string().optional()}),contentDetails:z.object({duration:z.string()}),liveStreamingDetails:z.unknown().optional()});
export const demandVideo=z.object({videoId:z.string(),url:z.string().url(),title:z.string(),channelId:z.string(),channelName:z.string(),publishedAt:z.string().datetime(),durationSeconds:z.number().positive(),views:z.number().nonnegative(),ageDays:z.number().positive(),viewsPerDay:z.number().nonnegative(),audioLanguage:z.string().nullable()});
export function observedVideo(raw:unknown,now:Date,since:Date){const v=row.parse(raw);const at=new Date(v.snippet.publishedAt);const duration=parseDuration(v.contentDetails.duration);if(at<since||at>=now||duration<180||v.liveStreamingDetails||v.snippet.liveBroadcastContent==='live'||v.snippet.liveBroadcastContent==='upcoming'||v.statistics.viewCount===undefined||v.snippet.defaultAudioLanguage&&!/^en(?:-|$)/i.test(v.snippet.defaultAudioLanguage))return null;const days=(now.getTime()-at.getTime())/86400000;return demandVideo.parse({videoId:v.id,url:'https://www.youtube.com/watch?v='+v.id,title:v.snippet.title,channelId:v.snippet.channelId,channelName:v.snippet.channelTitle,publishedAt:v.snippet.publishedAt,durationSeconds:duration,views:Number(v.statistics.viewCount),ageDays:days,viewsPerDay:Number(v.statistics.viewCount)/Math.max(days,1),audioLanguage:v.snippet.defaultAudioLanguage??null});}
const median=(values:number[])=>{const a=[...values].sort((a,b)=>a-b);return a.length?(a[Math.floor(a.length/2)]+a[Math.ceil(a.length/2)-1])/2:null;};
export async function researchBiblicalDemand(client=new PublicYouTubeClient(),now=new Date()){
 const since=new Date(now.getTime()-180*86400000),samples:Record<string,string[]>={},rawSearch=[];
 for(const item of biblicalQueries){const result=await client.get('search',{part:'snippet',q:item.query,type:'video',order:'relevance',maxResults:'25',relevanceLanguage:'en',regionCode:'US',publishedAfter:since.toISOString()});const ids=result.items.map(v=>z.object({id:z.object({videoId:z.string()})}).parse(v).id.videoId);samples[item.topic]=[...new Set(ids)];rawSearch.push({topic:item.topic,query:item.query,result});}
 const ids=[...new Set(Object.values(samples).flat())],rawVideos:unknown[]=[];
 for(let i=0;i<ids.length;i+=50)rawVideos.push(...(await client.get('videos',{part:'snippet,statistics,contentDetails,liveStreamingDetails',id:ids.slice(i,i+50).join(',')})).items);
 const videos=rawVideos.map(v=>observedVideo(v,now,since)).filter((v):v is z.infer<typeof demandVideo>=>v!==null);
 const topics=biblicalQueries.map(item=>{const matches=videos.filter(v=>samples[item.topic].includes(v.videoId));return {...item,sampleSize:matches.length,distinctChannels:new Set(matches.map(v=>v.channelId)).size,medianViews:median(matches.map(v=>v.views)),medianViewsPerDay:median(matches.map(v=>v.viewsPerDay)),videos:matches.sort((a,b)=>b.viewsPerDay-a.viewsPerDay)};}).sort((a,b)=>(b.medianViewsPerDay??-1)-(a.medianViewsPerDay??-1));
 return {generatedAt:now.toISOString(),windowDays:180,searchRegion:'US',searchLanguagePreference:'en',searchVolume:null,paidApiCostUsd:0,topics,rawEvidence:{search:rawSearch,videos:rawVideos},limitations:['Public view velocity is an interest signal, not search volume or a forecast of our reach.','Search relevance results are a biased sample, not all videos or all searches.','Channel size, video age, promotion and format affect views; unknown audio language is explicitly retained.','No competitor scripts, audience geography, impressions, CTR or retention were retrieved.'],nextStep:'Choose an original historically supportable angle; titles remain editorial hypotheses, not guaranteed winners.'};
}
