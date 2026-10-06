import {z} from 'zod';
import {join} from 'node:path';
import type {MusicProvider} from '../providers/interfaces';
import {OriginalMusicProvider,LocalMusicProvider} from './index';
import {ElevenLabsMusicProvider} from '../providers/eleven-audio';
import {exec,duration,read,json} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {loadAudioConfig} from './qa';
export class ChapterMusicProvider implements MusicProvider {
 constructor(private chapters:{duration:number;direction:string}[],private demo=false,private libraryOverride?:{beds:{path:string;license:string;direction:string}[]}){}
 async generate(seconds:number,path:string){const c=await loadAudioConfig();const licenses:string[]=[];let estimatedCost=0;let mixed:string|undefined;let covered=0;const library=z.object({beds:z.array(z.object({path:z.string().min(1),license:z.string().min(1),direction:z.string()}))}).parse(this.libraryOverride??await read('config/music-library.json'));if(!this.demo&&c.musicProvider==='local'&&seconds>=480&&process.env.MUSIC_PATH&&new Set(library.beds.map(b=>b.path)).size<2)throw new Error('Long production needs multiple licensed music beds; one repeated track is insufficient');
 for(let i=0;i<this.chapters.length;i++){const chapter=this.chapters[i];const fade=i?Math.min(c.crossfadeSeconds,chapter.duration/4):0;const length=chapter.duration+fade;const bed=join(path.replace(/\/[^/]+$/,''),`music-chapter-${i+1}.wav`);const bedSource=library.beds[i%Math.max(1,library.beds.length)];const provider:MusicProvider|null=this.demo?new OriginalMusicProvider():c.musicProvider==='elevenlabs'?new ElevenLabsMusicProvider():bedSource?new LocalMusicProvider(bedSource.path,bedSource.license):process.env.MUSIC_PATH?new LocalMusicProvider():c.allowProceduralFallback?new OriginalMusicProvider():null;if(!provider)throw new Error('No licensed production music configured; procedural fallback disabled');
 let info;try{const cached=await read(bed+'.json');if(cached.direction!==chapter.direction||cached.length!==length||cached.sha256!==await fileDigest(bed))throw new Error('Music checkpoint changed');info=cached;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;try{info=await provider.generate(length,bed,chapter.direction);}catch(error){if(!c.allowProceduralFallback||!(provider instanceof ElevenLabsMusicProvider))throw error;info=await new OriginalMusicProvider().generate(length,bed,chapter.direction);await json(bed+'.fallback.json',{error:error instanceof Error?error.message:'unavailable',provider:'procedural-fallback',cost:0});}await json(bed+'.json',{...info,direction:chapter.direction,length,sha256:await fileDigest(bed)});}licenses.push(info.license);estimatedCost+=info.estimatedCost;
 const clipped=bed+'.trim.wav';await exec('ffmpeg',['-y','-v','error','-stream_loop','-1','-i',bed,'-t',String(length),'-ar','48000',clipped],{timeout:120000});if(!mixed)mixed=clipped;else{const next=bed+'.joined.wav';await exec('ffmpeg',['-y','-v','error','-i',mixed,'-i',clipped,'-filter_complex',`[0:a][1:a]acrossfade=d=${fade}:c1=tri:c2=tri[out]`,'-map','[out]',next],{timeout:240000});mixed=next;}covered+=chapter.duration;
 }
 if(!mixed||Math.abs(covered-seconds)>.2)throw new Error('Chapter music duration mismatch');await exec('ffmpeg',['-y','-v','error','-i',mixed,'-af',`apad,atrim=duration=${seconds}`,'-ar','48000',path],{timeout:240000});if(Math.abs(await duration(path)-seconds)>.05)throw new Error('Chapter music truncated');return {license:[...new Set(licenses)].join('; '),estimatedCost};
 }
}
