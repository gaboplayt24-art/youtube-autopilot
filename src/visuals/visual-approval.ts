import {z} from 'zod';
import {styleLock} from './style-lock';
export const doodleStyleLock=styleLock.extend({version:z.literal('educational-doodle-v3'),visualSystemApproved:z.boolean(),approvedAt:z.string().datetime().nullable()}).refine(v=>!v.visualSystemApproved||v.approvedAt!==null,'Approved visual system must record the human approval date');
export function requireFreshVisualRun(run:{styleVersion:string;createdAt:string},approval:z.infer<typeof doodleStyleLock>){
 if(run.styleVersion!==approval.version)throw new Error('Obsolete visual direction; preserve evidence without continuing');
 if(!approval.visualSystemApproved||!approval.approvedAt)throw new Error('New visual system awaits human approval');
 if(!Number.isFinite(Date.parse(run.createdAt))||Date.parse(run.createdAt)<=Date.parse(approval.approvedAt))throw new Error('Only runs created after new visual approval may automatically resume');
}
