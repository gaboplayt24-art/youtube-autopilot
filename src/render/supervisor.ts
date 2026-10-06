import {fork,type Serializable} from 'node:child_process';
import {readdir,readFile} from 'node:fs/promises';

type ProcessIdentity={pid:number;parent:number;started:string};
async function processTable():Promise<ProcessIdentity[]>{
 if(process.platform!=='linux')return [];
 const names=await readdir('/proc');
 const rows=await Promise.all(names.filter(n=>/^\d+$/.test(n)).map(async n=>{
  try{const stat=await readFile(`/proc/${n}/stat`,'utf8');const fields=stat.slice(stat.lastIndexOf(')')+2).split(' ');return {pid:Number(n),parent:Number(fields[1]),started:fields[19]};}catch{return null;}
 }));return rows.filter((row):row is ProcessIdentity=>row!==null);
}
async function signalOwned(identity:ProcessIdentity,signal:NodeJS.Signals){
 try{const stat=await readFile(`/proc/${identity.pid}/stat`,'utf8');if(stat.slice(stat.lastIndexOf(')')+2).split(' ')[19]===identity.started)process.kill(identity.pid,signal);}catch(error){if(!['ENOENT','ESRCH'].includes((error as NodeJS.ErrnoException).code??''))throw error;}
}
/** Isolate browser/encoder resources and bound cleanup, including detached Chrome descendants. */
export function superviseWorker(modulePath:string,payload:Serializable,timeoutMs:number):Promise<void>{
 return new Promise((resolve,reject)=>{
  const child=fork(modulePath,[],{detached:process.platform!=='win32',stdio:['ignore','inherit','inherit','ipc']});
  const owned=new Map<number,ProcessIdentity>();let finishing=false;
  const scan=async()=>{if(!child.pid)return;const table=await processTable();const ids=new Set([child.pid,...table.filter(row=>owned.get(row.pid)?.started===row.started).map(row=>row.pid)]);let changed=true;while(changed){changed=false;for(const row of table)if(ids.has(row.parent)&&!ids.has(row.pid)){ids.add(row.pid);owned.set(row.pid,row);changed=true;}}};
  const polling=setInterval(()=>{void scan().catch(()=>{});},250);
  const killGroup=(signal:NodeJS.Signals)=>{if(!child.pid)return;try{if(process.platform==='win32')child.kill(signal);else process.kill(-child.pid,signal);}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}};
  const finish=async(error?:Error)=>{
   if(finishing)return;finishing=true;clearInterval(polling);clearTimeout(deadline);process.off('SIGTERM',onSignal);process.off('SIGINT',onSignal);
   try{
    await scan();killGroup('SIGTERM');await Promise.all([...owned.values()].map(p=>signalOwned(p,'SIGTERM')));
    // Browser close is attempted in the worker first. This grace period bounds leaked descendants.
    await new Promise(r=>setTimeout(r,300));
    killGroup('SIGKILL');await Promise.all([...owned.values()].map(p=>signalOwned(p,'SIGKILL')));
    if(child.connected)child.disconnect();
    if(error)reject(error);else resolve();
   }catch(cleanupError){reject(new Error('Render worker cleanup failed',{cause:cleanupError}));}
  };
  const onSignal=()=>{void finish(new Error('Render interrupted'));};
  process.on('SIGTERM',onSignal);process.on('SIGINT',onSignal);
  const deadline=setTimeout(()=>{void finish(new Error(`Render worker exceeded ${timeoutMs} ms deadline`));},timeoutMs);
  child.on('error',error=>{void finish(error);});
  child.on('exit',(code,signal)=>{void finish(new Error(`Render worker exited without a result (code ${code}, signal ${signal})`));});
  child.on('message',(message:unknown)=>{
   const result=message as {ok?:boolean;error?:string};
   void finish(result.ok===true?undefined:new Error(result.error??'Render worker failed'));
  });
  child.send(payload,error=>{if(error)void finish(error);});
 });
}
