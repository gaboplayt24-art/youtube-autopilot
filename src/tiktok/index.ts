import {readFile,stat} from 'node:fs/promises';
import {z} from 'zod';

// Owner-authorized 2026-10-11: the QA-passed vertical Short is also sent to TikTok through the official Content Posting API.
// Credentials come only from GitHub secrets.* bindings; nothing is posted publicly unless the owner later chooses it.
export const tiktokConfig=z.object({enabled:z.boolean(),mode:z.enum(['inbox','direct']),privacyLevel:z.enum(['SELF_ONLY','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','PUBLIC_TO_EVERYONE']),isAigc:z.boolean(),hashtags:z.array(z.string().regex(/^#\w+$/)).max(10)});
export const tiktokRecord=z.object({state:z.enum(['pending','sent']),publishId:z.string(),mode:z.enum(['inbox','direct']),status:z.string().optional()});
const API='https://open.tiktokapis.com/v2';
const MiB=1024*1024;
export function tiktokCredentials(){const key=process.env.TIKTOK_CLIENT_KEY,secret=process.env.TIKTOK_CLIENT_SECRET,refresh=process.env.TIKTOK_REFRESH_TOKEN;return key&&secret&&refresh?{key,secret,refresh}:null;}
/** TikTok chunk rules: files under 64 MiB go in one chunk; otherwise 10 MiB chunks, the last carrying the remainder. */
export function chunkPlan(size:number){if(size<=0)throw new Error('Empty video');if(size<=64*MiB)return {chunkSize:size,count:1};const chunkSize=10*MiB;return {chunkSize,count:Math.floor(size/chunkSize)};}
export function tiktokCaption(title:string,hashtags:string[]){const base=title.replace(/\s*#shorts\b/i,'').trim();return `${base} ${hashtags.join(' ')}`.slice(0,2200);}
type Fetch=typeof fetch;
async function api(request:Fetch,path:string,token:string,body:unknown){const res=await request(`${API}${path}`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json; charset=UTF-8'},body:JSON.stringify(body)});const data=await res.json() as {data?:Record<string,unknown>;error?:{code?:string;message?:string}};if(!res.ok||data.error?.code&&data.error.code!=='ok')throw new Error(`TikTok ${path} failed: ${data.error?.code??res.status} ${data.error?.message??''}`.trim());return data.data??{};}
export async function accessToken(c:{key:string;secret:string;refresh:string},request:Fetch=fetch){
 const res=await request(`${API}/oauth/token/`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_key:c.key,client_secret:c.secret,grant_type:'refresh_token',refresh_token:c.refresh})});
 const data=await res.json() as {access_token?:string;refresh_token?:string;error?:string;error_description?:string};if(!res.ok||!data.access_token)throw new Error(`TikTok token refresh failed: ${data.error??res.status} ${data.error_description??''}`.trim());
 // A rotated refresh token is never printed; the owner is told to re-authorize when the stored secret stops working.
 return {token:data.access_token,rotated:!!data.refresh_token&&data.refresh_token!==c.refresh};
}
/** Uploads the Short: inbox mode leaves a draft in the owner's TikTok app; direct mode posts with the configured privacy level. */
export async function sendToTikTok(path:string,title:string,config:z.infer<typeof tiktokConfig>,c:{key:string;secret:string;refresh:string},onInit:(publishId:string)=>Promise<void>,request:Fetch=fetch){
 const {token,rotated}=await accessToken(c,request);const size=(await stat(path)).size;const {chunkSize,count}=chunkPlan(size);const source_info={source:'FILE_UPLOAD',video_size:size,chunk_size:chunkSize,total_chunk_count:count};
 let init;if(config.mode==='direct'){const creator=await api(request,'/post/publish/creator_info/query/',token,{});const options=(creator.privacy_level_options??[]) as string[];if(!options.includes(config.privacyLevel))throw new Error(`TikTok account does not allow privacy ${config.privacyLevel}; allowed ${JSON.stringify(options)}`);init=await api(request,'/post/publish/video/init/',token,{post_info:{title:tiktokCaption(title,config.hashtags),privacy_level:config.privacyLevel,disable_duet:false,disable_comment:false,disable_stitch:false,video_cover_timestamp_ms:1000,is_aigc:config.isAigc},source_info});}
 else init=await api(request,'/post/publish/inbox/video/init/',token,{source_info});
 const publishId=String(init.publish_id??''),uploadUrl=String(init.upload_url??'');if(!publishId||!uploadUrl)throw new Error('TikTok did not return an upload URL');await onInit(publishId);
 const bytes=await readFile(path);
 for(let i=0;i<count;i++){const first=i*chunkSize,last=i===count-1?size-1:first+chunkSize-1;const res=await request(uploadUrl,{method:'PUT',headers:{'Content-Type':'video/mp4','Content-Length':String(last-first+1),'Content-Range':`bytes ${first}-${last}/${size}`},body:bytes.subarray(first,last+1)});if(!res.ok)throw new Error(`TikTok chunk ${i+1}/${count} upload failed: ${res.status}`);}
 return {publishId,rotated};
}
export async function tiktokStatus(publishId:string,c:{key:string;secret:string;refresh:string},request:Fetch=fetch){const {token}=await accessToken(c,request);const data=await api(request,'/post/publish/status/fetch/',token,{publish_id:publishId});return {status:String(data.status??'UNKNOWN'),failReason:data.fail_reason?String(data.fail_reason):null};}
