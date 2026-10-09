import {z} from 'zod';
import {validatedJSON} from '../providers/validated-json';
import {research} from '../orchestration/schemas';
import type {LLMProvider} from '../providers/interfaces';
export const demoResearch={topic:'A visual metaphor for attention',sources:[{url:'https://github.com/gaboplayt24-art/youtube-autopilot',title:'Original demonstration narrative',excerpt:'An original fictional spotlight/city/library metaphor. No measured psychological claims or medical advice.'}],summary:'An original illustrated story about choosing where to direct attention. Charts are explicitly illustrative, not measured evidence.'};
export function retrievedParagraphs(html:string){
 const clean=(value:string)=>value.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 const paragraphs=[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>clean(m[1])).filter(s=>s.length>=60).slice(0,28);
 return paragraphs.length?paragraphs:clean(html).slice(0,18000).match(/.{1,1200}(?:\s|$)/g)??[];
}
export async function investigate(topic:string,llm:LLMProvider,urls:string[],competitors:string[]=[]){
 const fetched:{id:string;text:string;url:string;title:string}[]=[];for(const [index,url] of urls.entries()){const res=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!res.ok)throw new Error(`Research source HTTP ${res.status}`);const html=await res.text();const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1].replace(/<[^>]+>/g,'').trim()??url;const paragraphs=retrievedParagraphs(html).map((text,i)=>({id:`source-${index}-paragraph-${i}`,text:text.slice(0,2500),url,title}));fetched.push(...paragraphs);}
 if(!fetched.length)throw new Error('Retrieved sources contained no usable evidence');
 const selection=z.object({topic:z.string(),summary:z.string(),paragraphIds:z.array(z.string()).min(Math.min(6,fetched.length)).max(12)}).superRefine((value,ctx)=>{if(new Set(value.paragraphIds).size!==value.paragraphIds.length||value.paragraphIds.some(id=>!fetched.some(p=>p.id===id)))ctx.addIssue({code:'custom',message:'Choose distinct exact paragraph IDs from retrieved material; never invent a citation'});});
 const result=await validatedJSON(llm,`Research ${JSON.stringify(topic)} using ONLY these retrieved paragraphs: ${JSON.stringify(fetched)}. Select 6–12 relevant paragraph IDs covering origin/purpose, dated context, water flow, maintenance, bath outfalls, public latrines and historical limitations when present. Preserve exact IDs. Code attaches verbatim retrieved text; NEVER write or reconstruct quotations yourself. Return {topic,summary,paragraphIds:[exact IDs]}. The summary must distinguish drainage engineering from unsupported modern sanitary protection. Use both supplied pages when relevant. Competitors are patterns only, never scripts: ${JSON.stringify(competitors)}.`,selection);
 return research.parse({topic:result.topic,summary:result.summary,sources:result.paragraphIds.map(id=>{const paragraph=fetched.find(p=>p.id===id)!;return {url:paragraph.url,title:paragraph.title,excerpt:paragraph.text};})});
}
