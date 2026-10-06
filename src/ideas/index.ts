import {ideas} from '../orchestration/schemas';
import type {LLMProvider} from '../providers/interfaces';
export async function generateIdeas(input:unknown,llm:LLMProvider){return llm.json(`Generate 3 original educational ideas grounded in ${JSON.stringify(input)}. Return {ideas:[{topic,hook,score,reason}]}; score 0-100 by source support, audience relevance, and clarity.`,ideas);}
export function selectTopic(input:ReturnType<typeof ideas.parse>){return [...input.ideas].sort((a,b)=>b.score-a.score)[0];}
export function scoreIdeas(input:ReturnType<typeof ideas.parse>,sourceCount:number){return ideas.parse({ideas:input.ideas.map(item=>{const clarity=Math.min(20,item.hook.trim().split(/\s+/).length>=4?20:5);const evidence=Math.min(30,sourceCount*15);const editorial=item.score*0.5;return {...item,score:Math.round(editorial+clarity+evidence),reason:`${item.reason}; evidence coverage ${evidence}/30; hook clarity ${clarity}/20; editorial estimate ${editorial}/50`};})});}
