import {z} from 'zod';
import {visualIdea} from '../visuals/thinking-schema';
import {artworkIdea,primaryArtwork} from '../visuals/illustration-schema';
export const shotTypes=z.enum(['generated-image','stock-video','stock-image','map','timeline','chart','document','headline','quote','kinetic-text','diagram','icon-scene','background-video']);
export const motions=z.enum(['slow-push-in','pull-out','pan-left','pan-right','parallax','subtle-shake']);
export const word=z.object({start:z.number().nonnegative(),end:z.number().positive(),text:z.string().min(1)});
export const editorialTiming=z.object({start:z.number().nonnegative(),end:z.number().positive(),anchor:z.string().min(1)}).refine(v=>v.end>v.start,'Editorial timing must have positive duration');
export const shot=z.object({editorialTiming:editorialTiming.optional(),overlayAnchor:z.string().min(1).max(100).optional(),overlayArrow:z.tuple([z.number().min(0).max(1),z.number().min(0).max(1),z.number().min(0).max(1),z.number().min(0).max(1)]).optional(),illustrationIdea:artworkIdea.optional(),visualIdea:visualIdea.optional(),id:z.string(),sceneId:z.string(),start:z.number().nonnegative(),end:z.number().positive(),narration:z.string().min(1),visualIntent:z.string().min(5),shotType:shotTypes,motion:motions,assetPrompt:z.string().min(10),assetKey:z.string().regex(/^[A-Za-z0-9_-]+$/).optional(),editorialReframe:z.number().int().min(0).max(2).optional(),searchQuery:z.string().min(1).max(100).optional(),overlay:z.string().max(40).refine(s=>s.split(/\s+/).length<=5).nullable(),keywords:z.array(z.string()),data:z.array(z.number().nonnegative()).min(1).max(8).optional(),labels:z.array(z.string().max(16)).max(3).optional(),highImpact:z.boolean(),transition:z.enum(['cut','blur','light-leak'])});
export const shotPlan=z.object({segments:z.array(z.object({sceneId:z.string(),start:z.number(),end:z.number(),narration:z.string()})),shots:z.array(shot).min(1),pacingScore:z.number(),visualDensity:z.number()});
/** Gemini often reports boxes on its native 0–1000 scale; convert only that unambiguous scale to 0–1. */
const normalizeBounds=(b:[number,number,number,number]):[number,number,number,number]=>b.every(n=>n>=0&&n<=1000)&&b.some(n=>n>1)?[b[0]/1000,b[1]/1000,b[2]/1000,b[3]/1000]:b;
export const componentCrop=z.object({bounds:z.tuple([z.number(),z.number(),z.number(),z.number()]).transform(normalizeBounds).refine(b=>b.every(n=>n>=0&&n<=1),'Bounds must be normalized 0–1').refine(b=>b[2]>b[0]&&b[3]>b[1]&&(b[2]-b[0])*(b[3]-b[1])<=.75,'Meaningful actual component crop, never nearly the entire completed scene: (x2-x1)*(y2-y1) must be at most 0.75 of the normalized image; select one character, prop or detail with a tighter box'),subject:z.string().min(3),kind:z.enum(['character','object','environment-detail']),placement:z.enum(['left','right'])});
export const mediaAsset=z.object({editorialCrop:componentCrop.optional(),artwork:primaryArtwork.optional(),shotId:z.string(),sourceImageId:z.string().optional(),sourceSha256:z.string().length(64).optional(),editorialVariant:z.string().optional(),path:z.string(),kind:z.enum(['image','video','graphic']),provider:z.string(),license:z.string().min(1),sourceUrl:z.string().nullable(),qualityScore:z.number().min(0).max(100).optional(),creator:z.string().optional(),attribution:z.string().optional(),publicDomain:z.boolean().optional(),licenseUrl:z.string().optional(),estimatedCost:z.number().nonnegative(),intent:z.string(),fallbacks:z.array(z.string()),sha256:z.string().length(64),depthLayers:z.object({foreground:z.string(),midground:z.string(),background:z.string(),depth:z.string()}).optional()});
export const media=z.object({assets:z.array(mediaAsset),estimatedTotalCost:z.number()});
export const audioMix=z.object({path:z.string(),musicPath:z.string(),narrationPath:z.string().optional(),duckedMusicPath:z.string().optional(),events:z.array(z.object({time:z.number(),type:z.enum(['whoosh','impact','riser','click','page-turn','camera','transition','ambient','pop','boom','shimmer','paper'])})),duration:z.number(),peakDb:z.number(),musicDb:z.number(),sfxDb:z.number(),provenance:z.string()});
export const profile=z.object({name:z.string(),accent:z.string(),secondary:z.string(),background:z.string(),captionPreset:z.enum(['bold','restrained','highlight']),captionSize:z.number().min(48).max(90),shotTypes:z.array(shotTypes).min(1),motionStyle:z.string(),musicDb:z.number().min(-40).max(-15),sfxDb:z.number().min(-36).max(-12),assetBudgetUsd:z.number().min(0),aiVideoBudgetUsd:z.number().min(0)});
export type Shot=z.infer<typeof shot>;export type ShotPlan=z.infer<typeof shotPlan>;export type MediaAsset=z.infer<typeof mediaAsset>;export type VisualProfile=z.infer<typeof profile>;
// Owner-requested 2026-10-16 dynamic edit: more framings per approved illustration, motion transitions,
// pop labels, verse/chapter cards and timed sound design. Pure layout data; the art and narration are unchanged.
export const editEntries=z.enum(['cut','punch','glide','whip-left','whip-right','zoom']);
export const editSounds=z.enum(['whoosh','pop','boom','shimmer','paper']);
export const dynamicEdit=z.object({
 version:z.literal('dynamic-v1'),
 beats:z.array(z.object({shotId:z.string(),start:z.number().nonnegative(),end:z.number().positive(),scale:z.number().min(1).max(1.4),centerX:z.number().min(0).max(1),centerY:z.number().min(0).max(1),drift:z.number().min(-1).max(1),entry:editEntries})),
 pops:z.array(z.object({start:z.number().nonnegative(),end:z.number().positive(),text:z.string().min(1).max(40),placement:z.enum(['top','left','right']),target:z.tuple([z.number().min(0).max(1),z.number().min(0).max(1)]).optional()})),
 // Cut-out actors of an approved illustration over its own softened plate (2.5D); absent shots stay full-frame.
 layers:z.array(z.object({shotId:z.string(),background:z.string(),actors:z.array(z.object({path:z.string(),x:z.number(),y:z.number(),width:z.number().positive(),height:z.number().positive(),entry:z.enum(['pop','rise','slide-left','slide-right']),delay:z.number().nonnegative()})).min(1).max(5)})).default([]),
 cards:z.array(z.object({kind:z.enum(['verse','chapter']),start:z.number().nonnegative(),end:z.number().positive(),title:z.string().min(1).max(48),number:z.number().int().positive().optional()})),
 sfx:z.array(z.object({time:z.number().nonnegative(),type:editSounds})),
 // Cut-out poses of the approved Eli sheet (front, walking, surprised) for chapter-card presenter moments.
 presenter:z.array(z.string()).max(3).default([])
});
export type DynamicEdit=z.infer<typeof dynamicEdit>;
