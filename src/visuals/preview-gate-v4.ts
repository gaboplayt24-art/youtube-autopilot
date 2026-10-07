import {IllustrationStyleRejected,type IllustrationEvidence} from './illustrated-assets-v4';
// Complete exactly four first-pass samples, retaining failed style evidence.
// Provider/quota/prompt errors propagate immediately; they are not style verdicts.
export async function firstFourStyleGate(generate:(index:number)=>Promise<IllustrationEvidence>,save:(samples:IllustrationEvidence[])=>Promise<void>){
 const samples:IllustrationEvidence[]=[];
 for(let index=0;index<4;index++){try{samples.push(await generate(index));}catch(error){if(!(error instanceof IllustrationStyleRejected))throw error;samples.push(error.evidence);}}
 await save(samples);
 if(samples.some(sample=>!sample.review.passed))throw new Error('First-four positive-reference style gate failed; remaining eight illustrations were NOT generated');
 return samples;
}
