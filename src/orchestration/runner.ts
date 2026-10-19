import {mkdir,open,rm,access,readFile,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {z} from 'zod';
import {json,log} from './io';
import {artifact,digest} from './integrity';
import type {StorageProvider} from '../providers/interfaces';
export class Runner {
 constructor(public dir:string,private storage?:StorageProvider,private runId?:string){}
 private async mirror(name:string,value:unknown){if(this.storage)await this.storage.put(`${this.runId}-${name}`,value);}
 private async failed(name:string,error:unknown){await json(join(this.dir,'status.json'),{stage:name,state:'failed',updatedAt:new Date().toISOString(),error:error instanceof Error?error.message:'Unknown error'});await log(this.dir,'stage_failed',{stage:name});}
 async invalidate(names:string[],reason:string){
  if(names.some(name=>!/^[A-Za-z0-9_-]+$/.test(name)))throw Error('Invalid stage name');
  const history=join(this.dir,'evidence-history');await mkdir(history,{recursive:true});
  for(const name of names){
   const file=join(this.dir,name+'.json');let raw:string;
   try{raw=await readFile(file,'utf8');}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')continue;throw error;}
   const key=name+'-'+digest(raw);await copyFile(file,join(history,key+'.json'));
   try{await copyFile(join(this.dir,name+'.integrity.json'),join(history,key+'.integrity.json'));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   await json(join(history,key+'.revision.json'),{stage:name,reason,archivedAt:new Date().toISOString()});
   await rm(file);await rm(join(this.dir,name+'.integrity.json'),{force:true});await log(this.dir,'stage_invalidated',{stage:name,reason,archive:key});
  }
 }
 async stage<T>(name:string,schema:z.ZodType<T,z.ZodTypeDef,unknown>,fn:()=>Promise<T>,verify?:(value:T)=>Promise<void>):Promise<T>{
  const file=join(this.dir,`${name}.json`);
  let exists=true;try{await access(file);}catch{exists=false;}
  if(exists){try{const value=await artifact(this.dir,name,schema);if(verify)await verify(value);await this.mirror(name,value);await json(join(this.dir,'status.json'),{stage:name,state:'completed',resumed:true,updatedAt:new Date().toISOString()});await log(this.dir,'stage_resumed',{stage:name});return value;}catch(error){await this.failed(name,error);throw error;}}
  await json(join(this.dir,'status.json'),{stage:name,state:'running',updatedAt:new Date().toISOString()});await log(this.dir,'stage_started',{stage:name});
  try{const value=schema.parse(await fn());if(verify)await verify(value);await json(join(this.dir,`${name}.integrity.json`),{sha256:digest(value)});await json(file,value);await this.mirror(name,value);await json(join(this.dir,'status.json'),{stage:name,state:'completed',updatedAt:new Date().toISOString()});await log(this.dir,'stage_completed',{stage:name});return value;}
  catch(error){await this.failed(name,error);throw error;}
 }
 async lock(){
  await mkdir(this.dir,{recursive:true});const path=join(this.dir,'.lock');const create=async()=>{const handle=await open(path,'wx');try{await handle.writeFile(String(process.pid));}finally{await handle.close();}};
  try{await create();}catch(error){
   if((error as NodeJS.ErrnoException).code!=='EEXIST')throw error;
   // Serialize stale-lock recovery; never remove a live process's lock.
   const guardPath=join(this.dir,'.lock-recovery'),guard=await open(guardPath,'wx');
   try{const pid=Number(await readFile(path,'utf8'));if(!Number.isSafeInteger(pid)||pid<=0)throw error;
    let dead=false;try{process.kill(pid,0);}catch(probe){if((probe as NodeJS.ErrnoException).code==='ESRCH')dead=true;else throw error;}
    if(!dead)throw error;await rm(path);await create();await log(this.dir,'stale_lock_recovered',{pid});
   }finally{await guard.close();await rm(guardPath,{force:true});}
  }
 }
 async unlock(){await rm(join(this.dir,'.lock'),{force:true});}
}
