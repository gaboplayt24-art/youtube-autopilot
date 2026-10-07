import {z} from 'zod';
import {requireFreshVisualRun,type doodleStyleLock} from '../visuals/visual-approval';
export const qualityResumeConfig=z.object({enabled:z.boolean(),runId:z.string().regex(/^quality-(?:style-lock|doodle)-[A-Za-z0-9_-]+$/),styleVersion:z.string().default('historical-illustration-v1'),createdAt:z.string().datetime().optional(),sourceRunId:z.string().regex(/^\d+$/),notBefore:z.string().datetime(),expiresAt:z.string().datetime()}).refine(config=>Date.parse(config.expiresAt)>Date.parse(config.notBefore)&&Date.parse(config.expiresAt)-Date.parse(config.notBefore)<=86400000,'Resume authorization must expire within one day');
export type QualityResumeConfig=z.infer<typeof qualityResumeConfig>;
export function qualityResumeDecision(config:QualityResumeConfig,now:Date,latestRunId?:number,approval?:z.infer<typeof doodleStyleLock>){
 if(!config.enabled)return 'disabled';
 if(config.styleVersion!=='educational-doodle-v3'||!config.runId.startsWith('quality-doodle-'))return 'obsolete_visual_style';
 if(!approval)return 'visual_approval_required';
 try{requireFreshVisualRun({styleVersion:config.styleVersion,createdAt:config.createdAt??''},approval);}catch{return 'visual_approval_required';}
 if(now.getTime()<Date.parse(config.notBefore))return 'waiting_quota_reset';if(now.getTime()>=Date.parse(config.expiresAt))return 'expired';if(latestRunId!==undefined&&String(latestRunId)!==config.sourceRunId)return 'newer_quality_run_exists';return 'ready';
}
export function assertFreeQuotaReset(checkpoint:unknown,now:Date){
 const value=z.object({state:z.literal('paused_quota'),resumeAfter:z.string().datetime(),paidFallback:z.literal(false)}).parse(checkpoint);if(Date.parse(value.resumeAfter)>now.getTime())throw new Error('Free quota reset is still in the future');return value;
}
