import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {json,read,exec} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {historicalPrompt,type VisualBible} from './bible';
import {reviewHistoricalPrompt} from './preflight';
import type {ImageProvider,LLMProvider} from '../providers/interfaces';
import {currentCosts} from '../cost';
export const characterPack=z.object({characterId:z.string(),assets:z.array(z.object({id:z.string(),path:z.string(),sha256:z.string()})),source:z.literal('canonical-character-pack'),reused:z.boolean()});
export type CharacterPack=z.infer<typeof characterPack>;
export async function createCharacterReferencePack(character:{id:string;identity:string;costume:string;props:string[];era:string;continuityRules:string[]},bible:VisualBible,dir:string,image:ImageProvider,reviewer:LLMProvider,prepareOnly=false):Promise<CharacterPack>{
 const folder=join(dir,'characters',character.id);await mkdir(folder,{recursive:true});
 // A single master identity and genuine crops avoid independently generated faces.
 const prompt=historicalPrompt(bible,`35mm full body character reference, face centered upper third; ${character.identity}; ${character.costume}; harbor behind her; holding a plain wax tablet; no readable writing`);
 const checked=await reviewHistoricalPrompt(character.id,prompt,bible,reviewer);await json(join(folder,'prompt-review.json'),{prompt,...checked});
 if(prepareOnly)return {characterId:character.id,assets:[],source:'canonical-character-pack',reused:true};
 const raw=join(folder,'canonical-master.png'),checkpoint=raw+'.json';let cached=false;
 try{const old=await read(checkpoint);if(old.prompt!==prompt||old.sha256!==await fileDigest(raw))throw new Error('Canonical reference checkpoint mismatch');cached=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
 if(!cached){const ledger=currentCosts();const make=()=>image.generate(prompt,raw);if(ledger)await ledger.charge('generatedImages','cloudflare-flux-free',0,character.id,make);else await make();await json(checkpoint,{prompt,sha256:await fileDigest(raw)});}
 const assets=[];for(const [id,filter]of [['full-body','scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080'],['portrait-detail','crop=iw*0.65:ih*0.5:iw*0.175:0,scale=1920:1080'],['costume-detail','crop=iw*0.7:ih*0.5:iw*0.15:ih*0.25,scale=1920:1080'],['prop-detail','crop=iw*0.65:ih*0.45:iw*0.175:ih*0.4,scale=1920:1080']]){const path=join(folder,id+'.png');await exec('ffmpeg',['-y','-v','error','-i',raw,'-vf',filter,'-frames:v','1',path],{timeout:30000});assets.push({id,path,sha256:await fileDigest(path)});}
 await json(join(folder,'identity-provenance.json'),{master:raw,sha256:await fileDigest(raw),method:'One generated identity, editorial crops; no invented alternate face angles',character});return characterPack.parse({characterId:character.id,assets,source:'canonical-character-pack',reused:true});
}
