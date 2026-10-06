import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import type {z} from 'zod';
import {read} from './io';
export const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function fileDigest(path:string){return createHash('sha256').update(await readFile(path)).digest('hex');}
export async function artifact<T>(dir:string,name:string,schema:z.ZodType<T,z.ZodTypeDef,unknown>):Promise<T>{const value=await read(join(dir,name+'.json'));const saved=await read(join(dir,name+'.integrity.json'));if(digest(value)!==saved.sha256)throw new Error(`Corrupted ${name} checkpoint`);return schema.parse(value);}
