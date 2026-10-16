import type {z} from 'zod';
import type {LLMProvider,VisionProvider,StockProvider,StockAsset} from './interfaces';
import {QuotaPause} from '../quota';
import {GeminiSession} from './gemini-reliability';
import {currentCosts} from '../cost';
import {OpenAIProvider} from './openai';
import {GroqProvider} from './groq';
export class GeminiProvider implements LLMProvider,VisionProvider {
 private session:GeminiSession;
 constructor(request:typeof fetch=fetch,wait:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms))){this.session=new GeminiSession(request,wait);}
 async discover(){return this.session.discover();}
 async json<T>(instruction:string,schema:z.ZodType<T>):Promise<T>{return this.complete(instruction,schema);}
 async images<T>(instruction:string,images:{mimeType:string;data:string}[],schema:z.ZodType<T>):Promise<T>{return this.complete(instruction,schema,images);}
 private async complete<T>(instruction:string,schema:z.ZodType<T>,images:{mimeType:string;data:string}[]=[]):Promise<T>{
  return this.session.complete(instruction,schema,images);
 }
}
export function configuredFreeProvider():LLMProvider&VisionProvider{
 const selected=process.env.LLM_PROVIDER??'gemini';
 if(selected==='groq')return new GroqProvider();
 if(selected!=='gemini')throw Error('Unsupported free LLM provider');
 return new GeminiProvider();
}
export class FreeFirstLLM implements LLMProvider,VisionProvider {
 constructor(private free:LLMProvider=configuredFreeProvider(),private premium:LLMProvider=new OpenAIProvider()){}
 async images<T>(instruction:string,images:{mimeType:string;data:string}[],schema:z.ZodType<T>):Promise<T>{if(!('images' in this.free))throw new Error('Free LLM does not support multimodal semantic QA');return (this.free as LLMProvider&VisionProvider).images(instruction,images,schema);}
 async json<T>(instruction:string,schema:z.ZodType<T>):Promise<T>{
  let failure:unknown;try{return await this.free.json(instruction,schema);}catch(e){failure=e;}
  if(failure instanceof QuotaPause||currentCosts()?.policy.freeOnly||!currentCosts()?.policy.paidFallbackEnabled)throw failure;
  if(!process.env.OPENAI_API_KEY)throw new Error(`Free LLM failed; paid fallback unavailable: ${failure instanceof Error?failure.message:'invalid output'}`);
  return this.premium.json(instruction,schema);
 }
}
const plain=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g,' ').trim();
export function commonsLicense(meta:Record<string,{value?:string}>){
 const license=plain(meta.LicenseShortName?.value??'');const usage=plain(meta.UsageTerms?.value??'');const url=meta.LicenseUrl?.value??'';
 if(/non.?commercial|no.?derivatives|\bNC\b|\bND\b|fair use/i.test(license+' '+usage))return null;
 const publicDomain=/^(public domain|cc0|pdm)/i.test(license);
 if(!publicDomain&&!/^CC BY(?:-SA)? (?:[1-4]\.0)$/i.test(license))return null;
 if(!publicDomain&&!/^https?:\/\/creativecommons\.org\/licenses\/by(?:-sa)?\/[1-4]\.0\//.test(url))return null;
 const creator=plain(meta.Artist?.value??'');if(!creator&&!publicDomain)return null;
 return {license,licenseUrl:url||'https://creativecommons.org/publicdomain/mark/1.0/',creator:creator||'Unknown creator (public domain)',publicDomain,attribution:plain(meta.Attribution?.value??'')||creator||'Public domain; original creator unknown'};
}
export class WikimediaCommonsProvider implements StockProvider {
 constructor(private request:typeof fetch=fetch){}
 async search(query:string,kind:'image'|'video',minDuration:number):Promise<StockAsset|null>{
  if(kind!=='image'||minDuration<0)return null;const url=new URL('https://commons.wikimedia.org/w/api.php');const params={action:'query',format:'json',generator:'search',gsrsearch:query,gsrnamespace:'6',gsrlimit:'8',prop:'imageinfo',iiprop:'url|extmetadata|size',iiurlwidth:'1920'};for(const [k,v]of Object.entries(params))url.searchParams.set(k,v);
  const res=await this.request(url,{headers:{'User-Agent':'youtube-autopilot/0.1 (licensed editorial media; https://github.com/gaboplayt24-art/youtube-autopilot)'},signal:AbortSignal.timeout(25000)});if(!res.ok)throw new Error(`Wikimedia HTTP ${res.status}`);const body=await res.json();if(body.error)throw new Error(`Wikimedia API ${body.error.code}`);
  const pages=Object.values(body.query?.pages??{}).sort((a:any,b:any)=>(a.index??0)-(b.index??0)) as any[];
  for(const page of pages){const info=page.imageinfo?.[0];if(!info||!/^https:\/\/upload\.wikimedia\.org\//.test(info.thumburl||info.url)||info.width<800||info.height<500||/\.svg(?:$|\?)/i.test(info.url))continue;const rights=commonsLicense(info.extmetadata??{});if(!rights)continue;return {url:info.thumburl||info.url,kind:'image',sourceUrl:info.descriptionurl,...rights};}return null;
 }
}
