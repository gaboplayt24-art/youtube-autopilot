import {z} from 'zod';

export const deliveryTargets=z.object({
 runId:z.string().regex(/^[A-Za-z0-9_-]+$/),
 youtube:z.array(z.object({role:z.string(),id:z.string().regex(/^[A-Za-z0-9_-]{11}$/),scheduledFor:z.string().datetime()})).min(1),
 tiktok:z.array(z.object({role:z.string(),id:z.string().regex(/^[a-f0-9]{24}$/),scheduledFor:z.string().datetime()})),
});
type Target={role:string;id:string;scheduledFor:string};
const video=z.object({id:z.string(),snippet:z.object({title:z.string()}),status:z.object({privacyStatus:z.string(),uploadStatus:z.string().optional(),publishAt:z.string().optional()}),statistics:z.object({viewCount:z.string().optional()}).optional()});
const post=z.object({post:z.object({_id:z.string(),status:z.string(),scheduledFor:z.string().optional(),platforms:z.array(z.object({platform:z.string(),status:z.string().optional()})).optional()})});

/** Verify existing deliveries only. No upload, rescheduling, deletion or automatic retry. */
export async function auditDelivery(targets:z.infer<typeof deliveryTargets>,getVideos:(ids:string[])=>Promise<unknown>,getPost:(id:string)=>Promise<unknown>,now=new Date()){
 const plan=deliveryTargets.parse(targets),videos=z.array(video).parse(await getVideos(plan.youtube.map(v=>v.id)));
 const rows:{platform:string;role:string;id:string;state:string;healthy:boolean;scheduledFor:string;actualPublishAt?:string;title?:string;views?:string}[]=[];
 const due=(item:Target)=>Date.parse(item.scheduledFor)<=now.getTime();
 for(const item of plan.youtube){
  const v=videos.find(v=>v.id===item.id),s=v?.status;
  const failed=['failed','rejected','deleted'].includes(s?.uploadStatus??'');
  const publicVideo=s?.privacyStatus==='public'&&!failed;
  const scheduled=s?.privacyStatus==='private'&&!!s.publishAt&&Date.parse(s.publishAt)>now.getTime()&&!failed;
  const scheduleMatches=s?.publishAt!==undefined&&Date.parse(s.publishAt)===Date.parse(item.scheduledFor);
  rows.push({platform:'youtube',role:item.role,id:item.id,state:!v?'missing':failed?'upload-failed':publicVideo?'public':scheduled?'scheduled':due(item)?'overdue-or-private':'not-scheduled',healthy:publicVideo||(scheduled&&scheduleMatches),scheduledFor:item.scheduledFor,actualPublishAt:s?.publishAt,title:v?.snippet.title,views:v?.statistics?.viewCount});
 }
 for(const item of plan.tiktok){
  try{
   const p=post.parse(await getPost(item.id)).post;
   if(p._id!==item.id)throw Error('Mismatched post');
   const platform=p.platforms?.find(p=>p.platform==='tiktok');
   const failed=[p.status,platform?.status].some(s=>['failed','error','rejected','cancelled','canceled'].includes(s??''));
   const published=p.status==='published'&&!failed;
   const scheduled=['scheduled','queued'].includes(p.status)&&!failed&&!due(item)&&!!p.scheduledFor&&Date.parse(p.scheduledFor)===Date.parse(item.scheduledFor);
   rows.push({platform:'tiktok',role:item.role,id:item.id,state:failed?'delivery-failed':published?'published':due(item)?'overdue-'+p.status:p.status,healthy:published||scheduled,scheduledFor:item.scheduledFor,actualPublishAt:p.scheduledFor});
  }catch{
   rows.push({platform:'tiktok',role:item.role,id:item.id,state:'unverified-api-error',healthy:false,scheduledFor:item.scheduledFor});
  }
 }
 return {runId:plan.runId,checkedAt:now.toISOString(),mode:'read-only' as const,healthy:rows.every(r=>r.healthy),rows};
}
