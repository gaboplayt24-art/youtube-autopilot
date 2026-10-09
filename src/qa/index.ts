import {access,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {visualQuality} from '../editor/quality';
import {exec,duration} from '../orchestration/io';
import {metadata as metadataSchema,type Script,type Composition,facts as factSchema} from '../orchestration/schemas';
import type {z} from 'zod';
export async function inspect(video:string,s:Script,c:Composition,f:z.infer<typeof factSchema>,metadata:unknown,assets:string[]){
 const checks:{name:string;passed:boolean;detail:string}[]=[];
 const add=(name:string,passed:boolean,detail:string)=>checks.push({name,passed,detail});
 add('factual consistency',f.passed,f.review+' '+f.issues.join('; '));
 let missing=false;for(const a of assets)try{await access(a);}catch{missing=true;}
 add('missing assets',!missing,`${assets.length} assets checked`);
 const seconds=await duration(video);const expected=c.durationInFrames/c.fps;
 let audioTiming=true;for(const scene of c.scenes){try{const d=await duration(assets.find(a=>a.endsWith(`${scene.id}.wav`))!);if(Math.abs(d-scene.frames/c.fps)>1/c.fps+0.01)audioTiming=false;}catch{audioTiming=false;}}
 add('audio duration',audioTiming&&Math.abs(seconds-expected)<0.25,`Rendered ${seconds.toFixed(3)}s; planned ${expected.toFixed(3)}s`);
 let frame=0;const timing=c.scenes.every(scene=>{const valid=scene.from===frame&&scene.frames>0;frame+=scene.frames;return valid;});
 add('scene timing',timing&&frame===c.durationInFrames,'Contiguous, positive scene frame ranges');
 const {stderr}=await exec('ffmpeg',['-hide_banner','-i',video,'-vf','blackdetect=d=0.25:pix_th=0.05','-af','silencedetect=n=-45dB:d=2','-f','null','-'],{maxBuffer:8*1024*1024});
 add('black frames',!stderr.includes('black_start:'),'FFmpeg blackdetect: sustained black segments >=0.25s');
 add('silent sections',!stderr.includes('silence_start:'),'FFmpeg silencedetect: silence >=2s');
 const probe=await exec('ffprobe',['-v','error','-show_streams','-of','json',video]);const streams=JSON.parse(probe.stdout).streams as {codec_type:string;codec_name:string;width?:number;height?:number;avg_frame_rate?:string}[];
 const picture=streams.find(x=>x.codec_type==='video');const rate=picture?.avg_frame_rate?.split('/').map(Number);add('output format',picture?.codec_name==='h264'&&picture.width===c.width&&picture.height===c.height&&!!rate&&Math.abs(rate[0]/rate[1]-c.fps)<0.01&&streams.some(x=>x.codec_name==='aac'),'H.264 / AAC, requested resolution and FPS');
 add('audio stream',streams.some(x=>x.codec_type==='audio'),'Audio stream required');
 const sceneBounds=c.cues.every(cue=>{const scene=c.scenes.find(x=>x.id===cue.sceneId);return !!scene&&cue.start>=scene.from/c.fps-0.02&&cue.end<=(scene.from+scene.frames)/c.fps+0.1;});
 const ordered=c.cues.every((cue,i)=>cue.start<cue.end&&cue.end<=expected+0.1&&(i===0||cue.start>=c.cues[i-1].end-0.001));
 const covered=s.scenes.every(scene=>c.cues.filter(x=>x.sceneId===scene.id).map(x=>x.text).join(' ')===scene.narration);
 add('caption synchronization',sceneBounds&&ordered&&covered,'Full narration coverage, speech-derived timestamps, and ordered bounds');
 const images=assets.filter(a=>!a.endsWith('.wav')); const hashes=await Promise.all(images.map(async a=>createHash('sha256').update(await readFile(a)).digest('hex')));
 const plannedReuse=c.assets.every(a=>!!a.sourceImageId&&!!a.editorialVariant);
 add('duplicated scenes',((expected>120||plannedReuse)?hashes.every((h,i)=>i===0||h!==hashes[i-1]):new Set(hashes).size===hashes.length)&&new Set(s.scenes.map(x=>x.narration)).size===s.scenes.length&&(expected>120||new Set(c.scenes.map(x=>x.image)).size===c.scenes.length),'Unique narration, asset paths, and image content hashes');
 {checks.push(...visualQuality(c).checks);const analysis=await exec('ffmpeg',['-hide_banner','-i',video,'-vf','freezedetect=n=-50dB:d=4','-af','volumedetect','-f','null','-'],{timeout:120000,maxBuffer:8*1024*1024});add('rendered motion',!analysis.stderr.includes('freeze_start'),'FFmpeg freeze detection: no unchanged region >=4s');const peak=Number(analysis.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]??0);add('audio clipping',peak<=-0.5,`Peak ${peak} dBFS; limiter required`); }
 const m=metadataSchema.safeParse(metadata);
 add('title/script consistency',m.success&&m.data.title===s.title,'Metadata title matches approved script title');
 add('metadata validity',m.success,m.success?'Validated title, description, category, disclosure and private status':'Invalid metadata');
 return {passed:checks.every(x=>x.passed),checks};
}
export const requiredQAChecks=['factual consistency','missing assets','audio duration','scene timing','black frames','silent sections','output format','audio stream','caption synchronization','duplicated scenes','shot pacing','visual coverage','continuous movement','asset narration alignment','asset repetition','caption readability','text density','rendered motion','audio clipping','title/script consistency','metadata validity'] as const;
export function requireQA(report:{passed:boolean;checks:{name?:string;passed:boolean}[]}){
 if(!report.passed||report.checks.some(x=>!x.passed)||requiredQAChecks.some(name=>report.checks.filter(x=>x.name===name&&x.passed).length!==1))throw new Error('QA failed or incomplete; upload blocked');
}
