// Owner-requested 2026-10-28 isolated audition of free Chinese models on ModelScope API-Inference, the same way
// SmolVLM was auditioned: nothing here touches production, QA, narrator or style. Three questions, one record:
//  1. generation  — Qwen-Image-Edit with our approved Eli sheet as reference vs the actual Klein outputs;
//  2. layers      — Qwen-Image-Layered RGBA decomposition of accepted Klein art vs our rembg cut-outs;
//  3. reviewer    — a Qwen vision model with a stricter rubric on 4 accepted and 2 Gemini-rejected images.
// Raw responses, refusals and timings are kept; a refused model is a result, never retried with another account.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {exec} from '../src/orchestration/io';

// REVIEWER_ONLY=groq runs just the stricter reviewer on Groq's free Qwen vision model (already used by production).
const groq=process.env.REVIEWER_ONLY==='groq',key=groq?process.env.GROQ_API_KEY:process.env.MODELSCOPE_API_KEY;if(!key)throw Error((groq?'GROQ_API_KEY':'MODELSCOPE_API_KEY')+' secret is required for this audition');
const base=groq?'https://api.groq.com/openai/v1':process.env.MODELSCOPE_BASE_URL||'https://api-inference.modelscope.cn/v1';
const models={edit:process.env.QWEN_EDIT_MODEL||'Qwen/Qwen-Image-Edit-2509',layered:process.env.QWEN_LAYERED_MODEL||'Qwen/Qwen-Image-Layered',vision:groq?'qwen/qwen3.8-27b':process.env.QWEN_VISION_MODEL||'Qwen/Qwen3-VL-235B-A22B-Instruct'};
const raw='https://raw.githubusercontent.com/gaboplayt24-art/youtube-autopilot/'+(process.env.GITHUB_SHA??'main')+'/';
const dir='assets/auditions/qwen-v1',out='data/research/qwen-audition';await mkdir(out,{recursive:true});
const inputs=z.object({items:z.array(z.object({id:z.string(),role:z.enum(['accepted','rejected']),prompt:z.string(),image:z.string(),geminiIssues:z.array(z.string()).optional()}))}).parse(JSON.parse(await readFile(join(dir,'inputs.json'),'utf8'))).items;
const results:Record<string,unknown>={startedAt:new Date().toISOString(),models,generation:[],layers:[],reviewer:[]};
const save=()=>writeFile(join(out,'results.json'),JSON.stringify(results,null,1));
const headers={Authorization:'Bearer '+key,'Content-Type':'application/json'};
const clean=(t:string)=>t.replaceAll(key,'[redacted]').slice(0,6000);

async function imageTask(model:string,body:Record<string,unknown>){
 const t0=Date.now(),submit=await fetch(base+'/images/generations',{method:'POST',headers:{...headers,'X-ModelScope-Async-Mode':'true'},body:JSON.stringify({model,...body}),signal:AbortSignal.timeout(60000)});
 const first=clean(await submit.text());if(!submit.ok)return {ok:false,status:submit.status,response:first,seconds:(Date.now()-t0)/1000};
 const task=(JSON.parse(first) as {task_id?:string}).task_id;if(!task)return {ok:false,status:submit.status,response:first,seconds:(Date.now()-t0)/1000};
 for(let i=0;i<90;i++){await new Promise(r=>setTimeout(r,8000));
  const poll=await fetch(base+'/tasks/'+task,{headers:{...headers,'X-ModelScope-Task-Type':'image_generation'},signal:AbortSignal.timeout(30000)}).catch(e=>({ok:false,status:0,text:async()=>String(e)}) as unknown as Response);
  const text=clean(await poll.text());let data:{task_status?:string;output_images?:string[]}={};try{data=JSON.parse(text);}catch{/* recorded below */}
  if(data.task_status==='SUCCEED')return {ok:true,task,images:data.output_images??[],seconds:(Date.now()-t0)/1000};
  if(data.task_status==='FAILED'||!poll.ok&&poll.status!==0)return {ok:false,task,status:poll.status,response:text,seconds:(Date.now()-t0)/1000};
 }
 return {ok:false,task,response:'timed out after 12 minutes of polling',seconds:(Date.now()-t0)/1000};
}
async function download(url:string,path:string){const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('download '+r.status);await writeFile(path,Buffer.from(await r.arrayBuffer()));return path;}

