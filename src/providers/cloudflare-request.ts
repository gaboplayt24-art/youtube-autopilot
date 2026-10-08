import {join} from 'node:path';
import {requireQuota,QuotaPause} from '../quota';
import {json,log} from '../orchestration/io';
export type CloudflareRetryOptions={wait?:(ms:number)=>Promise<void>;random?:()=>number;now?:()=>Date};
export class CloudflareRetryPause extends QuotaPause{
 constructor(reset:string,public state:'cloudflare_out_of_capacity'|'cloudflare_429_unknown'){super(reset);this.message=`${state}; checkpoint saved. Retry after ${reset}`;}
}
export function cloudflareRetryDelay(base:number,retryAfter:string|null,now:number,random:()=>number){const header=retryAfter===null?0:/^\d+(?:\.\d+)?$/.test(retryAfter)?Number(retryAfter)*1000:Math.max(0,Date.parse(retryAfter)-now);return Math.max(base*(1+random()*.2),Number.isFinite(header)?header:0);}
function sanitize(value:unknown){let text=String(value??'');for(const secret of [process.env.CLOUDFLARE_API_TOKEN,process.env.CLOUDFLARE_ACCOUNT_ID])if(secret){text=text.replaceAll(secret,'[redacted]').replaceAll(encodeURIComponent(secret),'[redacted]');}return text.replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,700);}
export async function cloudflareRun(model:string,input:unknown,neurons:number,request:typeof fetch,options:CloudflareRetryOptions={}){
 if(!process.env.CLOUDFLARE_ACCOUNT_ID||!process.env.CLOUDFLARE_API_TOKEN)throw new Error('CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required');
 if(process.env.CLOUDFLARE_FREE_PLAN_CONFIRMED!=='true')throw new Error('Confirm Workers FREE plan with CLOUDFLARE_FREE_PLAN_CONFIRMED=true. Paid accounts are refused to prevent overflow from concurrent external usage.');
 if(process.env.FREE_ONLY==='false'||process.env.PAID_FALLBACK_ENABLED==='true'||Number(process.env.MAX_PAID_COST_USD??0)!==0)throw new Error('Cloudflare requires FREE_ONLY with zero paid budget and no paid fallback');
 const quota=requireQuota(),wait=options.wait??(ms=>new Promise(resolve=>setTimeout(resolve,ms))),random=options.random??Math.random,now=options.now??(()=>new Date());
 let capacityRetries=0,unknownRetries=0;
 const multipart=input instanceof FormData,body=multipart?input:JSON.stringify(input);
 for(let attempt=1;;attempt++){
  const id=await quota.reserve('cloudflare',model,neurons);let response:Response;
  try{response=await request(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(process.env.CLOUDFLARE_ACCOUNT_ID!)}/ai/run/${model}`,{method:'POST',headers:{Authorization:`Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,...(multipart?{}:{'Content-Type':'application/json'})},body,signal:AbortSignal.timeout(120000)});}catch(error){await quota.finish(id,{},true);await log(quota.dir,'cloudflare_attempt',{model,attempt,httpStatus:null,message:sanitize(error)});throw new Error(sanitize(error));}
  if(response.ok){await log(quota.dir,'cloudflare_attempt',{model,attempt,httpStatus:response.status,internalCodes:[]});return {response,id,quota,attempt};}
  const data:unknown=await response.json().catch(()=>null);const parsed=data&&typeof data==='object'?data as Record<string,unknown>:{};
  const errors=Array.isArray(parsed.errors)?parsed.errors.slice(0,10):[];
  const entries=errors.filter((e):e is Record<string,unknown>=>!!e&&typeof e==='object');
  const internalCodes=entries.map(e=>Number(e.code)).filter(Number.isFinite),messages=entries.map(e=>sanitize(e.message));
  if(!messages.length)messages.push(sanitize(response.statusText));
  const classification=response.status===429?internalCodes.includes(3036)?'DAILY_FREE_QUOTA_EXHAUSTED':internalCodes.includes(3040)?'TEMPORARY_OUT_OF_CAPACITY':'UNKNOWN_429':response.status===403&&internalCodes.includes(5035)?'PAID_PLAN_REQUIRED':'HTTP_ERROR';
  const diagnostic={timestamp:now().toISOString(),status:response.status,httpStatus:response.status,internalCodes,internalCode:internalCodes[0]??null,messages,model,attempt,classification,responseHeaders:Object.fromEntries(['retry-after','date','ratelimit-reset'].flatMap(k=>response.headers.has(k)?[[k,sanitize(response.headers.get(k))]]:[]))};
  await json(join(quota.dir,'cloudflare-error.json'),diagnostic);await log(quota.dir,'cloudflare_attempt',diagnostic);
  const usage=parsed.usage&&typeof parsed.usage==='object'?parsed.usage as Record<string,unknown>:{};const measured=usage.neurons;
  if(typeof measured==='number'&&Number.isFinite(measured)&&measured>0){await quota.confirmConsumption(id,measured);await quota.finish(id,{},true);}
  else if(classification==='TEMPORARY_OUT_OF_CAPACITY'||classification==='DAILY_FREE_QUOTA_EXHAUSTED'||classification==='PAID_PLAN_REQUIRED')await quota.release(id,classification);
  else await quota.finish(id,{},true);
  if(classification==='DAILY_FREE_QUOTA_EXHAUSTED'){
   const reset=now();reset.setUTCHours(24,0,0,0);await json(join(quota.dir,'quota-checkpoint.json'),{state:'paused_quota',classification,httpStatus:429,internalCodes,model,resumeAfter:reset.toISOString(),paidFallback:false});await log(quota.dir,'cloudflare_daily_quota_exhausted',diagnostic);throw new QuotaPause(reset.toISOString());
  }
  if(classification==='TEMPORARY_OUT_OF_CAPACITY'||classification==='UNKNOWN_429'){
   const capacity=classification==='TEMPORARY_OUT_OF_CAPACITY',sequence=capacity?[5000,15000,30000,60000,120000]:[10000,30000,60000],retries=capacity?capacityRetries:unknownRetries;
   const retryInMs=retries<sequence.length?cloudflareRetryDelay(sequence[retries],response.headers.get('retry-after'),now().getTime(),random):null;
   await log(quota.dir,capacity?'cloudflare_out_of_capacity':'cloudflare_unknown_429',{...diagnostic,retryInMs});
   // A long Retry-After is checkpointed instead of occupying a CI runner.
   if(retryInMs!==null&&retryInMs<=300000&&attempt<9){if(capacity)capacityRetries++;else unknownRetries++;await log(quota.dir,'cloudflare_retry',{...diagnostic,retryInMs});await wait(retryInMs);continue;}
   const reset=new Date(now().getTime()+Math.max(20*60000,retryInMs??0)),state=capacity?'cloudflare_out_of_capacity':'cloudflare_429_unknown';
   await json(join(quota.dir,'quota-checkpoint.json'),{state,classification,httpStatus:429,internalCodes,model,resumeAfter:reset.toISOString(),automaticResumeAttempt:Number(process.env.CLOUDFLARE_AUTOMATIC_RESUME_ATTEMPT??0),paidFallback:false});throw new CloudflareRetryPause(reset.toISOString(),state);
  }
  throw new Error(`Cloudflare HTTP ${response.status} for ${model}: ${internalCodes.map((code,i)=>`${code} ${messages[i]??''}`).join('; ')||messages.join('; ')}${classification==='PAID_PLAN_REQUIRED'?'; model requires paid plan and is refused under FREE_ONLY':''}`);
 }
}
