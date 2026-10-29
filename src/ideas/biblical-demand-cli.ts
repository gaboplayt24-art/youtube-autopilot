import {z} from 'zod';
import {FreeQuotaLedger,withQuota} from '../quota';
import {researchBiblicalDemand} from './biblical-demand';
import {analyzeReferenceChannel} from './reference-channel';
import {json} from '../orchestration/io';
const dir='data/research/biblical-demand',quota=new FreeQuotaLedger(dir);
(async()=>{await quota.restore();try{await withQuota(quota,async()=>{const handle=process.env.REFERENCE_CHANNEL;// TOPIC_QUERIES (JSON [{topic,query}]) measures specific upcoming topics instead of the default sample.
const queries=process.env.TOPIC_QUERIES?z.array(z.object({topic:z.string().min(2),query:z.string().min(5)})).min(1).max(12).parse(JSON.parse(process.env.TOPIC_QUERIES)):undefined;const report=handle?await analyzeReferenceChannel(handle):await researchBiblicalDemand(undefined,new Date(),queries);await json(dir+(handle?'/reference-channel-report.json':'/demand-report.json'),report);console.log((handle?'REFERENCE_CHANNEL_REPORT ':'BIBLICAL_DEMAND_REPORT ')+JSON.stringify(report));});}finally{await quota.report();}})().catch(()=>{console.error('Biblical research failed; inspect workflow and preserved quota evidence. No credentials are printed.');process.exitCode=1;});
