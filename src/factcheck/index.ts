import {facts,type Script,research} from '../orchestration/schemas';
import {demoScript} from '../script';
import {validatedJSON} from '../providers/validated-json';
import type {LLMProvider} from '../providers/interfaces';
export async function factcheck(s:Script,r:ReturnType<typeof research.parse>,llm?:LLMProvider){
 const claims=s.scenes.flatMap(x=>x.claims);const unknown=claims.filter(x=>!r.sources.some(y=>y.url===x.sourceUrl));
 if(unknown.length)return facts.parse({passed:false,issues:['Unknown source citations'],checkedClaims:claims.length,review:'Rejected citation references'});
 if(!llm)return facts.parse({passed:JSON.stringify(s)===JSON.stringify(demoScript),issues:JSON.stringify(s)===JSON.stringify(demoScript)?[]:['Offline review is valid only for the exact curated demonstration script'],checkedClaims:claims.length,review:'Exact curated fictional metaphor verified; no empirical claims or measured statistics. Not a live research validation'});
 return validatedJSON(llm,`Critically verify every assertion in this script against ONLY the supplied source excerpts. Reject unsupported, overstated or missing citations including assertions not listed in claims. Script: ${JSON.stringify(s)} Sources: ${JSON.stringify(r.sources)}. Return {passed:boolean,issues:[string],checkedClaims:INTEGER COUNT (not an array),review:string}. Assess ALL narration, not only declared claims. A sewer cannot establish city-wide cleanliness, safe drinking water, guaranteed blockage avoidance, no manual labor, complete waste removal, or modern disease protection. Assess only provided excerpts; do not introduce external historical knowledge as if it were supplied evidence. Ordinary connective explanations and clearly subjective descriptive adjectives are advisory, not fabricated historical facts. Reject unsupported measurable/historical assertions and misleading guarantees. Be conservative about genuine factual errors.`,facts);
}
