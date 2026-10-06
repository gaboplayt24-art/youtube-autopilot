import {mkdir} from 'node:fs/promises';
import {listGeminiModels} from '../src/providers/diagnostics';
import {json} from '../src/orchestration/io';
async function main(){const dir='data/diagnostics';await mkdir(dir,{recursive:true});try{const report=await listGeminiModels();await json(dir+'/gemini-models.json',report);console.log(JSON.stringify({event:'gemini_models_listed',requestedModel:report.requestedModel,models:report.generateContentModels,metadataOnly:true}));}catch(e){await json(dir+'/gemini-models.json',{state:'failed',error:e instanceof Error?e.message:'unknown',metadataOnly:true,paidProviderCostUsd:0});throw e;}}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
