import type {Composition} from '../orchestration/schemas';
import {fileURLToPath} from 'node:url';
import {superviseWorker} from './supervisor';
const worker=fileURLToPath(new URL('./worker.ts',import.meta.url));
export async function renderVideo(props:Composition,path:string){await superviseWorker(worker,{kind:'video',props,path},12*60*1000);}
export async function renderThumbnail(props:Composition,path:string){await superviseWorker(worker,{kind:'thumbnail',props,path},2*60*1000);}

export async function renderPreview(props:Composition,path:string,frame:number){await superviseWorker(worker,{kind:'preview',props,path,frame},2*60*1000);}
