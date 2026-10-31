import {readFile} from 'node:fs/promises';
import {renderHyperframes} from './hyperframes';
import type {Composition} from '../orchestration/schemas';
import {fileURLToPath} from 'node:url';
import {superviseWorker} from './supervisor';
const worker=fileURLToPath(new URL('./worker.ts',import.meta.url));
// Owner-requested 2026-10-31: long videos with a dynamic edit render with HyperFrames (config/render.json); Shorts and
// thumbnails stay on Remotion until the owner approves the new edit for them too.
export async function renderVideo(props:Composition,path:string){
 const renderer=await readFile('config/render.json','utf8').then(t=>JSON.parse(t).renderer as string,()=>'remotion');
 if(renderer==='hyperframes'&&props.edit&&props.width===1920&&props.height===1080){await renderHyperframes({...props,edit:props.edit},'public',path);return;}
 await superviseWorker(worker,{kind:'video',props,path},Math.max(12*60*1000,Math.min(90*60*1000,props.durationInFrames/props.fps*12*1000)));}
export async function renderThumbnail(props:Composition,path:string){await superviseWorker(worker,{kind:'thumbnail',props,path},2*60*1000);}

export async function renderPreview(props:Composition,path:string,frame:number){await superviseWorker(worker,{kind:'preview',props,path,frame},2*60*1000);}
