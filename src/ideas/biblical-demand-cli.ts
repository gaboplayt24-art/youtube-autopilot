import {FreeQuotaLedger,withQuota} from '../quota';
import {researchBiblicalDemand} from './biblical-demand';
import {analyzeReferenceChannel} from './reference-channel';
import {json} from '../orchestration/io';
const dir='data/research/biblical-demand',quota=new FreeQuotaLedger(dir);
(async()=>{await quota.restore();try{await withQuota(quota,async()=>{const handle=process.env.REFERENCE_CHANNEL;const report=handle?await analyzeReferenceChannel(handle):await researchBiblicalDemand();await json(dir+(handle?'/reference-channel-report.json':'/demand-report.json'),report);console.log((handle?'REFERENCE_CHANNEL_REPORT ':'BIBLICAL_DEMAND_REPORT ')+JSON.stringify(report));});}finally{await quota.report();}})().catch(()=>{console.error('Biblical research failed; inspect workflow and preserved quota evidence. No credentials are printed.');process.exitCode=1;});
