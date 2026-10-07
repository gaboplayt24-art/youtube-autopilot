import {z} from 'zod';
import type {LLMProvider} from '../providers/interfaces';
import {type VisualBible} from './bible';
export const visualPreflight=z.object({historicalReview:z.object({passed:z.boolean(),issues:z.array(z.string())}),assets:z.array(z.object({id:z.string().regex(/^[A-Za-z0-9_-]+$/),sceneId:z.string(),prompt:z.string().min(10).max(400),character:z.boolean()})).min(8).max(16),thumbnailTexts:z.array(z.string().min(1).max(28).refine(s=>s.split(/\s+/).length<=5)).length(3)});
export const promptCheck=z.object({passed:z.boolean(),issues:z.array(z.string()),anachronisms:z.array(z.string())});
export const assetCorrections=z.record(z.string().min(10).max(400));
export function correctAssetPlan(plan:z.infer<typeof visualPreflight>,changes:z.infer<typeof assetCorrections>){
 for(const id of Object.keys(changes))if(!plan.assets.some(a=>a.id===id))throw new Error('Historical correction references an unknown asset: '+id);
 return visualPreflight.parse({...plan,assets:plan.assets.map(a=>({...a,prompt:changes[a.id]??a.prompt}))});
}
export async function reviewHistoricalPrompt(id:string,prompt:string,bible:VisualBible,llm:LLMProvider){const result=await llm.json(`Review FINAL prompt ${id} before FLUX. Exact period, civilization, region, architecture, clothes, hair, materials, weapons, boats, technology and major anachronisms. Return {passed,issues,anachronisms}. Minor composition/style preferences do not fail. Prompt: ${prompt}. Bible: ${JSON.stringify(bible)}`,promptCheck);if(!result.passed)throw new Error(`Historical prompt ${id} rejected: ${result.issues.join('; ')}`);return result;}
