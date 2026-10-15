import {createClient} from '@supabase/supabase-js';
import {join} from 'node:path';
import {open,readdir,mkdir} from 'node:fs/promises';
import {json,read} from '../orchestration/io';
import type {StorageProvider} from '../providers/interfaces';
export class LocalStorage implements StorageProvider {
 constructor(private root:string){}
 private path(key:string){if(!/^[a-zA-Z0-9_-]+$/.test(key))throw new Error('Invalid storage key');return join(this.root,key+'.json');}
 async put(key:string,value:unknown){await json(this.path(key),value);}
 async get(key:string){return read(this.path(key));}
 async create(key:string,value:unknown){await mkdir(this.root,{recursive:true});try{const file=await open(this.path(key),'wx');await file.writeFile(JSON.stringify(value));await file.close();return true;}catch(e){if((e as NodeJS.ErrnoException).code==='EEXIST')return false;throw e;}}
 async list(prefix:string){return Promise.all((await readdir(this.root)).filter(x=>x.startsWith(prefix)&&x.endsWith('.json')).map(x=>read(join(this.root,x))));}
}
/** The SDK adds /rest/v1 itself. A pasted REST endpoint must not duplicate it. */
export function supabaseProjectUrl(value:string){
 const url=new URL(value);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.username||url.password||url.port)throw Error('Official HTTPS Supabase project URL required');
 return url.origin;
}
export class SupabaseStorage implements StorageProvider {
 private client=createClient(supabaseProjectUrl(process.env.SUPABASE_URL??''),process.env.SUPABASE_SERVICE_ROLE_KEY??'');
 async put(key:string,value:unknown){const {error}=await this.client.from('pipeline_artifacts').upsert({key,value,updated_at:new Date().toISOString()});if(error)throw error;}
 async get(key:string){const {data,error}=await this.client.from('pipeline_artifacts').select('value').eq('key',key).single();if(error)throw error;return data.value;}
 async create(key:string,value:unknown){const {error}=await this.client.from('pipeline_artifacts').insert({key,value});if(error?.code==='23505')return false;if(error)throw error;return true;}
 async list(prefix:string){if(!/^[a-zA-Z0-9-]+$/.test(prefix))throw new Error('Invalid key prefix');const rows:unknown[]=[];for(let offset=0;;offset+=500){const {data,error}=await this.client.from('pipeline_artifacts').select('value').like('key',`${prefix}%`).order('key').range(offset,offset+499);if(error)throw error;rows.push(...data.map(x=>x.value));if(data.length<500)break;}return rows;}
}
