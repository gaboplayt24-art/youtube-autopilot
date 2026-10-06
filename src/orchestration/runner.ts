import {mkdir,open,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import type {z} from 'zod';
import {json,log} from './io';
import {artifact,digest} from './integrity';
import type {StorageProvider} from '../providers/interfaces';
export class Runner {
 constructor(public dir:string,private storage?:StorageProvider,private runId?:string){}
 private async mirror(name:string,value:unknown){if(this.storage)await this.storage.put(`${this.runId}-${name}`,value);}
 async stage<T>(name:string,schema:z.ZodType<T>,fn:()=>Promise<T>,verify?:(value:T)=>Promise<void>):Promise<T>{
  const file=join(this.dir,`${name}.json`);
  let exists=true;try{await access(file);}catch{exists=false;}
  if(exists){const value=await artifact(this.dir,name,schema);if(verify)await verify(value);await this.mirror(name,value);await log(this.dir,'stage_resumed',{stage:name});return value;}
  await json(join(this.dir,'status.json'),{stage:name,state:'running',updatedAt:new Date().toISOString()});await log(this.dir,'stage_started',{stage:name});
  try{const value=schema.parse(await fn());if(verify)await verify(value);await json(join(this.dir,`${name}.integrity.json`),{sha256:digest(value)});await json(file,value);await this.mirror(name,value);await json(join(this.dir,'status.json'),{stage:name,state:'completed',updatedAt:new Date().toISOString()});await log(this.dir,'stage_completed',{stage:name});return value;}
  catch(error){await json(join(this.dir,'status.json'),{stage:name,state:'failed',error:error instanceof Error?error.message:'Unknown error'});await log(this.dir,'stage_failed',{stage:name});throw error;}
 }
 async lock(){await mkdir(this.dir,{recursive:true});const handle=await open(join(this.dir,'.lock'),'wx');await handle.writeFile(String(process.pid));await handle.close();}
 async unlock(){await rm(join(this.dir,'.lock'),{force:true});}
}
