// Owner-requested 2026-10-28: a read-only snapshot of how the whole channel is doing, so topic choice and free SEO
// work start from measured numbers. Nothing is changed on YouTube. Metrics the API refuses are recorded as null with
// the refusal, never estimated.
import {mkdir,writeFile} from 'node:fs/promises';
import {google} from 'googleapis';
import {auth} from '../src/youtube/index';

const out='data/research/channel-report';await mkdir(out,{recursive:true});
const a=auth(),youtube=google.youtube({version:'v3',auth:a}),analytics=google.youtubeAnalytics({version:'v2',auth:a});
const today=new Date().toISOString().slice(0,10),start='2026-01-01';
const errors:Record<string,string>={};const note=(key:string,error:unknown)=>{errors[key]=String((error as {message?:string}).message??error).slice(0,300);};

const channel=(await youtube.channels.list({mine:true,part:['snippet','statistics','contentDetails','brandingSettings']})).data.items?.[0];
if(!channel)throw Error('No channel for these credentials');
const uploadsId=channel.contentDetails?.relatedPlaylists?.uploads;if(!uploadsId)throw Error('Channel uploads playlist missing');
const ids:string[]=[];let page:string|undefined;
do{const r=await youtube.playlistItems.list({playlistId:uploadsId,part:['contentDetails'],maxResults:50,pageToken:page});ids.push(...(r.data.items??[]).flatMap(i=>i.contentDetails?.videoId?[i.contentDetails.videoId]:[]));page=r.data.nextPageToken??undefined;}while(page);
const videos:Record<string,unknown>[]=[];
for(let i=0;i<ids.length;i+=50){const r=await youtube.videos.list({id:ids.slice(i,i+50),part:['snippet','statistics','status','contentDetails']});
 for(const v of r.data.items??[])videos.push({id:v.id,title:v.snippet?.title,publishedAt:v.snippet?.publishedAt,privacy:v.status?.privacyStatus,publishAt:v.status?.publishAt??null,duration:v.contentDetails?.duration,tags:v.snippet?.tags??[],descriptionLength:v.snippet?.description?.length??0,hasChapters:/^\s*0?0:00\b/m.test(v.snippet?.description??''),views:Number(v.statistics?.viewCount??0),likes:Number(v.statistics?.likeCount??0),comments:Number(v.statistics?.commentCount??0)});}

const query=async(key:string,params:Record<string,string|number>)=>{try{const r=await analytics.reports.query({ids:'channel==MINE',startDate:start,endDate:today,...params} as never);return {columns:(r.data.columnHeaders??[]).map(c=>c.name),rows:r.data.rows??[]};}catch(error){note(key,error);return null;}};
const perVideo=await query('perVideo',{metrics:'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,subscribersGained',dimensions:'video',sort:'-views',maxResults:200});
const impressions=await query('impressions',{metrics:'videoThumbnailImpressions,videoThumbnailImpressionsClickRate',dimensions:'video',sort:'-videoThumbnailImpressions',maxResults:200});
const traffic=await query('traffic',{metrics:'views,estimatedMinutesWatched',dimensions:'insightTrafficSourceType',sort:'-views'});
const searchTerms=await query('searchTerms',{metrics:'views',dimensions:'insightTrafficSourceDetail',filters:'insightTrafficSourceType==YT_SEARCH',sort:'-views',maxResults:25});
const suggested=await query('suggested',{metrics:'views',dimensions:'insightTrafficSourceDetail',filters:'insightTrafficSourceType==RELATED_VIDEO',sort:'-views',maxResults:25});
const countries=await query('countries',{metrics:'views,estimatedMinutesWatched',dimensions:'country',sort:'-views',maxResults:15});
const audience=await query('audience',{metrics:'viewerPercentage',dimensions:'ageGroup,gender'});
const daily=await query('daily',{metrics:'views,subscribersGained',dimensions:'day',sort:'day'});
const shortsVsLong=await query('creatorContentType',{metrics:'views,averageViewPercentage',dimensions:'creatorContentType'});
const retention:Record<string,unknown>={};
for(const v of videos.filter(v=>v.privacy==='public').slice(0,12)){const r=await query('retention-'+v.id,{metrics:'audienceWatchRatio,relativeRetentionPerformance',dimensions:'elapsedVideoTimeRatio',filters:'video=='+v.id});if(r)retention[v.id as string]=r;}

const report={generatedAt:new Date().toISOString(),window:{start,end:today},channel:{id:channel.id,title:channel.snippet?.title,customUrl:channel.snippet?.customUrl,description:channel.snippet?.description,keywords:channel.brandingSettings?.channel?.keywords??null,country:channel.snippet?.country??null,subscribers:Number(channel.statistics?.subscriberCount??0),views:Number(channel.statistics?.viewCount??0),videoCount:Number(channel.statistics?.videoCount??0)},videos,perVideo,impressions,traffic,searchTerms,suggested,countries,audience,daily,shortsVsLong,retention,refusedQueries:errors};
await writeFile(`${out}/channel-report.json`,JSON.stringify(report,null,1));
console.log(JSON.stringify({videos:videos.length,subscribers:report.channel.subscribers,views:report.channel.views,refused:Object.keys(errors)}));
