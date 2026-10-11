import type {z} from 'zod';
export interface LLMProvider {json<T>(instruction:string,schema:z.ZodType<T>):Promise<T>}
export interface VisionProvider {images<T>(instruction:string,images:{mimeType:string;data:string}[],schema:z.ZodType<T>):Promise<T>}
export type Alignment={start:number;end:number;text:string}[];
export interface TTSProvider {speak(text:string,path:string,context?:SpeechContext):Promise<{alignment:Alignment;words?:Alignment}>}
export interface TranscriptionProvider {transcribe(path:string,narration:string):Promise<Alignment>}
export type ImageContext={referenceImages?:string[];width?:number;height?:number;/** Owner-authorized 2026-10-10: only the v5 style audition character sheet may be drawn without a reference. */ referenceFreeAudition?:true};
export interface ImageProvider {generate(prompt:string,path:string,context?:ImageContext):Promise<void>}
export interface VideoProvider {generate(prompt:string,path:string):Promise<void>;estimateCost?(seconds:number):number}
export type SpeechContext={criticalTerms?:string[];previousText?:string;nextText?:string;performance?:{tone:string;pace:string;energy:number};pronunciations?:{term:string;replacement:string}[];referenceAudioPath?:string;cloningMode?:'audio_prompt_path';allowVoiceReview?:boolean};
export interface SoundEffectsProvider {generate(prompt:string,seconds:number,path:string):Promise<{license:string;estimatedCost:number}>}
export type StockAsset={url:string;kind:'image'|'video';license:string;sourceUrl:string;attribution:string;creator?:string;licenseUrl?:string;publicDomain?:boolean};
export interface StockProvider {search(query:string,kind:'image'|'video',minDuration:number):Promise<StockAsset|null>}
export type SoundEventType='whoosh'|'impact'|'riser'|'click'|'page-turn'|'camera'|'transition'|'ambient';
export interface MusicProvider {generate(seconds:number,path:string,direction?:string):Promise<{license:string;estimatedCost:number}>}
export interface StorageProvider {put(key:string,value:unknown):Promise<void>;get(key:string):Promise<unknown>;create(key:string,value:unknown):Promise<boolean>;list(prefix:string):Promise<unknown[]>}
