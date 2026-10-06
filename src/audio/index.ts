import {writeFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {z} from 'zod';
import {voice} from '../orchestration/schemas';
import type {MusicProvider,SoundEventType} from '../providers/interfaces';
import type {Shot,VisualProfile} from '../editor/schemas';
import {exec} from '../orchestration/io';
function wav(samples:Float32Array,path:string){const b=Buffer.alloc(44+samples.length*2);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(48000,24);b.writeUInt32LE(96000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(Math.max(-1,Math.min(1,samples[i]))*32767),44+i*2);return writeFile(path,b);}
export class OriginalMusicProvider implements MusicProvider {
 async generate(seconds:number,path:string){const samples=new Float32Array(Math.ceil(seconds*48000));const chords=[[130.81,164.81,196],[110,130.81,164.81],[87.31,130.81,174.61],[98,146.83,196]];for(let i=0;i<samples.length;i++){const t=i/48000;const c=chords[Math.floor(t/8)%4];const fade=Math.min(1,t/2,(seconds-t)/3);samples[i]=fade*c.reduce((n,f)=>n+0.075*Math.sin(2*Math.PI*f*t)+0.012*Math.sin(2*Math.PI*f*2*t),0)*(0.8+0.2*Math.sin(t*0.4));}await wav(samples,path);return {license:'Original procedural ambient score, CC0',estimatedCost:0};}
}
export class LocalMusicProvider implements MusicProvider {
 async generate(_seconds:number,path:string){if(!process.env.MUSIC_PATH||!process.env.MUSIC_LICENSE)throw new Error('MUSIC_PATH and MUSIC_LICENSE required');await copyFile(process.env.MUSIC_PATH,path);return {license:process.env.MUSIC_LICENSE,estimatedCost:0};}
}
export function soundSample(type:SoundEventType,time:number,duration:number){const noise=Math.sin(time*48000*12.9898)*Math.sin(time*48000*78.233);const envelope=Math.sin(Math.PI*time/duration)*Math.exp(-time*5);if(type==='impact')return envelope*.6*Math.sin(time*2*Math.PI*(90-time*120));if(type==='click'||type==='camera')return noise*Math.exp(-time*80)*.5;if(type==='riser')return envelope*Math.sin(2*Math.PI*(120*time+700*time*time))*.2;if(type==='ambient')return Math.sin(time*2*Math.PI*110)*.1;return envelope*noise*(type==='page-turn'?.2:.35);}
export async function mixAudio(v:z.infer<typeof voice>,shots:Shot[],profile:VisualProfile,dir:string,fps:number,music:MusicProvider=new OriginalMusicProvider()){
 const seconds=v.scenes.reduce((sum,s)=>sum+Math.ceil(s.duration*fps)/fps,0);const musicPath=join(dir,'music.wav');const provenance=await music.generate(seconds,musicPath);const sfxPath=join(dir,'sfx.wav');const samples=new Float32Array(Math.ceil(seconds*48000));
 const events=shots.filter((_,i)=>i>0&&i%4===0).map((s,i)=>({time:s.start,type:(s.shotType==='document'?'page-turn':i%3===0?'impact':'whoosh') as 'page-turn'|'impact'|'whoosh'}));
 for(const event of events){const length=event.type==='impact'?0.25:0.45;for(let i=0;i<length*48000;i++){const t=i/48000;const at=Math.floor(event.time*48000)+i;if(at>=samples.length)break;samples[at]+=soundSample(event.type,t,length);}}
 await wav(samples,sfxPath);const path=join(dir,'mixed.wav');const inputs=v.scenes.flatMap(s=>['-i',s.path]);inputs.push('-i',musicPath,'-i',sfxPath);const n=v.scenes.length;
 const filter=[...v.scenes.map((s,i)=>`[${i}:a]aresample=48000,apad,atrim=duration=${Math.ceil(s.duration*fps)/fps},asetpts=PTS-STARTPTS[a${i}]`),`${v.scenes.map((_,i)=>`[a${i}]`).join('')}concat=n=${n}:v=0:a=1,loudnorm=I=-16:TP=-2:LRA=7,acompressor=threshold=0.15:ratio=2:attack=15:release=150,asplit=2[narration][sidechain]`,`[${n}:a]loudnorm=I=-12:TP=-2:LRA=7,volume=${profile.musicDb+12}dB,afade=t=in:d=2,afade=t=out:st=${Math.max(0,seconds-3)}:d=3[music]`,`[music][sidechain]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[ducked]`,`[${n+1}:a]volume=${profile.sfxDb}dB[sfx]`,`[narration][ducked][sfx]amix=inputs=3:duration=first:normalize=0,alimiter=limit=0.89:level=false[mix]`].join(';');
 await exec('ffmpeg',['-y','-v','error',...inputs,'-filter_complex',filter,'-map','[mix]','-ar','48000',path],{timeout:120000,maxBuffer:1024*1024});
 const probe=await exec('ffmpeg',['-hide_banner','-i',path,'-af','volumedetect','-f','null','-'],{timeout:30000});const peak=Number(probe.stderr.match(/max_volume:\s*(-?[\d.]+) dB/)?.[1]??0);
 return {path,musicPath,events,duration:seconds,peakDb:peak,musicDb:profile.musicDb,sfxDb:profile.sfxDb,provenance:provenance.license};
}
