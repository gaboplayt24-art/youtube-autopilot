import {createReadStream} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {google} from 'googleapis';
import {z} from 'zod';
import {auth,videoStatus,scheduleVideo} from '../youtube';
import {SupabaseStorage} from '../database/storage';
import {artifact,fileDigest,digest} from '../orchestration/integrity';
import {qa,rendered} from '../orchestration/schemas';
import {requireQA} from '../qa';
import {json} from '../orchestration/io';
import {clipBundle} from './clips';
import {releaseSlots} from './plan';
import {shortMetadata} from './localize';
export class ZernioClient {
 constructor(private key:string,private request:typeof fetch=fetch){if(!key)throw Error('ZERNIO_API_KEY required in GitHub Actions');}
 async api(path:string,body?:unknown,idempotencyKey?:string,method?:'DELETE'){
  const response=await this.request('https://zernio.com/api/v1'+path,{method:method??(body===undefined?'GET':'POST'),redirect:'error',headers:{Authorization:'Bearer '+this.key,'Content-Type':'application/json',...(idempotencyKey?{'x-request-id':idempotencyKey}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  if(!response.ok)throw Error('Zernio API HTTP '+response.status+'; no blind post retry');return response.json();
 }
 async account(){const response=z.object({accounts:z.array(z.object({_id:z.string().regex(/^[a-f0-9]{24}$/i),platform:z.string(),isActive:z.boolean().optional(),username:z.string().optional()}))}).parse(await this.api('/accounts'));const accounts=response.accounts.filter(a=>a.platform==='tiktok'&&a.isActive!==false);if(accounts.length!==1)throw Error('Exactly one active owner TikTok required; ambiguous destinations blocked');return accounts[0];}
 async creator(accountId:string){return z.object({creator:z.object({canPostMore:z.boolean()}),privacyLevels:z.array(z.object({value:z.string()})),postingLimits:z.object({maxVideoDurationSec:z.number(),interactionSettings:z.record(z.object({enabled:z.boolean()}).nullable())})}).parse(await this.api(`/accounts/${accountId}/tiktok/creator-info?mediaType=video`));}
 async upload(path:string){
  const bytes=await readFile(path);if(bytes.length>45000000)throw Error('Clip exceeds 45 MB conservative upload limit');
  const presign=z.object({uploadUrl:z.string().url(),publicUrl:z.string().url()}).parse(await this.api('/media/presign',{filename:path.split('/').at(-1),contentType:'video/mp4',size:bytes.length}));
  const upload=new URL(presign.uploadUrl),publicUrl=new URL(presign.publicUrl);
  if(upload.protocol!=='https:'||!upload.hostname.endsWith('.r2.cloudflarestorage.com')||upload.username||upload.password||publicUrl.protocol!=='https:'||publicUrl.hostname!=='media.zernio.com'||publicUrl.username||publicUrl.password)throw Error('Unrecognized documented media host');
  const response=await this.request(upload,{method:'PUT',redirect:'error',headers:{'Content-Type':'video/mp4'},body:bytes,signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Zernio storage upload failed');return presign.publicUrl;
 }
}
export function requireTikTokConsent(env:NodeJS.ProcessEnv){
 if(env.CONTENT_PREVIEW_CONFIRMED!=='true'||env.EXPRESS_CONSENT_GIVEN!=='true')throw Error('TikTok requires owner review of the actual clip previews and express consent');
 const toggle=(name:string)=>z.enum(['allow','disable']).parse(env[name])==='allow';
 return {content_preview_confirmed:true,express_consent_given:true,privacy_level:'PUBLIC_TO_EVERYONE',allow_comment:toggle('ALLOW_COMMENT'),allow_duet:toggle('ALLOW_DUET'),allow_stitch:toggle('ALLOW_STITCH'),video_made_with_ai:true};
}
export async function publishClips(runId:string,bundlePath:string,approvedDigest:string,platform:'youtube'|'tiktok'){
 const bytes=await readFile(bundlePath);if(!/^[a-f0-9]{64}$/.test(approvedDigest)||createHash('sha256').update(bytes).digest('hex')!==approvedDigest)throw Error('Exact reviewed bundle SHA256 required');
 const bundle=clipBundle.parse(JSON.parse(bytes.toString()));if(bundle.runId!==runId)throw Error('Episode mismatch');
 const dir=join('data/runs',runId);requireQA(await artifact(dir,'qa',qa));const master=await artifact(dir,'render',rendered);if(await fileDigest(master.path)!==master.sha256)throw Error('Master hash mismatch');
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Durable social ledger required');
 const ledger=new SupabaseStorage(),main=z.object({state:z.literal('uploaded'),videoId:z.string()}).parse(await ledger.get('upload-'+runId));
 const mainStatus=await videoStatus(main.videoId);if(!mainStatus.publishAt)throw Error('Main video must be scheduled first; do not send traffic to an unavailable episode');
 const slots=releaseSlots(mainStatus.publishAt),settings=platform==='tiktok'?requireTikTokConsent(process.env):undefined;
 const zernio=platform==='tiktok'?new ZernioClient(process.env.ZERNIO_API_KEY??''):null,account=zernio?await zernio.account():null,creator=zernio&&account?await zernio.creator(account._id):null;
 if(creator&&(!creator.creator.canPostMore||!creator.privacyLevels.some(p=>p.value==='PUBLIC_TO_EVERYONE')))throw Error('TikTok creator cannot accept a public post');
 if(creator&&settings)for(const toggle of ['allow_comment','allow_duet','allow_stitch'] as const)if(settings[toggle]&&!creator.postingLimits.interactionSettings[toggle]?.enabled)throw Error('TikTok disallows selected interaction: '+toggle);
 const receipts=[];
 for(const [index,clip] of bundle.clips.entries()){
  if(!clip.qa.passed||clip.qa.checks.length<10||clip.qa.checks.some(c=>!c.passed)||clip.sourceRenderSha256!==master.sha256||await fileDigest(clip.path)!==clip.sha256)throw Error('Unapproved or changed clip');
  if(creator&&clip.duration>creator.postingLimits.maxVideoDurationSec)throw Error('Clip exceeds creator duration limit');
  const at=slots[index][platform],key=`social-${runId}-${clip.id}-${platform}`,fingerprint=digest({sha256:clip.sha256,title:clip.title,at,mainVideoId:main.videoId,accountId:account?._id,settings});
  const claimed=await ledger.create(key,{state:'pending',fingerprint,at});let remoteId:string;
  if(!claimed){const existing=z.object({state:z.enum(['pending','uploaded','scheduled']),fingerprint:z.string(),remoteId:z.string().optional()}).parse(await ledger.get(key));if(existing.fingerprint!==fingerprint||existing.state==='pending'||!existing.remoteId)throw Error('Uncertain or conflicting social reservation; reconcile remotely before retry');remoteId=existing.remoteId;}
  else if(platform==='youtube'){
   const metadata=shortMetadata(clip,main.videoId),youtube=google.youtube({version:'v3',auth:auth()}),response=await youtube.videos.insert({part:['snippet','status','localizations'],requestBody:{localizations:metadata.localizations,snippet:{title:metadata.title,description:metadata.description,defaultLanguage:'en',defaultAudioLanguage:'en',categoryId:'27',tags:['Bible history','Shorts',runId+'-'+clip.id]},status:{privacyStatus:'private',selfDeclaredMadeForKids:false,containsSyntheticMedia:true}},media:{body:createReadStream(clip.path)}});
   if(!response.data.id)throw Error('YouTube upload outcome uncertain');remoteId=response.data.id;await ledger.put(key,{state:'uploaded',fingerprint,remoteId,at});
  }else{
   const url=await zernio!.upload(clip.path),response=z.object({post:z.object({_id:z.string()})}).parse(await zernio!.api('/posts',{content:`${clip.title}\nFull episode on YouTube: @bibleunearthedhq\n#BibleHistory #BiblicalHistory`,mediaItems:[{type:'video',url}],platforms:[{platform:'tiktok',accountId:account!._id}],tiktokSettings:settings,scheduledFor:at,timezone:'UTC'},key));remoteId=response.post._id;await ledger.put(key,{state:'scheduled',fingerprint,remoteId,at});
  }
  if(platform==='youtube'){const status=await videoStatus(remoteId);if(status.privacyStatus==='private'&&!status.publishAt)await scheduleVideo(remoteId,at);else if(status.publishAt!==at)throw Error('Existing Short schedule differs; do not silently overwrite');await ledger.put(key,{state:'scheduled',fingerprint,remoteId,at});}
  else {const remote=await zernio!.api('/posts/'+encodeURIComponent(remoteId));if(!['scheduled','queued'].includes(remote.post?.status))throw Error('Zernio did not confirm queued scheduling');}
  receipts.push({platform,clipId:clip.id,remoteId,publishAt:at,url:platform==='youtube'?`https://www.youtube.com/shorts/${remoteId}`:null});
 }
 await json(join(dir,'social',platform+'-schedule.json'),{runId,receipts});return receipts;
}
