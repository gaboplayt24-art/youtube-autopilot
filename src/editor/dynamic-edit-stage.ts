import {readFile} from 'node:fs/promises';
import {z} from 'zod';
import type {Shot} from './schemas';
import type {TimedWord} from './illustrated-edit';
import {planDynamicEdit,type Focus,type Zones} from './dynamic-edit';
import {imageLayout} from './focus';

const titlesFile=z.object({runId:z.string(),titles:z.record(z.string().min(1).max(48))});

/** Owner-reviewable chapter-card titles; without the file the edit simply has no chapter cards. */
export async function chapterTitles(runId:string){
 try{const parsed=titlesFile.parse(JSON.parse(await readFile(`data/scripts/${runId}-chapter-titles.json`,'utf8')));if(parsed.runId!==runId)throw new Error('Chapter titles belong to another run');return parsed.titles;}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {};throw error;}
}

export async function buildDynamicEdit({runId,shots,words,scenes,images}:{runId:string;shots:Shot[];words:TimedWord[];scenes:{id:string;start:number;claims?:{text:string}[]}[];images:{shotId:string;path:string}[]}){
 const focus:Focus={},zones:Zones={};for(const image of images){const layout=await imageLayout(image.path);focus[image.shotId]=layout.focus;zones[image.shotId]=layout.zone;}
 return planDynamicEdit({shots,words,scenes,titles:await chapterTitles(runId),focus,zones});
}
