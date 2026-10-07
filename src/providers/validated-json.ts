import {z} from 'zod';
import type {LLMProvider} from './interfaces';
/** Repair output shape only; failed evidence and substantive decisions remain unchanged. */
export async function validatedJSON<T>(provider:LLMProvider,instruction:string,schema:z.ZodType<T>):Promise<T>{
 let feedback='';for(let attempt=0;attempt<3;attempt++){
  try{return await provider.json(instruction+feedback,schema);}catch(error){
   if(!(error instanceof z.ZodError)||attempt===2)throw error;
   feedback='\nPrevious output failed schema validation. Return corrected JSON types, preserving the substantive decision. Arrays must be arrays, not prose strings. Errors: '+JSON.stringify(error.issues);
  }
 }
 throw new Error('Structured output repair exhausted');
}
