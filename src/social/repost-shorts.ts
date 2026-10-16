import {access,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {read,json} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {SupabaseStorage} from '../database/storage';
import {ZernioClient,requireTikTokConsent} from './publish';

/** Owner decision 2026-10-16: Shorts already reviewed and published on YouTube go to TikTok once each, spaced out, through the existing Zernio integration. */
export const repostConfig=z.object({publishTimeUtc:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),spacingHours:z.number().min(1).max(168),items:z.array(z.object({runId:z.string().regex(/^[a-z0-9-]+$/),youtubeShortId:z.string().regex(/^[A-Za-z0-9_-]{11}$/),caption:z.string().min(10).max(2000)})).min(1)});
/** Slot i is the daily publish time at least one hour from now, plus i*spacing. */
export function repostSlots(count:number,publishTimeUtc:string,spacingHours:number,now=new Date()){const [h,m]=publishTimeUtc.split(':').map(Number);const first=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate(),h,m));while(first.getTime()<now.getTime()+3600000)first.setUTCDate(first.getUTCDate()+1);return Array.from({length:count},(_,i)=>new Date(first.getTime()+i*spacingHours*3600000).toISOString());}
export async function repostShorts(){
 const config=repostConfig.parse(await read('config/tiktok-reposts.json')),settings=requireTikTokConsent(process.env);
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Durable social ledger required to prevent duplicate TikTok posts');
 const ledger=new SupabaseStorage(),zernio=new ZernioClient(process.env.ZERNIO_API_KEY??''),account=await zernio.account(),creator=await zernio.creator(account._id);
 if(!creator.creator.canPostMore||!creator.privacyLevels.some(p=>p.value==='PUBLIC_TO_EVERYONE'))throw Error('TikTok creator cannot accept a public post');
 for(const toggle of ['allow_comment','allow_duet','allow_stitch'] as const)if(settings[toggle]&&!creator.postingLimits.interactionSettings[toggle]?.enabled)throw Error('TikTok disallows selected interaction: '+toggle);
 const pending=[];for(const item of config.items){const key='tiktok-repost-'+item.runId;let existing:unknown=null;try{existing=await ledger.get(key);}catch{existing=null;}if(existing){console.log(JSON.stringify({event:'already_posted',runId:item.runId,record:existing}));continue;}pending.push(item);}
 const slots=repostSlots(pending.length,config.publishTimeUtc,config.spacingHours),receipts=[];
 for(const [index,item] of pending.entries()){
  const path=join('data','runs',item.runId,'short.mp4');try{await access(path);}catch{console.log(JSON.stringify({event:'short_missing',runId:item.runId,path}));continue;}
  // Only a Short that passed its own QA and reached YouTube is reposted.
  const upload=z.object({videoId:z.string()}).parse(await read(join('data','runs',item.runId,'short-upload.json')));if(upload.videoId!==item.youtubeShortId)throw Error('Short on disk is not the reviewed YouTube Short '+item.youtubeShortId);
  const size=(await stat(path)).size,sha256=await fileDigest(path),key='tiktok-repost-'+item.runId,at=slots[index];
  if(!await ledger.create(key,{state:'pending',sha256,at}))throw Error('Concurrent TikTok reservation for '+item.runId+'; reconcile before retry');
  const url=await zernio.upload(path),response=z.object({post:z.object({_id:z.string()})}).parse(await zernio.api('/posts',{content:item.caption,mediaItems:[{type:'video',url}],platforms:[{platform:'tiktok',accountId:account._id}],tiktokSettings:settings,scheduledFor:at,timezone:'UTC'},key));
  await ledger.put(key,{state:'scheduled',sha256,at,remoteId:response.post._id,youtubeShortId:item.youtubeShortId});
  const remote=await zernio.api('/posts/'+encodeURIComponent(response.post._id));if(!['scheduled','queued'].includes(remote.post?.status))throw Error('Zernio did not confirm queued scheduling for '+item.runId);
  receipts.push({runId:item.runId,youtubeShortId:item.youtubeShortId,remoteId:response.post._id,scheduledFor:at,bytes:size,sha256});
 }
 await json(join('data','social','tiktok-reposts-receipt.json'),{receipts});console.log(JSON.stringify({event:'tiktok_reposts_scheduled',receipts}));return receipts;
}
if(process.argv[1]?.endsWith('repost-shorts.ts'))repostShorts().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
