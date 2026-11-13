import {z} from 'zod';
import type {LLMProvider} from '../providers/interfaces';
import {validatedJSON} from '../providers/validated-json';
/** Faithful es / pt-BR titles for one episode's clips, keyed by clip id and bound to the exact English title. */
export const clipTranslations=z.object({titles:z.record(z.object({en:z.string(),es:z.string().min(3).max(100),ptBR:z.string().min(3).max(100)}))});
export type ClipTranslations=z.infer<typeof clipTranslations>;
/** Reuses saved translations whose English title is unchanged; asks the free LLM only for the rest. */
export async function translateClipTitles(llm:LLMProvider,clips:{id:string;title:string}[],saved?:ClipTranslations):Promise<ClipTranslations>{
 const titles={...(saved?.titles??{})},missing=clips.filter(c=>titles[c.id]?.en!==c.title);
 if(missing.length){
  const schema=z.object({titles:z.array(z.object({id:z.string(),es:z.string().min(3).max(100),ptBR:z.string().min(3).max(100)})).length(missing.length)});
  const result=await validatedJSON(llm,`Translate these YouTube Shorts titles about biblical history faithfully into Spanish (es) and Brazilian Portuguese (ptBR). Keep the meaning and the question form; add nothing, remove nothing, keep standard biblical name forms in each language (e.g. Nephilim, Anakim, Hebrón/Hebrom), no hashtags, at most 90 characters each. Return {titles:[{id,es,ptBR}]} with exactly these ids. Titles: ${JSON.stringify(missing.map(c=>({id:c.id,title:c.title})))}`,schema);
  for(const c of missing){const t=result.titles.find(t=>t.id===c.id);if(!t)throw Error('Translation missing for clip '+c.id);titles[c.id]={en:c.title,es:t.es,ptBR:t.ptBR};}
 }
 return {titles};
}
/** Editorial translations for the three fixed, owner-authorized angel episode cuts; other episodes use their saved clip translations. */
export function shortMetadata(clip:{id:string;title:string;source:string},videoId:string,runId='bible-angels-001',translations?:ClipTranslations){
 if(runId!=='bible-angels-001'){
  const t=translations?.titles[clip.id];if(!t||t.en!==clip.title)throw Error('Reviewed clip translations missing');
  const url=`https://www.youtube.com/watch?v=${videoId}`,support='https://ko-fi.com/bibleunearthed';
  return {title:clip.title+' #Shorts',description:`An illustrated excerpt from a Bible Unearthed episode.\nText reference: ${clip.source}\nFull illustrated episode: ${url}\n\nOptional support: ${support}\nSynthesized narration and original AI illustrations.`,localizations:{es:{title:t.es+' #Shorts',description:`Un fragmento ilustrado de un episodio de Bible Unearthed.\nReferencia textual: ${clip.source}\nEpisodio ilustrado completo: ${url}\n\nApoyo voluntario: ${support}\nNarración sintetizada e ilustraciones originales generadas con IA.`},'pt-BR':{title:t.ptBR+' #Shorts',description:`Um trecho ilustrado de um episódio de Bible Unearthed.\nReferência textual: ${clip.source}\nEpisódio ilustrado completo: ${url}\n\nApoio opcional: ${support}\nNarração sintetizada e ilustrações originais geradas com IA.`}}};
 }
 const titles:Record<string,[string,string]>={A:['¿Reconocerías a un ángel?','Você reconheceria um anjo?'],B:['Por qué estos seres bíblicos tienen seis alas','Por que estes seres bíblicos têm seis asas'],C:['Las ruedas llenas de ojos en Ezequiel','As rodas cheias de olhos em Ezequiel']};
 if(!titles[clip.id])throw Error('Reviewed clip translations missing');
 const sourceEs=clip.source.replace('Hebrews','Hebreos').replace('Isaiah','Isaías').replace('Ezekiel','Ezequiel'),sourcePt=clip.source.replace('Hebrews','Hebreus').replace('Isaiah','Isaías').replace('Ezekiel','Ezequiel');
 const url=`https://www.youtube.com/watch?v=${videoId}`,support='https://ko-fi.com/bibleunearthed';
 return {title:clip.title+' #Shorts',description:`An illustrated excerpt about biblical depictions of angels.\nText reference: ${clip.source}\nFull illustrated episode: ${url}\n\nOptional support: ${support}\nSynthesized narration and original AI illustrations.`,localizations:{es:{title:titles[clip.id][0]+' #Shorts',description:`Un fragmento ilustrado sobre las representaciones bíblicas de los ángeles.\nReferencia textual: ${sourceEs}\nEpisodio ilustrado completo: ${url}\n\nApoyo voluntario: ${support}\nNarración sintetizada e ilustraciones originales generadas con IA.`},'pt-BR':{title:titles[clip.id][1]+' #Shorts',description:`Um trecho ilustrado sobre as representações bíblicas dos anjos.\nReferência textual: ${sourcePt}\nEpisódio ilustrado completo: ${url}\n\nApoio opcional: ${support}\nNarração sintetizada e ilustrações originais geradas com IA.`}}};
}
