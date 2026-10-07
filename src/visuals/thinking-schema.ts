import {z} from 'zod';
export const conceptTypes=z.enum(['CHARACTER_EXPLANATION','ICON_EXPLANATION','COMPARE_TWO','HIERARCHY','PROCESS','MAP','TIMELINE','WARNING']);
export const doodleIcon=z.enum(['person','child','amphora','boat','coin','scroll','tool','sun','warning','building','clock','path','focus','book','balance','arrow','box','wind','spray']);
export const visualIdea=z.object({
 version:z.literal('educational-doodle-v3'),
 conceptType:conceptTypes,
 takeaway:z.string().min(5).max(240),
 nodes:z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9_-]+$/),icon:doodleIcon,label:z.string().max(24).refine(s=>s.trim().split(/\s+/).length<=4),pose:z.enum(['neutral','point','carry','think','walk']),emphasis:z.boolean()})).min(1).max(4),
 relationships:z.array(z.object({from:z.string(),to:z.string(),label:z.string().max(20)})).max(3),
}).strict().superRefine((idea,ctx)=>{
 const ids=new Set(idea.nodes.map(n=>n.id));if(ids.size!==idea.nodes.length)ctx.addIssue({code:'custom',message:'Node IDs must be unique'});
 if(idea.relationships.some(r=>!ids.has(r.from)||!ids.has(r.to)||r.from===r.to))ctx.addIssue({code:'custom',message:'Relationship endpoints must reference distinct existing nodes'});
 if(idea.conceptType==='COMPARE_TWO'&&idea.nodes.length!==2)ctx.addIssue({code:'custom',message:'COMPARE_TWO requires exactly two nodes'});
});
export type VisualIdea=z.infer<typeof visualIdea>;
