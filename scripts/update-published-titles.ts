import {google} from 'googleapis';
import {auth} from '../src/youtube';
import {read,json} from '../src/orchestration/io';
import {digest} from '../src/orchestration/integrity';
import {metadataInvariant,prepareTitleRevision,titleRevision} from '../src/youtube/title-revision';
const root='.cache/title-revision';
async function main(){
 const plan=titleRevision.parse(await read('data/metadata/published-title-revision-2026-10-15.json'));
 const youtube=google.youtube({version:'v3',auth:auth()}),ids=plan.videos.map(v=>v.videoId);
 const owned=await youtube.channels.list({part:['id'],mine:true});if(!owned.data.items?.some(c=>c.id===plan.channelId))throw Error('OAuth account is not the approved channel owner');
 const fetchVideos=async()=>{const result=await youtube.videos.list({part:['snippet','status','localizations'],id:ids});if(result.data.items?.length!==ids.length)throw Error('Some reviewed videos are unavailable');return result.data.items;};
 const before=await fetchVideos();const changes=plan.videos.map(c=>prepareTitleRevision(before.find(v=>v.id===c.videoId)!,c,plan.channelId));
 if(process.env.TITLE_ACTION!=='apply'){await json(root+'/before.json',{at:new Date().toISOString(),planDigest:digest(plan),videos:before});await json(root+'/preview.json',{changes:plan.videos.map((c,i)=>({videoId:c.videoId,before:before.find(v=>v.id===c.videoId)!.snippet!.title,after:c.title,changed:changes[i].changed}))});console.log(JSON.stringify({mode:'preview',titles:plan.videos.map(v=>({videoId:v.videoId,title:v.title})),writes:0}));return;}
 if(process.env.APPLY_TITLE_UPDATES!=='true')throw Error('Explicit workflow apply flag required');
 const frozen=await read(root+'/before.json');if(frozen.planDigest!==digest(plan)||digest(frozen.videos)!==digest(before))throw Error('Metadata changed after backup; inspect before applying');
 const receipts=[];
 for(const [i,c] of plan.videos.entries()){
  const original=before.find(v=>v.id===c.videoId)!;const prepared=changes[i];
  if(prepared.changed)await youtube.videos.update({part:['snippet',...(prepared.request.localizations?['localizations']:[])],requestBody:prepared.request},{headers:original.etag?{'If-Match':original.etag}:{}});
  const result=await youtube.videos.list({part:['snippet','status','localizations'],id:[c.videoId]});const current=result.data.items?.[0];
  if(!current||current.snippet?.title!==c.title||digest(metadataInvariant(current))!==digest(metadataInvariant(original)))throw Error('Post-update verification failed; original backup preserved');
  for(const [lang,value] of Object.entries(prepared.request.localizations??{}))if(current.localizations?.[lang]?.title!==value.title)throw Error('Translated title verification failed');
  receipts.push({videoId:c.videoId,url:'https://www.youtube.com/watch?v='+c.videoId,before:original.snippet!.title,after:current.snippet.title,changed:prepared.changed,verified:true});await json(root+'/after.json',{at:new Date().toISOString(),receipts});
 }
 console.log(JSON.stringify({mode:'applied',receipts}));
}
main().catch(error=>{console.error(JSON.stringify({event:'title_revision_failed',message:error instanceof Error?error.message:'Metadata update failed'}));process.exitCode=1;});
