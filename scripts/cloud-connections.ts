/** Read-only connection diagnosis. No media upload, post mutation, schema or billing changes. */
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {appendFile} from 'node:fs/promises';
import {z} from 'zod';
import {json} from '../src/orchestration/io';
const service=z.enum(['all','supabase','zernio']);
export async function inspectCloudConnections(env:NodeJS.ProcessEnv=process.env,request:typeof fetch=fetch){
 const selected=service.parse(env.CONNECTION_SERVICE??'all'),live=env.VERIFY_LIVE==='true';
 const results:{service:string;credentialsPresent:boolean;status:string;httpStatus?:number;connectedChannels?:number;platforms?:string[]}[]=[];
 if(selected!=='zernio'){
  const present=Boolean(env.SUPABASE_URL&&env.SUPABASE_SERVICE_ROLE_KEY),row={service:'supabase',credentialsPresent:present,status:present?'configured-not-tested':'missing-configuration'};results.push(row);
  if(present&&live){
   let url:URL;try{url=new URL(env.SUPABASE_URL!);}catch{row.status='invalid-url';return {mode:'read-only',live,ready:false,publishingReady:false,results};}
   if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password){row.status='invalid-official-project-url';}
   else try{
    const endpoint=new URL('/rest/v1/pipeline_artifacts?select=key&limit=1',url);
    const response=await request(endpoint,{redirect:'error',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY!,Authorization:'Bearer '+env.SUPABASE_SERVICE_ROLE_KEY!},signal:AbortSignal.timeout(20000)});
    Object.assign(row,{httpStatus:response.status});row.status=response.ok&&Array.isArray(await response.json().catch(()=>null))?'database-readable':'database-check-failed';
   }catch{row.status='network-or-timeout';}
  }
 }
 if(selected!=='supabase'){
  const present=Boolean(env.ZERNIO_API_KEY),row={service:'zernio',credentialsPresent:present,status:present?'configured-not-tested':'missing-configuration'};results.push(row);
  if(present&&live)try{
   const response=await request('https://zernio.com/api/v1/accounts',{redirect:'error',headers:{Authorization:'Bearer '+env.ZERNIO_API_KEY!},signal:AbortSignal.timeout(20000)});
   Object.assign(row,{httpStatus:response.status});
   if(!response.ok)throw Error('Account check failed');
   const accounts=z.object({accounts:z.array(z.object({platform:z.string(),isActive:z.boolean().optional()}))}).parse(await response.json()).accounts;
   const platforms=accounts.filter(a=>a.isActive!==false).map(a=>a.platform);
   Object.assign(row,{connectedChannels:platforms.length,platforms:[...new Set(platforms)]});row.status=platforms.length?'channels-readable':'authenticated-no-channels';
  }catch{row.status='account-or-channel-check-failed';}
 }
 return {mode:'read-only',live,publishingReady:false,ready:live&&results.every(r=>['database-readable','channels-readable'].includes(r.status)),results};
}
async function main(){
 const report=await inspectCloudConnections();await json('.cache/cloud-connections.json',report);console.log(JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Conexiones: diagnóstico de solo lectura\n\n'+report.results.map(r=>'- '+r.service+': **'+r.status+'**; configuración presente: '+r.credentialsPresent).join('\n')+'\n\nNo se publicaron contenidos ni se cambiaron cuentas, facturación o tablas. Un reporte generado no equivale a integración lista.\n');
 if(report.live&&!report.ready)process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(()=>{console.error('Connection diagnosis failed; inspect configuration. No secret values logged.');process.exitCode=1;});
