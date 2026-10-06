import type {z} from 'zod';
export interface LLMProvider {json<T>(instruction:string,schema:z.ZodType<T>):Promise<T>}
export type Alignment={start:number;end:number;text:string}[];
export interface TTSProvider {speak(text:string,path:string):Promise<{alignment:Alignment}>}
export interface ImageProvider {generate(prompt:string,path:string):Promise<void>}
export interface VideoProvider {generate(prompt:string,path:string):Promise<void>}
export interface StorageProvider {put(key:string,value:unknown):Promise<void>;get(key:string):Promise<unknown>;create(key:string,value:unknown):Promise<boolean>;list(prefix:string):Promise<unknown[]>}
