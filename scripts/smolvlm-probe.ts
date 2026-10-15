/** Owner-authorized isolated CPU test. Never imported by the production pipeline. */
import {readFile,mkdir,copyFile} from 'node:fs/promises';
import {resolve,join,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import {cpus,totalmem} from 'node:os';
import {z} from 'zod';
import {fileDigest} from '../src/orchestration/integrity';
import {json} from '../src/orchestration/io';
export function parseProbeAnswer(text:string,kind:'count'|'boolean'):number|boolean|null{
 const s=text.trim();
 if(kind==='boolean'){const m=s.match(/^(yes|no)\b/i);return m?m[1].toLowerCase()==='yes':null;}
 const m=s.match(/^(\d{1,2}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?:\s+(pairs?)\b)?/i);
 if(!m||m[2])return null;
 const words=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
 return /^\d+$/.test(m[1])?Number(m[1]):words.indexOf(m[1].toLowerCase());
}
export function probeOutcome(actual:number|boolean|null,expected:number|boolean){return actual===null?'abstained':typeof actual===typeof expected&&actual===expected?'correct':'incorrect';}
const casesSchema=z.object({runId:z.literal('bible-angels-001'),sourceExecution:z.literal('38693770543'),reference:z.object({path:z.string(),sha256:z.string().length(64)}),curation:z.string(),cases:z.array(z.object({id:z.string().regex(/^[a-z0-9-]+$/),path:z.string(),sha256:z.string().length(64),prompt:z.string(),answerType:z.enum(['count','boolean']),expected:z.union([z.number().int(),z.boolean()]),groundTruthNote:z.string(),useReference:z.boolean()})).length(8)});
async function main(){
 const output=process.env.SMOLVLM_OUTPUT_DIR??'.cache/smolvlm-probe/evidence',modelDir=resolve(process.env.SMOLVLM_MODEL_DIR??'.cache/smolvlm-probe/model');await mkdir(output,{recursive:true});
 const cases=casesSchema.parse(JSON.parse(await readFile('data/research/bible-angels-001/smolvlm-probe-cases.json','utf8'))),manifest=JSON.parse(await readFile(join(modelDir,'download-manifest.json'),'utf8'));
 if(manifest.model!=='HuggingFaceTB/SmolVLM2-500M-Video-Instruct'||manifest.revision!=='7b375e1b73b11138ff12fe22c8f2822d8fe03467'||manifest.license!=='Apache-2.0')throw Error('Model identity mismatch');
 if(await fileDigest(cases.reference.path)!==cases.reference.sha256)throw Error('Reference bytes changed');
 for(const c of cases.cases)if(await fileDigest(c.path)!==c.sha256)throw Error('Diagnostic source bytes changed: '+c.id);
 await json(join(output,'cases-with-expectations.json'),cases);await copyFile(join(modelDir,'download-manifest.json'),join(output,'model-download-manifest.json'));
 const results:({outcome:string;elapsedSeconds:number}&Record<string,unknown>)[]=[];const started=Date.now();let loadSeconds:number|null=null,failure:string|null=null;
 async function report(){await json(join(output,'report.json'),{model:manifest.model,revision:manifest.revision,license:manifest.license,runtime:'transformers.js 3.8.1 / ONNX Runtime CPU',device:'cpu',weights:{embed_tokens:'q4',decoder_model_merged:'q4',vision_encoder:'fp32'},threads:2,imageLongestEdge:512,imageSplitting:false,processorCompatibility:'Existing transformers.js Idefics3 processor; SmolVLM shares this implementation. Official image/processor config and tokenizer are pinned, with splitting disabled for bounded CPU work.',expectedLabelsGivenToModel:false,inferenceApiCalls:0,paidApiCostUsd:0,newImagesGenerated:0,productionAcceptanceModified:false,promotedToProduction:false,smallDiagnosticSampleOnly:true,execution:process.env.GITHUB_RUN_ID??'local',commit:process.env.GITHUB_SHA??null,sourceExecution:cases.sourceExecution,host:{cpus:cpus().length,memoryBytes:totalmem()},loadSeconds,elapsedSeconds:(Date.now()-started)/1000,peakRssMiB:process.resourceUsage().maxRSS/1024,failure,counts:Object.fromEntries(['correct','incorrect','abstained'].map(k=>[k,results.filter(r=>r.outcome===k).length])),inferenceSeconds:results.reduce((n,r)=>n+r.elapsedSeconds,0),completedCases:results.length,totalCases:cases.cases.length,results});}
 let model:any;
 try{
  await report();
  const {AutoTokenizer,Idefics3Processor,Idefics3ImageProcessor,AutoModelForVision2Seq,RawImage,env}=await import('@huggingface/transformers');
  env.allowRemoteModels=false;env.allowLocalModels=true;
  const pre=JSON.parse(await readFile(join(modelDir,'preprocessor_config.json'),'utf8')),cfg=JSON.parse(await readFile(join(modelDir,'processor_config.json'),'utf8'));
  const tokenizer=await AutoTokenizer.from_pretrained(modelDir,{local_files_only:true});
  const processor=new Idefics3Processor(cfg,{tokenizer,image_processor:new Idefics3ImageProcessor({...pre,size:{longest_edge:512},do_image_splitting:false})},tokenizer.chat_template as string);
  model=await AutoModelForVision2Seq.from_pretrained(modelDir,{local_files_only:true,device:'cpu',dtype:{embed_tokens:'q4',vision_encoder:'fp32',decoder_model_merged:'q4'},session_options:{intraOpNumThreads:2,interOpNumThreads:1}});
  loadSeconds=(Date.now()-started)/1000;await report();
  for(const c of cases.cases){
   const begin=Date.now(),images=await Promise.all((c.useReference?[cases.reference.path,c.path]:[c.path]).map(p=>RawImage.read(p)));
   // Only the image(s) and neutral question reach inference. No expected label or ground-truth note.
   const text=processor.apply_chat_template([{role:'user',content:[...images.map(()=>({type:'image'})),{type:'text',text:c.prompt}]}] as any,{add_generation_prompt:true});
   const inputs=await processor(text,images,{do_image_splitting:false});
   const generated=await model.generate({...inputs,max_new_tokens:80,do_sample:false});
   const ids=generated.slice(null,[inputs.input_ids.dims.at(-1),null]),raw=processor.batch_decode(ids,{skip_special_tokens:true})[0];
   const answer=parseProbeAnswer(raw,c.answerType),row={id:c.id,sourceSha256:c.sha256,referenceSha256:c.useReference?cases.reference.sha256:null,prompt:c.prompt,rawResponse:raw,parsedAnswer:answer,expected:c.expected,groundTruthNote:c.groundTruthNote,outcome:probeOutcome(answer,c.expected),elapsedSeconds:(Date.now()-begin)/1000,generatedTokens:ids.dims.at(-1),peakRssMiB:process.resourceUsage().maxRSS/1024,pixelTensorShape:inputs.pixel_values.dims};
   results.push(row);await json(join(output,c.id+'.json'),row);await copyFile(c.path,join(output,c.id+ '-' +basename(c.path)));await report();console.log(JSON.stringify({event:'smolvlm_case_completed',id:c.id,outcome:row.outcome,seconds:row.elapsedSeconds}));
  }
  await copyFile(cases.reference.path,join(output,'approved-reference.png'));
 }catch(e){failure=String(e);throw e;}finally{try{if(model)await model.dispose();}finally{await report();}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(String(e));process.exitCode=1;});
