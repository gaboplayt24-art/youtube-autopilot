import {facts,type Script,research} from '../orchestration/schemas';
import {demoScript} from '../script';
import type {LLMProvider} from '../providers/interfaces';
export async function factcheck(s:Script,r:ReturnType<typeof research.parse>,llm?:LLMProvider){
 const claims=s.scenes.flatMap(x=>x.claims);const unknown=claims.filter(x=>!r.sources.some(y=>y.url===x.sourceUrl));
 if(unknown.length)return facts.parse({passed:false,issues:['Unknown source citations'],checkedClaims:claims.length,review:'Rejected citation references'});
 if(!llm)return facts.parse({passed:JSON.stringify(s)===JSON.stringify(demoScript),issues:JSON.stringify(s)===JSON.stringify(demoScript)?[]:['Offline review is valid only for the exact curated demonstration script'],checkedClaims:claims.length,review:'Curated demonstration claims checked against bundled official documentation; not a live research validation'});
 return llm.json(`Critically verify every assertion in this script against ONLY the supplied source excerpts. Reject unsupported, overstated or missing citations including assertions not listed in claims. Script: ${JSON.stringify(s)} Sources: ${JSON.stringify(r.sources)}. Return {passed,issues:[string],checkedClaims,review}. Be conservative.`,facts);
}
