import {AsyncLocalStorage} from 'node:async_hooks';
import {join} from 'node:path';
import {z} from 'zod';
import {json,read} from '../orchestration/io';
export const costPolicy=z.object({mode:z.literal('free_first'),preferFree:z.boolean(),allowPaidFallback:z.boolean(),maxCostPerVideoUsd:z.number().nonnegative(),requireApprovalAboveUsd:z.number().nonnegative(),qualityFloor:z.number().min(0).max(100),maxGeneratedImagesPerVideo:z.number().int().nonnegative(),aiVideoEnabled:z.boolean(),rates:z.object({llmInputPerMillion:z.number().nonnegative(),llmOutputPerMillion:z.number().nonnegative(),ttsPerThousandCharacters:z.number().nonnegative(),transcriptionPerMinute:z.number().nonnegative(),generatedImage:z.number().nonnegative(),aiVideoPerSecond:z.number().nonnegative(),musicPerMinute:z.number().nonnegative(),sfxPerEvent:z.number().nonnegative()}),pricingNote:z.string()});
export type CostPolicy=z.infer<typeof costPolicy>;
export async function loadCostPolicy(){const raw=await read('config/cost-policy.json');return costPolicy.parse({...raw,...(process.env.QUALITY_FLOOR?{qualityFloor:Number(process.env.QUALITY_FLOOR)}:{}),...(process.env.MAX_GENERATED_IMAGES_PER_VIDEO?{maxGeneratedImagesPerVideo:Number(process.env.MAX_GENERATED_IMAGES_PER_VIDEO)}:{}),...(process.env.AI_VIDEO_ENABLED?{aiVideoEnabled:process.env.AI_VIDEO_ENABLED==='true'}:{})});}
export type CostCategory='githubCompute'|'llm'|'tts'|'transcription'|'stock'|'generatedImages'|'aiVideo'|'music'|'sfx'|'storage';
export const categoryList:CostCategory[]=['githubCompute','llm','tts','transcription','stock','generatedImages','aiVideo','music','sfx','storage'];
export function estimateCosts(minutes:number,policy:CostPolicy,strategy:'FREE-FIRST'|'HYBRID'|'PREMIUM'='FREE-FIRST'){
 if(!Number.isFinite(minutes)||minutes<=0)throw new Error('Invalid duration');
 const r=policy.rates;const chars=minutes*140*6;const images=strategy==='FREE-FIRST'?0:strategy==='HYBRID'?Math.min(8,policy.maxGeneratedImagesPerVideo):Math.ceil(minutes*3);
 const usd:Record<CostCategory,number>={githubCompute:0,llm:strategy==='FREE-FIRST'?0:(minutes*140*2*r.llmInputPerMillion+minutes*140*2*r.llmOutputPerMillion)/1e6,tts:strategy==='FREE-FIRST'?0:chars/1000*r.ttsPerThousandCharacters,transcription:strategy==='FREE-FIRST'?0:minutes*r.transcriptionPerMinute,stock:0,generatedImages:images*r.generatedImage,aiVideo:strategy==='PREMIUM'?Math.min(30,minutes)*r.aiVideoPerSecond:0,music:strategy==='PREMIUM'?minutes*r.musicPerMinute:0,sfx:strategy==='PREMIUM'?Math.ceil(minutes/2)*r.sfxPerEvent:0,storage:0};
 const categories=categoryList.map(category=>({category,classification:(usd[category]>0?'PAID':['githubCompute','storage'].includes(category)?'INCLUDED':'FREE') as 'FREE'|'INCLUDED'|'PAID',estimatedUsd:Number(usd[category].toFixed(4))}));const estimated=categories.reduce((n,c)=>n+c.estimatedUsd,0);
 return {minutes,strategy,words:Math.round(minutes*140),generatedImages:images,categories,estimatedUsd:Number(estimated.toFixed(4)),withinBudget:estimated<=Math.min(policy.maxCostPerVideoUsd,policy.requireApprovalAboveUsd),qualityFloor:policy.qualityFloor,assumptions:policy.pricingNote+' FREE-FIRST assumes Gemini free-tier eligibility, local Kokoro/ASR, licensed stock, approved local music, no paid fallback. Quality is unverified until QA.'};
}
type Entry={id:string;category:CostCategory;provider:string;classification:'FREE'|'PAID';reservedUsd:number;state:'reserved'|'completed'|'failed';actualUsd:number|null;description:string};
const scope=new AsyncLocalStorage<CostLedger>();
export class CostLedger {
 private persistence=Promise.resolve();
 entries:Entry[]=[];targetSeconds:number|null=null;voiceSeconds=0;
 constructor(public policy:CostPolicy,public dir:string){}
 async restore(){try{const data=await read(join(this.dir,'cost-ledger.json'));this.targetSeconds=data.targetSeconds??null;this.voiceSeconds=data.voiceSeconds??0;this.entries=z.array(z.object({id:z.string(),category:z.enum(categoryList as [CostCategory,...CostCategory[]]),provider:z.string(),classification:z.enum(['FREE','PAID']),reservedUsd:z.number().nonnegative(),state:z.enum(['reserved','completed','failed']),actualUsd:z.number().nonnegative().nullable(),description:z.string()})).parse(data.entries);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 private serialize(fn:()=>Promise<void>){const next=this.persistence.catch(()=>{}).then(fn);this.persistence=next;return next;}
 private save(){return this.serialize(async()=>{await json(join(this.dir,'cost-ledger.json'),{entries:this.entries,targetSeconds:this.targetSeconds,voiceSeconds:this.voiceSeconds});await this.writeReport();});}
 async charge<T>(category:CostCategory,provider:string,upperBoundUsd:number,description:string,call:()=>Promise<T>):Promise<T>{
  if(!Number.isFinite(upperBoundUsd)||upperBoundUsd<0)throw new Error('Unknown paid cost; refusing API call');
  const projected=this.entries.reduce((n,e)=>n+e.reservedUsd,0)+upperBoundUsd;const limit=Math.min(this.policy.maxCostPerVideoUsd,this.policy.requireApprovalAboveUsd);
  if(upperBoundUsd>0&&(!this.policy.allowPaidFallback||projected>limit)){await json(join(this.dir,'cost-blocked.json'),{category,provider,projectedCostUsd:projected,limitUsd:limit,reason:'Hard budget/approval threshold; call was NOT made',at:new Date().toISOString()});throw new Error(`Cost guard blocked ${provider}: projected $${projected.toFixed(3)} > allowed $${limit.toFixed(2)}`);}
  const entry:Entry={id:crypto.randomUUID(),category,provider,classification:upperBoundUsd?'PAID':'FREE',reservedUsd:upperBoundUsd,state:'reserved',actualUsd:null,description};this.entries.push(entry);await this.save();
  try{const result=await call();entry.state='completed';await this.save();return result;}catch(e){entry.state='failed';await this.save();throw e;}
 }
 async setDuration(seconds:number){this.targetSeconds=seconds;await this.save();}
 report(){return this.serialize(()=>this.writeReport());}
 private async writeReport(){const estimated=this.entries.reduce((n,e)=>n+e.reservedUsd,0);const freeAssets=this.entries.filter(e=>e.category==='stock'&&e.state==='completed').length;const paidAssets=this.entries.filter(e=>['generatedImages','aiVideo'].includes(e.category)&&e.state==='completed').length;await json(join(this.dir,'cost-report.json'),{estimated,actual:this.entries.some(e=>e.classification==='PAID')?null:0,actualNote:'Vendor invoice unavailable; reservations are conservative upper bounds, including failed/uncertain calls. Cached stages make no new calls.',savedVsPremiumStrategy:this.targetSeconds===null?null:Math.max(0,estimateCosts(this.targetSeconds/60,this.policy,'PREMIUM').estimatedUsd-estimated),savingsBasis:'Estimated premium strategy minus reserved spend; not invoice savings',freeAssets,paidAssets,categories:categoryList.map(category=>({category,reservedUsd:this.entries.filter(e=>e.category===category).reduce((n,e)=>n+e.reservedUsd,0)})),entries:this.entries});}
}
export function withCosts<T>(ledger:CostLedger,fn:()=>Promise<T>){return scope.run(ledger,fn);}
export function currentCosts(){return scope.getStore();}
export async function paidCall<T>(category:CostCategory,provider:string,usd:number,description:string,fn:()=>Promise<T>){const ledger=scope.getStore();if(!ledger)throw new Error('Paid provider requires an active cost ledger');return ledger.charge(category,provider,usd,description,fn);}
