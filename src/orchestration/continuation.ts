import {createHash} from 'node:crypto';
import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
/** Runtime/input bytes, not documentation or progress commits, identify meaningful corrections. */
export async function continuationIdentity(runId:string,sourceRunId:string,root='.'){
 if(!/^[a-zA-Z0-9_-]+$/.test(runId)||!/^(?:\d+|new)$/.test(sourceRunId))throw Error('Invalid continuation identity');
 const h=createHash('sha256').update(runId+'\n'+sourceRunId+'\n');
 const paths:string[]=[];
 for(const dir of ['src','remotion']){
  const scan=async(relative:string)=>{let entries;try{entries=await readdir(join(root,relative),{withFileTypes:true});}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
   for(const entry of entries){const file=join(relative,entry.name);if(entry.isSymbolicLink())throw Error('Symlink in continuation inputs');if(entry.isDirectory())await scan(file);else if(/\.tsx?$/.test(file))paths.push(file);}
  };await scan(dir);
 }
 for(const name of ['editorial-draft','visual-revisions'])paths.push(`data/scripts/${runId}-${name}.json`);
 for(const file of paths.sort()){try{h.update(file+'\0').update(await readFile(join(root,file))).update('\0');}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
 return h.digest('hex');
}
