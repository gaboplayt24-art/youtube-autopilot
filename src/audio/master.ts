import type {z} from 'zod';
import {exec} from '../orchestration/io';
import {audioConfig} from './qa';
export async function masterAudio(input:string,output:string,config:z.infer<typeof audioConfig>,narration=false){
 const corrective=narration?`highpass=f=${config.highPassHz},equalizer=f=250:t=q:w=1:g=-1,equalizer=f=3000:t=q:w=1:g=${config.presenceDb},deesser=i=${config.deEssIntensity}:m=0.4:f=0.5,acompressor=threshold=0.2:ratio=${config.compressorRatio}:attack=25:release=200,`:'';
 const target=`I=${config.integratedLufs}:TP=${config.maxTruePeak-.3}:LRA=${config.lraTarget}`;
 const measured=await exec('ffmpeg',['-hide_banner','-nostats','-i',input,'-af',`${corrective}loudnorm=${target}:print_format=json`,'-f','null','-'],{timeout:240000,maxBuffer:2*1024*1024});const matches=measured.stderr.match(/\{\s*"input_i"[\s\S]*?\}/g);if(!matches?.length)throw new Error('Mastering loudness measurement failed');const stats=JSON.parse(matches.at(-1)!);for(const key of ['input_i','input_tp','input_lra','input_thresh','target_offset'])if(!Number.isFinite(Number(stats[key])))throw new Error('Silent or invalid audio cannot be normalized');
 await exec('ffmpeg',['-y','-v','error','-i',input,'-af',`${corrective}loudnorm=${target}:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true,aresample=48000,alimiter=limit=0.86:level=false:latency=true`,'-ar','48000',output],{timeout:240000,maxBuffer:1024*1024});
 return {integratedInput:Number(stats.input_i),truePeakInput:Number(stats.input_tp),lraInput:Number(stats.input_lra),targetLufs:config.integratedLufs,targetTruePeak:config.maxTruePeak};
}
