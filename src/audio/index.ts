import {writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {z} from 'zod';
import {voice} from '../orchestration/schemas';
import type {MusicProvider,SoundEventType} from '../providers/interfaces';
import type {Shot,VisualProfile} from '../editor/schemas';
import {loadAudioConfig} from './qa';
import {masterAudio} from './master';
import {ElevenLabsSoundEffectsProvider} from '../providers/eleven-audio';
import {exec} from '../orchestration/io';
function wav(samples:Float32Array,path:string){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);return writeFile(path,b);}
export class OriginalMusicProvider implements MusicProvider {
 async generate(seconds:number,path:string,direction='original ambience'){const color=[...direction].reduce((n,c)=>n+c.charCodeAt(0),0)%5;const samples=new Float32Array(Math.ceil(seconds*48000));const chords=[[130.81,164.81,196],[110,130.81,164.81],[87.31,130.81,174.61],[98,146.83,196]];for(let i=0;i<samples.length;i++){const t=i/48000;const c=chords[(Math.floor(t/8)+color)%4].map(f=>f*Math.pow(2,(color-2)/12));const fade=Math.min(1,t/2,(seconds-t)/3);samples[i]=fade*c.reduce((n,f)=>n+0.075*Math.sin(2*Math.PI*f*t)+0.012*Math.sin(2*Math.PI*f*2*t),0)*(0.8+0.2*Math.sin(t*0.4));}await wav(samples,path);return {license:'Original procedural ambient score, CC0',estimatedCost:0};}
}
export class LocalMusicProvider implements MusicProvider {
 constructor(private file=process.env.MUSIC_PATH,private license=process.env.MUSIC_LICENSE){}
 async generate(_seconds:number,path:string){if(!this.file||!this.license)throw new Error('Licensed local music file and license required');await copyFile(this.file,path);return {license:this.license,estimatedCost:0};}
}
export function soundSample(type:SoundEventType,time:number,duration:number){const noise=Math.sin(time*48000*12.9898)*Math.sin(time*48000*78.233);const envelope=Math.sin(Math.PI*time/duration)*Math.exp(-time*5);if(type==='impact')return envelope*.6*Math.sin(time*2*Math.PI*(90-time*120));if(type==='click'||type==='camera')return noise*Math.exp(-time*80)*.5;if(type==='riser')return envelope*Math.sin(2*Math.PI*(120*time+700*time*time))*.2;if(type==='ambient')return Math.sin(time*2*Math.PI*110)*.1;return envelope*noise*(type==='page-turn'?.2:.35);}
export async function mixAudio(v:z.infer<typeof voice>,shots:Shot[],profile:VisualProfile,dir:string,fps:number,music:MusicProvider=new OriginalMusicProvider()){
 const config=await loadAudioConfig();const seconds=v.scenes.reduce((sum,s)=>sum+Math.ceil(s.duration*fps)/fps,0);const musicPath=join(dir,'music.wav');const provenance=await music.generate(seconds,musicPath);const sfxPath=join(dir,'sfx.wav');const samples=new Float32Array(Math.ceil(seconds*48000));
 const semantic=shots.filter(s=>s.shotType==='document'||/desert|marketplace|palace|battle|reveal/.test(s.narration.toLowerCase()));const chosen=semantic.filter((s,i)=>i===0||s.start-semantic[i-1].start>=18);const events=(chosen.length?chosen:shots.slice(4,5)).map(s=>({time:s.start,type:(s.shotType==='document'?'page-turn':/desert|marketplace|palace/.test(s.narration.toLowerCase())?'ambient':'impact') as SoundEventType}));
 for(const event of events){const length=event.type==='impact'?0.25:0.45;for(let i=0;i<length*48000;i++){const t=i/48000;const at=Math.floor(event.time*48000)+i;if(at>=samples.length)break;samples[at]+=soundSample(event.type,t,length)*(event.type==='ambient'?Math.pow(10,(config.ambienceDb-config.sfxDb)/20):1);}}
 await wav(samples,sfxPath);if(config.sfxProvider==='elevenlabs'){let base=sfxPath;for(let i=0;i<events.length;i++){const event=events[i];const shot=shots.find(s=>s.start===event.time)!;const generated=join(dir,`sfx-semantic-${i}.wav`);await new ElevenLabsSoundEffectsProvider().generate(`Restrained documentary sound, no speech: ${shot.visualIntent}`,event.type==='ambient'?8:1,generated);const out=join(dir,`sfx-layer-${i}.wav`);const delay=Math.round(event.time*1000);await exec('ffmpeg',['-y','-v','error','-i',base,'-i',generated,'-filter_complex',`[1:a]volume=${event.type==='ambient'?config.ambienceDb-config.sfxDb:0}dB,adelay=${delay}:all=1[g];[0:a][g]amix=inputs=2:normalize=0:duration=first[s]`,'-map','[s]',out],{timeout:120000});base=out;}await copyFile(base,sfxPath);}const path=join(dir,'mixed.wav');
 const narrationPath=join(dir,'narration-normalized.wav');const narrationRaw=join(dir,'narration-continuous.wav');const musicNormalized=join(dir,'music-normalized.wav');
 // FFmpeg 6.1 can drain a shared loudnorm/asplit/sidechain graph prematurely.
 // Normalize stems separately and give the ducking detector an independent input.
 const narrationFilter=[...v.scenes.map((s,i)=>`[${i}:a]aresample=48000,apad,atrim=duration=${Math.ceil(s.duration*fps)/fps},asetpts=PTS-STARTPTS[a${i}]`),`${v.scenes.map((_,i)=>`[a${i}]`).join('')}concat=n=${v.scenes.length}:v=0:a=1,aresample=48000[narration]`].join(';');
 await exec('ffmpeg',['-y','-v','error',...v.scenes.flatMap(s=>['-i',s.path]),'-filter_complex',narrationFilter,'-map','[narration]','-ar','48000',narrationRaw],{timeout:120000,maxBuffer:1024*1024});
 await masterAudio(narrationRaw,narrationPath,config,true);
 await exec('ffmpeg',['-y','-v','error','-i',musicPath,'-af','loudnorm=I=-12:TP=-2:LRA=7,aresample=48000','-ar','48000',musicNormalized],{timeout:120000,maxBuffer:1024*1024});
 const duckedPath=join(dir,'music-ducked.wav');
 let offset=0;const intervals:{start:number;end:number}[]=[];for(const scene of v.scenes){const local=scene.words??scene.alignment;if(local.length)intervals.push({start:offset+local[0].start,end:offset+local.at(-1)!.end});offset+=Math.ceil(scene.duration*fps)/fps;}
 // Long chapters, smooth edge envelopes and sidechain attenuation; never a universal fixed music level.
 const active=intervals.length?intervals.map(s=>`if(between(t,${s.start},${s.end}),max(0,min(1,min((t-${s.start})/0.35,(${s.end}-t)/0.5))),0)`).join('+'):'1';const low=Math.pow(10,(config.musicUnderSpeechDb+12)/20),high=Math.pow(10,(config.musicBetweenSpeechDb+12)/20);
 const musicFilter=`[0:a]volume='${high}-(${high}-${low})*min(1,${active})':eval=frame,afade=t=in:d=2,afade=t=out:st=${Math.max(0,seconds-3)}:d=3[m];[m][1:a]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=600[d]`;
 await exec('ffmpeg',['-y','-v','error','-i',musicNormalized,'-i',narrationPath,'-filter_complex',musicFilter,'-map','[d]','-ar','48000',duckedPath],{timeout:240000});
 const preMaster=join(dir,'mix-premaster.wav');const filter=`[2:a]volume=${config.sfxDb}dB[s];[0:a][1:a][s]amix=inputs=3:duration=first:normalize=0,atrim=duration=${seconds},asetpts=PTS-STARTPTS[mix]`;
 await exec('ffmpeg',['-y','-v','error','-i',narrationPath,'-i',duckedPath,'-i',sfxPath,'-filter_complex',filter,'-map','[mix]','-ar','48000',preMaster],{timeout:240000,maxBuffer:1024*1024});
 await masterAudio(preMaster,path,config);
 const probe=await exec('ffmpeg',['-hide_banner','-i',path,'-af','volumedetect','-f','null','-'],{timeout:30000});const peak=Number(probe.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]??0);
 return {path,musicPath,narrationPath,duckedMusicPath:duckedPath,events,duration:seconds,peakDb:peak,musicDb:profile.musicDb,sfxDb:profile.sfxDb,provenance:provenance.license};
}
