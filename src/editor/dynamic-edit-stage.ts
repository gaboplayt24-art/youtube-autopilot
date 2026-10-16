import {readFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import type {Shot} from './schemas';
import type {TimedWord} from './illustrated-edit';
import {planDynamicEdit,type Focus,type Layers,type Zones} from './dynamic-edit';
import {imageLayout} from './focus';
import {exec} from '../orchestration/io';

const titlesFile=z.object({runId:z.string(),titles:z.record(z.string().min(1).max(48))});
const layerReport=z.object({usable:z.boolean(),actors:z.array(z.object({file:z.string(),x:z.number(),y:z.number(),width:z.number(),height:z.number()}))});
export const PRESENTER_SHEET='assets/references/style-v5-eli-sheet.png';

/** Owner-reviewable chapter-card titles; without the file the edit simply has no chapter cards. */
export async function chapterTitles(runId:string){
 try{const parsed=titlesFile.parse(JSON.parse(await readFile(`data/scripts/${runId}-chapter-titles.json`,'utf8')));if(parsed.runId!==runId)throw new Error('Chapter titles belong to another run');return parsed.titles;}
 catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return {};throw error;}
}

/** Local rembg/OpenCV split of one approved illustration (scripts/extract-layers.py); cached per output folder. */
export async function extractLayers(image:string,out:string,python=process.env.REMBG_PYTHON??'.venv-rembg/bin/python'){
 const report=join(out,'layers.json');
 if(!await access(report).then(()=>true,()=>false))await exec(python,['scripts/extract-layers.py','--input',image,'--out',out],{timeout:300000});
 return layerReport.parse(JSON.parse(await readFile(report,'utf8')));
}

/** Without the optional rembg environment the edit falls back to full-frame framings for every shot. */
async function layersAvailable(python=process.env.REMBG_PYTHON??'.venv-rembg/bin/python'){return access(python).then(()=>true,()=>false);}

export async function buildDynamicEdit({runId,shots,words,scenes,images,layersDir,layerShots}:{runId:string;shots:Shot[];words:TimedWord[];scenes:{id:string;start:number;claims?:{text:string}[]}[];images:{shotId:string;path:string}[];layersDir?:string;layerShots?:Set<string>}){
 const focus:Focus={},zones:Zones={},layers:Layers={};let presenter:string[]=[];
 const useLayers=!!layersDir&&await layersAvailable();
 for(const image of images){
  const layout=await imageLayout(image.path);focus[image.shotId]=layout.focus;zones[image.shotId]=layout.zone;
  if(useLayers&&(!layerShots||layerShots.has(image.shotId))){const report=await extractLayers(image.path,join(layersDir,image.shotId));if(report.usable)layers[image.shotId]={background:`${runId}/layers/${image.shotId}/bg.png`,actors:report.actors.map(a=>({path:`${runId}/layers/${image.shotId}/${a.file}`,x:a.x,y:a.y,width:a.width,height:a.height}))};}
 }
 if(useLayers){const report=await extractLayers(PRESENTER_SHEET,join(layersDir,'presenter'));if(report.usable&&report.actors.length===3)presenter=report.actors.map(a=>`${runId}/layers/presenter/${a.file}`);}
 return planDynamicEdit({shots,words,scenes,titles:await chapterTitles(runId),focus,zones,layers,presenter});
}
