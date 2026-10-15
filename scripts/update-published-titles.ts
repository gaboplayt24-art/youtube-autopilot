import {isDeepStrictEqual} from 'node:util';
import {google} from 'googleapis';
import {auth} from '../src/youtube';
import {read,json} from '../src/orchestration/io';
import {digest} from '../src/orchestration/integrity';
import {isTitleExperimentBlock,metadataInvariant,prepareTitleRevision,titleRevision,titleRevisionSnapshot} from '../src/youtube/title-revision';
const root='.cache/title-revision';
async function main(){
 const plan=titleRevision.parse(await read('data/metadata/published-title-revision-2026-10-15.json'));
 const youtube=google.youtube({version:'v3',auth:auth()}),ids=plan.videos.map(v=>v.videoId);
 const owned=await youtube.channels.list({part:['id'],mine:true});if(!owned.data.items?.some(c=>c.id===plan.channelId))throw Error('OAuth account is not the approved channel owner');
 const fetchVideos=async()=>{const result=await youtube.videos.list({part:['snippet','status','localizations'],id:ids});if(result.data.items?.length!==ids.length)throw Error('Some reviewed videos are unavailable');return result.data.items;};
 const before=await fetchVideos();const changes=plan.videos.map(c=>prepareTitleRevision(before.find(v=>v.id===c.videoId)!,c,plan.channelId));
 if(process.env.TITLE_ACTION!=='apply'){await json(root+'/before.json',{at:new Date().toISOString(),planDigest:digest(plan),videos:before});await json(root+'/preview.json',{changes:plan.videos.map((c,i)=>({videoId:c.videoId,before:before.find(v=>v.id===c.videoId)!.snippet!.title,after:c.title,changed:changes[i].changed}))});console.log(JSON.stringify({mode:'preview',titles:plan.videos.map(v=>({videoId:v.videoId,title:v.title})),writes:0}));return;}
 if(process.env.APPLY_TITLE_UPDATES!=='true')throw Error('Explicit workflow apply flag required');
 const frozen=await read(root+'/before.json');if(frozen.planDigest!==digest(plan)||!isDeepStrictEqual(titleRevisionSnapshot(frozen.videos),titleRevisionSnapshot(before)))throw Error('Metadata changed after backup; inspect before applying');
 const receipts=[];const blocked:{videoId:string;reason:string}[]=[];
 for(const [i,c] of plan.videos.entries()){
  const original=before.find(v=>v.id===c.videoId)!;const prepared=changes[i];
  if(prepared.changed){
   const parts=['snippet',...(prepared.request.localizations?['localizations']:[])];
   // Preserve the semantic backup check and conditional write. YouTube's generic
   // "Precondition check failed" can also mean an active Studio title experiment;
   // classify the actual structured reason rather than weakening this protection.
   const conditional=await youtube.videos.list({part:parts,id:[c.videoId]});const fresh=conditional.data.items?.[0];
   if(!fresh?.etag||!isDeepStrictEqual(titleRevisionSnapshot([{...fresh,status:original.status}]),titleRevisionSnapshot([original])))throw Error('Metadata changed immediately before conditional update');
   const etag=fresh.etag.startsWith('"')?fresh.etag:'"'+fresh.etag+'"';
   try{await youtube.videos.update({part:parts,requestBody:prepared.request},{headers:{'If-Match':etag}});}
   catch(error){
    if(!isTitleExperimentBlock(error))throw error;
    blocked.push({videoId:c.videoId,reason:'UPDATE_TITLE_NOT_ALLOWED_DURING_TEST_AND_COMPARE'});
    await json(root+'/after.json',{at:new Date().toISOString(),receipts,blocked});
    console.log(JSON.stringify({event:'title_experiment_preserved',videoId:c.videoId}));continue;
   }
  }
  const result=await youtube.videos.list({part:['snippet','status','localizations'],id:[c.videoId]});const current=result.data.items?.[0];
  if(!current||current.snippet?.title!==c.title||!isDeepStrictEqual(metadataInvariant(current),metadataInvariant(original)))throw Error('Post-update verification failed; original backup preserved');
  for(const [lang,value] of Object.entries(prepared.request.localizations??{}))if(current.localizations?.[lang]?.title!==value.title)throw Error('Translated title verification failed');
  receipts.push({videoId:c.videoId,url:'https://www.youtube.com/watch?v='+c.videoId,before:original.snippet!.title,after:current.snippet.title,changed:prepared.changed,verified:true});await json(root+'/after.json',{at:new Date().toISOString(),receipts,blocked});
 }
 console.log(JSON.stringify({mode:'applied',receipts,blocked}));
 if(blocked.length)throw Error('Active title experiments preserved on '+blocked.length+' videos; inspect blocked entries in the receipt');
}
main().catch(error=>{
 // Whitelist provider error fields only: never serialize Gaxios requests or headers.
 const apiError=error?.response?.data?.error;
 console.error(JSON.stringify({event:'title_revision_failed',message:error instanceof Error?error.message:'Metadata update failed',status:error?.response?.status,reasons:Array.isArray(apiError?.errors)?apiError.errors.map((e:{domain?:string;reason?:string;message?:string})=>({domain:e.domain,reason:e.reason,message:e.message})):[]}));process.exitCode=1;
});
