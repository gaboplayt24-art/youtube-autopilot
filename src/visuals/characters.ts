import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {z} from 'zod';
import {json,read} from '../orchestration/io';
import {fileDigest} from '../orchestration/integrity';
import {historicalPrompt,type VisualBible} from './bible';
import type {ImageProvider,LLMProvider} from '../providers/interfaces';
import {currentCosts} from '../cost';
const review=z.object({id:z.string(),passed:z.boolean(),issues:z.array(z.string()),anachronisms:z.array(z.string())});
export const characterPack=z.object({characterId:z.string(),assets:z.array(z.object({id:z.string(),path:z.string(),sha256:z.string()})),source:z.literal('canonical-character-pack'),reused:z.boolean()});
export type CharacterPack=z.infer<typeof characterPack>;
/** Generates a reviewed canonical pack once; shots can reuse these images with different crops. */
export async function createCharacterReferencePack(character:{id:string;identity:string;costume:string;props:string[];era:string;continuityRules:string[]},bible:VisualBible,dir:string,image:ImageProvider,reviewer:LLMProvider):Promise<CharacterPack>{
 const folder=join(dir,'characters',character.id);await mkdir(folder,{recursive:true});const views=[['portrait-front','85mm face and scar continuity'],['three-quarter','50mm chest-up with costume and bronze clasp'],['full-body','35mm full body beside period harbor props'],['working-pose','24mm walking with a linen ledger at the quay']];const assets=[];
 for(const [id,view] of views){const prompt=historicalPrompt(bible,`${character.id}; canonical reference ${view}; ${character.identity}; costume ${character.costume}; props ${character.props.join(', ')}; continuity ${character.continuityRules.join('; ')}; no readable text`);const reviewPath=join(folder,`${id}.review.json`);let checked: z.infer<typeof review>;try{checked=review.parse(await read(reviewPath));}catch{checked=await reviewer.json(`Review this canonical historical character prompt before FLUX. Check exact century, civilization, region, face continuity, clothing, materials, props and anachronisms. Return {id,passed,issues,anachronisms}. Prompt: ${prompt}`,review);await json(reviewPath,checked);}if(!checked.passed)throw new Error(`Gemini rejected canonical character prompt ${id}`);const raw=join(folder,`${id}.png`),checkpoint=raw+'.json';let cached=false;try{const old=await read(checkpoint);if(old.prompt!==prompt||old.sha256!==await fileDigest(raw))throw new Error('Canonical character checkpoint changed');cached=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}if(!cached){const ledger=currentCosts();const make=()=>image.generate(prompt,raw);if(ledger)await ledger.charge('generatedImages','cloudflare-flux-free',0,`${character.id}-${id}`,make);else await make();await json(checkpoint,{prompt,sha256:await fileDigest(raw),model:'@cf/black-forest-labs/flux-1-schnell'});}assets.push({id,path:raw,sha256:await fileDigest(raw)});}return characterPack.parse({characterId:character.id,assets,source:'canonical-character-pack',reused:true});
}