// 1. Generation with the approved Eli sheet as the reference image.
for(const item of groq?[]:inputs.filter(i=>i.role==='accepted')){
 const r=await imageTask(models.edit,{prompt:item.prompt.replaceAll('input_image_0','the reference image'),image_url:[raw+'assets/references/style-v5-eli.png']}).catch(e=>({ok:false,response:clean(String(e))}));
 const files=[];if(r.ok&&'images' in r)for(const [k,url] of r.images.entries())files.push(await download(url,join(out,`qwen-${item.id}-${k}.png`)).catch(e=>'failed: '+e));
 (results.generation as unknown[]).push({id:item.id,...r,files});await save();
}
// 2. Layer decomposition of the actual accepted Klein art.
for(const item of groq?[]:inputs.filter(i=>i.role==='accepted').slice(0,2)){
 const r=await imageTask(models.layered,{prompt:'Decompose this illustration into separate RGBA layers: background, each character, each foreground object.',image_url:[raw+item.image],n:4}).catch(e=>({ok:false,response:clean(String(e))}));
 const files=[];if(r.ok&&'images' in r)for(const [k,url] of r.images.entries())files.push(await download(url,join(out,`layers-${item.id}-${k}.png`)).catch(e=>'failed: '+e));
 (results.layers as unknown[]).push({id:item.id,...r,files});await save();
}
// 3. Stricter reviewer: concrete defects first, scores only after, and no 100s without justification.
const rubric=`You are a strict art director for an illustrated Bible-history channel (ancient Near East setting; recurring character Eli: round white head, dot eyes, short dark beard, striped ochre head cloth, sand tunic, terracotta sash). Review the image against its prompt. First list EVERY concrete defect you can see, each as {category, detail}: categories anatomy (wrong limb/finger count, merged bodies, broken joints), historical (modern clothing, glass, plastic, zippers, collars, jeans, modern tools), concept (something the prompt requires is missing or wrong), style (photoreal, 3D, anime, chibi, inconsistent Eli), text (letters or numbers drawn), composition (cropped heads, clutter). Then give scores 0-10 for anatomy, historical, concept, style, composition. A 10 is only for flawless work; typical good work is 7-8. verdict "reject" if any anatomy, historical or concept defect exists. Return JSON only: {"defects":[...],"scores":{...},"verdict":"accept"|"reject","reason":"..."}`;
for(const item of inputs){
 const t0=Date.now(),b64=(await readFile(item.image)).toString('base64');
 // Groq's free tier allows about 7000 input tokens a minute: space the calls and honour its retry hint.
 let r={status:0,text:''};for(let attempt=0;attempt<4;attempt++){if(groq&&(attempt||inputs.indexOf(item)))await new Promise(x=>setTimeout(x,attempt?(Number(r.text.match(/try again in ([\d.]+)s/)?.[1]??20)+3)*1000:25000));
 r=await fetch(base+'/chat/completions',{method:'POST',headers,signal:AbortSignal.timeout(180000),body:JSON.stringify({model:models.vision,temperature:0,...(groq?{reasoning_format:'hidden'}:{}),messages:[{role:'user',content:[{type:'text',text:rubric+'\n\nPrompt: '+item.prompt}, {type:'image_url',image_url:{url:'data:image/jpeg;base64,'+b64}}]}]})}).then(async x=>({status:x.status,text:clean(await x.text())})).catch(e=>({status:0,text:clean(String(e))}));if(r.status!==429)break;}
 let verdict:unknown=null;try{const content=(JSON.parse(r.text) as {choices:{message:{content:string}}[]}).choices[0].message.content;verdict=JSON.parse(content.slice(content.indexOf('{'),content.lastIndexOf('}')+1));}catch{/* raw kept */}
 (results.reviewer as unknown[]).push({id:item.id,expected:item.role,geminiIssues:item.geminiIssues??[],status:r.status,verdict,raw:verdict?undefined:r.text,seconds:(Date.now()-t0)/1000});await save();
}
// Side-by-side sheet: Klein (current) left, Qwen right, one row per prompt.
const rows=[];for(const g of results.generation as {id:string;files:string[]}[]){const q=g.files.find(f=>!f.startsWith('failed'));const row=join(out,`row-${g.id}.jpg`);
 const args=q?['-i',join(dir,`klein-${g.id}.jpg`),'-i',q,'-filter_complex','[0]scale=960:540,setsar=1[a];[1]scale=960:540:force_original_aspect_ratio=decrease,pad=960:540:(ow-iw)/2:(oh-ih)/2,setsar=1[b];[a][b]hstack']:['-i',join(dir,`klein-${g.id}.jpg`),'-f','lavfi','-i','color=c=gray:s=960x540','-filter_complex','[0]scale=960:540,setsar=1[a];[a][1]hstack'];
 await exec('ffmpeg',['-y','-v','error',...args,'-frames:v','1',row]);rows.push(row);}
if(rows.length)await exec('ffmpeg',['-y','-v','error',...rows.flatMap(r=>['-i',r]),'-filter_complex',rows.map((_,i)=>`[${i}]`).join('')+`vstack=inputs=${rows.length}`,'-frames:v','1','-q:v','3',join(out,'QWEN-AUDITION-SHEET.jpg')]);
results.finishedAt=new Date().toISOString();await save();
const rev=results.reviewer as {id:string;expected:string;verdict:{verdict?:string}|null}[];
console.log(JSON.stringify({generated:(results.generation as {ok:boolean}[]).filter(g=>g.ok).length,layered:(results.layers as {ok:boolean}[]).filter(g=>g.ok).length,reviewerAgreesWithKnown:rev.filter(r=>r.verdict?.verdict===(r.expected==='accepted'?'accept':'reject')).length+'/'+rev.length}));
