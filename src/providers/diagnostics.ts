import {z} from 'zod';
const model=z.object({name:z.string(),displayName:z.string().optional(),supportedGenerationMethods:z.array(z.string()).default([]),inputTokenLimit:z.number().optional(),outputTokenLimit:z.number().optional()});
const page=z.object({models:z.array(model).default([]),nextPageToken:z.string().optional()});
/** Metadata only: listing does not authorize inference or assert a pricing tier. */
export async function listGeminiModels(request:typeof fetch=fetch){
 const key=process.env.GEMINI_API_KEY;if(!key)throw new Error('GEMINI_API_KEY missing in the Actions workflow');
 const models:z.infer<typeof model>[]=[];let token:string|undefined;let requests=0;
 do{const url=new URL('https://generativelanguage.googleapis.com/v1beta/models');url.searchParams.set('pageSize','100');if(token)url.searchParams.set('pageToken',token);
 const response=await request(url,{headers:{'x-goog-api-key':key},signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Gemini model listing HTTP ${response.status}`);const result=page.parse(await response.json());models.push(...result.models);token=result.nextPageToken;if(++requests>=10&&token)throw new Error('Gemini model listing pagination limit reached');
 }while(token);
 return {provider:'gemini',metadataOnly:true,requestedModel:process.env.GEMINI_MODEL||'gemini-2.5-flash',models,generateContentModels:models.filter(m=>m.supportedGenerationMethods.includes('generateContent')).map(m=>m.name),requests,paidProviderCostUsd:0,pricingReviewRequired:true};
}
