import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {Shot} from '../editor/schemas';
import {media} from '../editor/schemas';
import {exec,json} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {doodleSVG} from './doodle-art';
import {inspectVisualIdeas} from './doodle-qa';
export async function createDoodleAssets(shots:Shot[],dir:string){
 const qa=inspectVisualIdeas(shots);await json(join(dir,'visual-thinking-QA.json'),qa);if(!qa.passed)throw new Error('Visual thinking QA failed');
 await mkdir(dir,{recursive:true});const assets=[];
 for(const s of shots){const svg=join(dir,s.id+'.svg'),path=join(dir,s.id+'.png');await writeFile(svg,doodleSVG(s.visualIdea!));await exec('ffmpeg',['-y','-v','error','-i',svg,'-frames:v','1',path],{timeout:20000});assets.push({shotId:s.id,path,kind:'graphic' as const,provider:'original-doodle-v3',license:'Original project-authored 2D vector illustration; no competitor artwork',sourceUrl:null,estimatedCost:0,intent:s.narration+'; '+s.visualIdea!.takeaway,sha256:await fileDigest(path),qualityScore:90,fallbacks:[]});}
 return media.parse({assets,estimatedTotalCost:0});
}
