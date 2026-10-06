import {writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {env,pipeline,StyleTextToSpeech2Model,AutoTokenizer} from '@huggingface/transformers';
import {KokoroTTS} from 'kokoro-js';
env.cacheDir=resolve(process.env.MODEL_CACHE_DIR||'.cache/models');
env.backends.onnx.wasm.numThreads=2;
function chunks(text){const sentences=text.match(/[^.!?]+[.!?]*/g)||[text];const result=[];for(const sentence of sentences){let part='';for(const word of sentence.trim().split(/\s+/)){if(part.length+word.length>320){result.push(part);part='';}part+=(part?' ':'')+word;}if(part)result.push(part);}return result;}
async function transcribe(path,model='Xenova/whisper-tiny.en'){if(!['Xenova/whisper-tiny.en','Xenova/whisper-base.en'].includes(model))throw new Error('Unsupported local ASR model');const {stdout}=await promisify(execFile)('ffmpeg',['-v','error','-i',path,'-ar','16000','-ac','1','-f','f32le','pipe:1'],{encoding:'buffer',timeout:60000,maxBuffer:128*1024*1024});const audio=new Float32Array(stdout.buffer.slice(stdout.byteOffset,stdout.byteOffset+stdout.byteLength));const asr=await pipeline('automatic-speech-recognition',model,{dtype:'q8',device:'cpu',session_options:{intra_op_num_threads:2,inter_op_num_threads:1}});try{return {...await asr(audio,{return_timestamps:'word',chunk_length_s:25,stride_length_s:5}),model};}finally{await asr.dispose();}}
process.on('message',async job=>{try{
 if(job.action==='speak'){const modelId='onnx-community/Kokoro-82M-v1.0-ONNX';const model=await StyleTextToSpeech2Model.from_pretrained(modelId,{dtype:'q8',device:'cpu',session_options:{intra_op_num_threads:2,inter_op_num_threads:1}});const tts=new KokoroTTS(model,await AutoTokenizer.from_pretrained(modelId));try{const audios=[];for(const part of chunks(job.text)){const audio=await tts.generate(part,{voice:job.voice,speed:job.speed});audios.push(audio.audio);}const joined=new Float32Array(audios.reduce((n,a)=>n+a.length,0));let at=0;for(const a of audios){joined.set(a,at);at+=a.length;}const {RawAudio}=await import('@huggingface/transformers');await new RawAudio(joined,24000).save(job.path);}finally{await tts.model.dispose();}}
 const result=job.transcribe===false?{text:job.text,chunks:[]}:await transcribe(job.path,job.model);await writeFile(job.output,JSON.stringify(result));process.send?.({ok:true});
 }catch(error){process.send?.({ok:false,error:error.message});}finally{setTimeout(()=>process.exit(0),100).unref();}});
