import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {exec} from '../orchestration/io';
export async function illustrationContactSheet(images:{id:string;path:string}[],output:string,dir:string,columns=4,native16x9=false){
 if(!images.length||images.some(i=>! /^[A-Za-z0-9_-]+$/.test(i.id)))throw new Error('Invalid contact sheet image IDs');await mkdir(dir,{recursive:true});const tiles=[];const imageHeight=native16x9?216:384,tileHeight=imageHeight+44;
 for(const image of images){const path=join(dir,image.id+'-tile.png');await exec('ffmpeg',['-y','-v','error','-i',image.path,'-vf',`scale=384:${imageHeight}:force_original_aspect_ratio=decrease,pad=384:${tileHeight}:(ow-iw)/2:0:color=0xf5edda,drawtext=text='${image.id}':fontcolor=0x302a25:fontsize=22:x=12:y=${imageHeight+8}`,'-frames:v','1',path],{timeout:20000});tiles.push(path);}
 const layout=tiles.map((_,i)=>`${(i%columns)*384}_${Math.floor(i/columns)*tileHeight}`).join('|');
 await exec('ffmpeg',['-y','-v','error','-filter_complex_threads','1',...tiles.flatMap(path=>['-i',path]),'-filter_complex',`xstack=inputs=${tiles.length}:layout=${layout}:fill=0xf5edda`,'-frames:v','1','-q:v','2',output],{timeout:30000});
 return {path:output,images:images.length,columns,note:'Original FLUX image pixels resized for review; captions sit outside source artwork.'};
}
