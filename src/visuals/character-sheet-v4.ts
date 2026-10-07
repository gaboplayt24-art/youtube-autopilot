import {z} from 'zod';
import type {ImageProvider,VisionProvider} from '../providers/interfaces';
import type {Runner} from '../orchestration/runner';
import {generateIllustration} from './illustrated-assets-v4';
import {visionImage} from './style-reference-v4';
import {validatedJSON} from '../providers/validated-json';
import {artworkIdea,type IllustratedStyleLock} from './illustration-schema';
const poses=['front','three-quarter','profile','walking','holding-object','pointing'] as const;
export async function createIllustratedCharacterSheet(character:{id:string;design:string;historicalContext:string},style:IllustratedStyleLock,reference:string,dir:string,runner:Runner,image:ImageProvider,vision:VisionProvider){
 if(!/^[A-Za-z0-9_-]+$/.test(character.id))throw new Error('Invalid original character ID');
 const sources=[];for(const pose of poses){const idea=artworkIdea.parse({id:character.id+'-'+pose,historicalContext:character.historicalContext,narration:'Original illustrated character continuity sheet.',concept:`Original recurring historical character: ${character.design}. Pose ${pose}; plain clean cream background; same hair, apparent age, clothing colors and general proportions. Illustrated full body with expressive visible hands, not code geometry.`,overlay:null,labelPlacement:'left',characterRoles:[character.id]});sources.push(await generateIllustration(idea,style,reference,dir,runner,image,vision));}
 const schema=z.object({passed:z.boolean(),sameStyle:z.boolean(),sameClothing:z.boolean(),samePalette:z.boolean(),sameHair:z.boolean(),sameAge:z.boolean(),sameIdentity:z.boolean(),photorealisticDrift:z.boolean(),issues:z.array(z.string())});
 const images=await Promise.all([reference,...sources.map(s=>s.source.path)].map(visionImage));
 const qa=await runner.stage('character-sheet-'+character.id+'-QA',schema,()=>validatedJSON({json:<T>(p:string,s:z.ZodType<T>)=>vision.images(p,images,s)},`Compare ACTUAL images: first positive style reference, then front, three-quarter, profile, walking, holding-object, pointing illustrations of ONE original character. Design ${JSON.stringify(character.design)}. Check same style, clothing, palette, hair, apparent age and general identity. Minor cartoon variation is acceptable; photography, geometric clipart or completely different character design are failures. Do not demand photorealistic face cloning. Return {passed,sameStyle,sameClothing,samePalette,sameHair,sameAge,sameIdentity,photorealisticDrift,issues:[string]}.`,schema));
 if(!qa.passed||!qa.sameStyle||!qa.sameClothing||!qa.samePalette||!qa.sameHair||!qa.sameAge||!qa.sameIdentity||qa.photorealisticDrift||qa.issues.length)throw new Error('Actual illustrated character-sheet continuity QA failed');
 return {characterId:character.id,sources,qa};
}
