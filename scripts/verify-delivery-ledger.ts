import {isDeepStrictEqual} from 'node:util';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {appendFile} from 'node:fs/promises';
import type {StorageProvider} from '../src/providers/interfaces';
import {SupabaseStorage} from '../src/database/storage';

/** Exercise the same atomic reservation and persistence used by social publishing. */
export async function verifyDeliveryLedger(storage:StorageProvider,execution:string){
 if(!/^[0-9]+-[0-9]+$/.test(execution))throw Error('Isolated Actions execution ID required');
 const key='connection-probe-'+execution;
 const pending={kind:'delivery-ledger-probe',execution,state:'pending'};
 if(!await storage.create(key,pending))throw Error('Probe already exists; refusing to overwrite it');
 if(await storage.create(key,{...pending,state:'must-not-replace'}))throw Error('Duplicate reservation was not rejected');
 if(!isDeepStrictEqual(await storage.get(key),pending))throw Error('Reservation readback differs');
 const verified={...pending,state:'verified',duplicateReservationBlocked:true};
 await storage.put(key,verified);
 if(!isDeepStrictEqual(await storage.get(key),verified))throw Error('Updated ledger readback differs');
 return {key,verified:true,atomicCreate:true,duplicateReservationBlocked:true,readback:true,update:true,postsCreated:0};
}
async function main(){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.VERIFY_LEDGER_WRITE!=='true')throw Error('Explicit Actions ledger probe required');
 const report=await verifyDeliveryLedger(new SupabaseStorage(),process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT);
 console.log(JSON.stringify(report));
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'\n## Delivery ledger verified\n\nAtomic reservation, duplicate rejection, update and readback passed. One isolated connection-probe JSON retained as evidence. No videos, posts, schema or billing changes.\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(JSON.stringify({event:'delivery_ledger_probe_failed',code:typeof error?.code==='string'?error.code:null,status:typeof error?.status==='number'?error.status:null,message:error instanceof Error?error.message:'Supabase rejected the isolated reservation; inspect error code'}));process.exitCode=1;});
