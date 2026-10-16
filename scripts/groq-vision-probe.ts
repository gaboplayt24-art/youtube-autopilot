/** Isolated audition only: never imported by production QA or image generation. */
import {readFile,mkdir,copyFile,appendFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {z} from 'zod';
import {casesSchema,parseProbeAnswer,probeOutcome} from './smolvlm-probe';
import {fileDigest} from '../src/orchestration/integrity';
import {json} from '../src/orchestration/io';
export const GROQ_PROBE_MODEL='qwen/qwen3.8-27b';
export async function groqVisualAnswer(key:string,freePlanConfirmed:boolean,prompt:string,images:Buffer[],request:typeof fetch=fetch){
 if(!key||!freePlanConfirmed)throw Error('GitHub Secret and confirmed Groq Free plan required');
 if(images.length<1||images.length>2||images.some(b=>b.length>6000000))throw Error('Bounded PNG inputs required');
 const response=await request('https://api.groq.com/openai/v1/chat/completions',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},signal:AbortSignal.timeout(90000),body:JSON.stringify({model:GROQ_PROBE_MODEL,messages:[{role:'user',content:[...images.map(b=>({type:'image_url',image_url:{url:'data:image/png;base64,'+b.toString('base64')}})),{type:'text',text:prompt}]}],temperature:0,max_completion_tokens:256,stream:false})});
 if(!response.ok)throw Error('Groq HTTP '+response.status+'; stopped without retries or paid fallback');
 const raw=z.object({id:z.string(),model:z.string(),choices:z.array(z.object({message:z.object({content:z.string()}),finish_reason:z.string().nullable().optional()})).min(1),usage:z.object({prompt_tokens:z.number(),completion_tokens:z.number(),total_tokens:z.number()}).passthrough().optional()}).passthrough().parse(await response.json());
 return {raw,text:raw.choices[0].finish_reason==='length'?'':raw.choices[0].message.content};
}
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.FREE_ONLY!=='true'||process.env.MAX_PAID_COST_USD!=='0'||process.env.GROQ_FREE_PLAN_CONFIRMED!=='true')throw Error('Explicit free-only Actions audition required');
 const key=process.env.GROQ_API_KEY??'';if(!key)throw Error('GROQ_API_KEY missing in GitHub Actions');
 const output='.cache/groq-vision-probe';await mkdir(output,{recursive:true});
 const cases=casesSchema.parse(JSON.parse(await readFile('data/research/bible-angels-001/smolvlm-probe-cases.json','utf8')));
 if(await fileDigest(cases.reference.path)!==cases.reference.sha256)throw Error('Reference bytes changed');
 for(const c of cases.cases){if(await fileDigest(c.path)!==c.sha256)throw Error('Source hash mismatch');await copyFile(c.path,join(output,c.id+'.png'));}
 await json(join(output,'cases-with-expectations.json'),cases);
 await copyFile(cases.reference.path,join(output,'reference.png'));
 const results:Record<string,unknown>[]=[];let calls=0,failure:string|null=null;
 const report=()=>json(join(output,'report.json'),{requestedModel:GROQ_PROBE_MODEL,execution:process.env.GITHUB_RUN_ID,commit:process.env.GITHUB_SHA,sourceExecution:cases.sourceExecution,apiCalls:calls,completedCases:results.length,totalCases:8,expectedLabelsGivenToModel:false,paidApiCostUsd:0,costBasis:'Owner-confirmed Groq Free account; not a vendor invoice',promotedToProduction:false,productionAcceptanceModified:false,smallDiagnosticSampleOnly:true,failure,counts:Object.fromEntries(['correct','incorrect','abstained'].map(k=>[k,results.filter(r=>r.outcome===k).length])),results});
 try{
  await report();
  for(const [i,c] of cases.cases.entries()){
   // At most two images/request. 35 s spacing keeps image token traffic bounded.
   if(i)await new Promise(r=>setTimeout(r,35000));
   const started=Date.now(),images=await Promise.all((c.useReference?[cases.reference.path,c.path]:[c.path]).map(p=>readFile(p)));
   calls++;const answer=await groqVisualAnswer(key,true,c.prompt,images);
   await json(join(output,c.id+'-raw.json'),answer.raw);
   const parsed=parseProbeAnswer(answer.text,c.answerType),row={id:c.id,prompt:c.prompt,sourceSha256:c.sha256,referenceSha256:c.useReference?cases.reference.sha256:null,parsedAnswer:parsed,expected:c.expected,outcome:probeOutcome(parsed,c.expected),elapsedSeconds:(Date.now()-started)/1000,modelReturned:answer.raw.model};
   results.push(row);await report();
   console.log(JSON.stringify({event:'groq_probe_case',id:c.id,outcome:row.outcome}));
  }
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'\nEight-case Groq audition completed. See raw evidence; this is not production approval or evidence of equivalent accuracy to Gemini.\n');
 }catch(error){failure=error instanceof Error?error.message.replaceAll(key,'[redacted]'):'Audition failed';throw Error(failure);}finally{await report();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(error instanceof Error?error.message:'Groq audition failed');process.exitCode=1;});
