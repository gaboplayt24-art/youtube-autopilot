import {writeFile} from 'node:fs/promises';
import type {DynamicEdit} from '../editor/schemas';
const RATE=48000;
type Sound=DynamicEdit['sfx'][number]['type'];

/** Deterministic noise so every render of the same edit produces identical audio. */
function noise(seed:number){let s=seed>>>0||1;return ()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return ((s>>>0)/4294967295)*2-1;};}

/** Resonant band-pass (RBJ biquad) whose centre frequency can move per sample. */
function bandpass(){let x1=0,x2=0,y1=0,y2=0;return (x:number,freq:number,q:number)=>{const w=2*Math.PI*freq/RATE,a=Math.sin(w)/(2*q),c=Math.cos(w),a0=1+a;const y=(a*x-a*x2-(-2*c)*y1-(1-a)*y2)/a0;x2=x1;x1=x;y2=y1;y1=y;return y;};}

const LENGTH:Record<Sound,number>={whoosh:.42,pop:.14,boom:1.1,shimmer:1.4,paper:.32};

/** Original procedurally synthesized effects (CC0): no samples, recordings or paid generation. */
export function synthesize(type:Sound):Float32Array{
 const n=Math.round(LENGTH[type]*RATE),out=new Float32Array(n),rand=noise(type.length*7919+n),filter=bandpass(),second=bandpass();
 for(let i=0;i<n;i++){
  const t=i/RATE,p=t/LENGTH[type];
  if(type==='whoosh'){const env=Math.pow(Math.sin(Math.PI*Math.min(1,p*1.25)),2)*(p<.8?1:1-(p-.8)/.2);const freq=350+2600*Math.sin(Math.PI*Math.min(1,p*1.1));out[i]=filter(rand(),freq,1.2)*env*1.6+second(rand(),freq*1.9,2.5)*env*.5;}
  else if(type==='pop'){const pitch=900*Math.exp(-t*38)+180;out[i]=Math.sin(2*Math.PI*pitch*t)*Math.exp(-t*34)*.9+rand()*Math.exp(-t*400)*.25;}
  else if(type==='boom'){const pitch=62*Math.exp(-t*1.6)+34;out[i]=(Math.sin(2*Math.PI*pitch*t)*.95+filter(rand(),180,.7)*.6*Math.exp(-t*9))*Math.exp(-t*3.2)*Math.min(1,t/.004);}
  else if(type==='shimmer'){const partials=[1318.5,1975.5,2637,3520];const env=Math.min(1,t/.04)*Math.exp(-t*2.4);out[i]=partials.reduce((sum,f,k)=>sum+Math.sin(2*Math.PI*f*t+k)*(.28/(k+1))*(1+.25*Math.sin(2*Math.PI*(5+k)*t)),0)*env;}
  else{const burst=Math.max(0,Math.sin(2*Math.PI*14*t))**6;out[i]=filter(rand(),2400+1600*Math.sin(t*23),.9)*burst*Math.exp(-t*4)*1.4;}
 }
 let peak=0;for(const v of out)peak=Math.max(peak,Math.abs(v));const gain=peak?.9/peak:1;for(let i=0;i<n;i++)out[i]*=gain;
 return out;
}

/** Relative loudness inside the effects stem; the stem itself is mixed at config sfxDb. */
const LEVEL:Record<Sound,number>={whoosh:.55,pop:.45,boom:.9,shimmer:.4,paper:.4};

export function sfxTrack(events:DynamicEdit['sfx'],seconds:number):Float32Array{
 const out=new Float32Array(Math.ceil(seconds*RATE));const cache=new Map<Sound,Float32Array>();
 for(const event of events){
  const sample=cache.get(event.type)??synthesize(event.type);cache.set(event.type,sample);
  const at=Math.round(event.time*RATE);for(let i=0;i<sample.length&&at+i<out.length;i++)out[at+i]+=sample[i]*LEVEL[event.type];
 }
 for(let i=0;i<out.length;i++)out[i]=Math.max(-1,Math.min(1,out[i]));
 return out;
}

export async function writeSfxTrack(events:DynamicEdit['sfx'],seconds:number,path:string){
 const samples=sfxTrack(events,seconds);const b=Buffer.alloc(44+samples.length*2);
 b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVE',8);b.write('fmt ',12);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(RATE,24);b.writeUInt32LE(RATE*2,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(samples.length*2,40);
 for(let i=0;i<samples.length;i++)b.writeInt16LE(Math.round(samples[i]*32767),44+i*2);
 await writeFile(path,b);
}
