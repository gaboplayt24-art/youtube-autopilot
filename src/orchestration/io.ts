import {mkdir,writeFile,rename,readFile,appendFile} from 'node:fs/promises';
import {dirname,join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export const exec=promisify(execFile);
export async function json(path:string,value:unknown){await mkdir(dirname(path),{recursive:true});const tmp=`${path}.tmp`;await writeFile(tmp,JSON.stringify(value,null,2));await rename(tmp,path);}
export async function read(path:string){return JSON.parse(await readFile(path,'utf8'));}
export async function log(dir:string,event:string,fields:Record<string,unknown>={}){await mkdir(dir,{recursive:true});const line=JSON.stringify({time:new Date().toISOString(),event,...fields});console.log(line);await appendFile(join(dir,'logs.jsonl'),line+'\n');}
export async function duration(path:string){const {stdout}=await exec('ffprobe',['-v','error','-show_entries','format=duration','-of','json',path]);return Number(JSON.parse(stdout).format.duration);}
