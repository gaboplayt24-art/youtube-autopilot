import {z} from 'zod';
import {read} from '../orchestration/io';
import {localizations} from '../orchestration/schemas';
import type {LLMProvider} from '../providers/interfaces';
import {validatedJSON} from '../providers/validated-json';
/** Owner-approved 2026-10-11: faithful YouTube title/description translations (config/localization.json) for the same English video. */
export async function translateMetadata(llm:LLMProvider,metadata:{title:string;description:string}){
 const conf=z.object({defaultLanguage:z.string(),languages:z.array(z.string()).max(10)}).parse(await read('config/localization.json'));const urls=metadata.description.match(/https?:\/\/\S+/g)??[];const items:Record<string,{title:string;description:string}>={};
 for(const lang of conf.languages){const contract=localizations.shape.items.element.superRefine((v,c)=>{for(const u of urls)if(!v.description.includes(u))c.addIssue({code:'custom',message:'Keep every source URL exactly: '+u});});
  items[lang]=await validatedJSON(llm,`Translate this YouTube title and description from English into the language with BCP-47 code ${lang}. Faithful translation only: no new claims, no clickbait beyond the original, keep scholarly attribution and uncertainty wording, keep every URL exactly as written, and write proper biblical and historical names in the standard form used by that language's Bible translations and encyclopedias. Title at most 100 characters. Return {title,description}. ${JSON.stringify({title:metadata.title,description:metadata.description})}`,contract);}
 return localizations.parse({defaultLanguage:conf.defaultLanguage,items});
}
